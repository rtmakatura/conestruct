"""
Migrate old taxonomy class names to new 14-class taxonomy.

Mapping:
    DRUM_36  → DRUM
    TMA      → TRUCK_MOUNTED_ATTENUATOR
    CONE_28  → CONE

Runs in dry-run mode first, showing a summary of changes. Only applies
changes after explicit user confirmation.

Writes a migration log CSV to data/backups/migration_log_{timestamp}.csv.

Usage:
    python -m src.labeling.migrate_taxonomy \
        --api-key YOUR_KEY \
        --project-id 4
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx

DEFAULT_LS_URL = "http://localhost:8080"

RENAME_MAP = {
    "DRUM_36": "DRUM",
    "TMA": "TRUCK_MOUNTED_ATTENUATOR",
    "CONE_28": "CONE",
}


def resolve_token(base_url: str, token: str) -> str:
    test = httpx.get(
        f"{base_url}/api/current-user/whoami",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10.0,
    )
    if test.status_code == 200:
        return token

    resp = httpx.post(
        f"{base_url}/api/token/refresh/",
        json={"refresh": token},
        timeout=10.0,
    )
    if resp.status_code == 200:
        return resp.json()["access"]

    raise SystemExit(
        f"Could not authenticate with Label Studio at {base_url}.\n"
        f"  Token auth: {test.status_code}\n"
        f"  Refresh exchange: {resp.status_code} {resp.text}"
    )


def fetch_all_tasks(client: httpx.Client, project_id: int) -> list[dict]:
    all_tasks = []
    page = 1
    page_size = 100

    while True:
        resp = client.get(
            "/api/tasks/",
            params={
                "project": project_id,
                "page": page,
                "page_size": page_size,
                "fields": "all",
            },
        )
        resp.raise_for_status()
        data = resp.json()

        if isinstance(data, dict):
            tasks = data.get("tasks", data.get("results", []))
            total = data.get("total", 0)
        else:
            tasks = data
            total = len(data)

        if not tasks:
            break

        all_tasks.extend(tasks)

        if len(all_tasks) >= total:
            break
        page += 1

    return all_tasks


def remap_result(result: list[dict]) -> tuple[list[dict], list[tuple[str, str]]]:
    """Remap class names in a result array. Returns (new_result, changes).

    Each change is (old_class, new_class).
    """
    new_result = []
    changes = []
    for r in result:
        r_copy = dict(r)
        if r_copy.get("type") == "rectanglelabels":
            value = dict(r_copy.get("value", {}))
            labels = list(value.get("rectanglelabels", []))
            for i, label in enumerate(labels):
                if label in RENAME_MAP:
                    changes.append((label, RENAME_MAP[label]))
                    labels[i] = RENAME_MAP[label]
            value["rectanglelabels"] = labels
            r_copy["value"] = value
        new_result.append(r_copy)
    return new_result, changes


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate taxonomy class names.")
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--project-id", type=int, required=True)
    parser.add_argument("--url", default=DEFAULT_LS_URL)
    args = parser.parse_args()

    access_token = resolve_token(args.url, args.api_key)
    client = httpx.Client(
        base_url=args.url,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=60.0,
    )

    print("Fetching all tasks...")
    tasks = fetch_all_tasks(client, args.project_id)
    print(f"Fetched {len(tasks)} tasks.\n")

    # --- Dry run: collect all changes ---
    planned_changes: list[dict] = []

    for task in tasks:
        task_id = task["id"]

        annotations = task.get("annotations") or []
        for anno in annotations:
            _, changes = remap_result(anno.get("result", []))
            for old_cls, new_cls in changes:
                planned_changes.append(
                    {
                        "task_id": task_id,
                        "item_type": "annotation",
                        "item_id": anno["id"],
                        "old_class": old_cls,
                        "new_class": new_cls,
                    }
                )

        drafts = task.get("drafts") or []
        for draft in drafts:
            _, changes = remap_result(draft.get("result", []))
            for old_cls, new_cls in changes:
                planned_changes.append(
                    {
                        "task_id": task_id,
                        "item_type": "draft",
                        "item_id": draft["id"],
                        "old_class": old_cls,
                        "new_class": new_cls,
                    }
                )

    if not planned_changes:
        print("No class names need renaming. Nothing to do.")
        return

    # Summarize by rename
    from collections import Counter

    rename_counts: Counter[tuple[str, str]] = Counter()
    anno_item_ids: set[int] = set()
    draft_item_ids: set[int] = set()
    task_ids: set[int] = set()

    for c in planned_changes:
        rename_counts[(c["old_class"], c["new_class"])] += 1
        task_ids.add(c["task_id"])
        if c["item_type"] == "annotation":
            anno_item_ids.add(c["item_id"])
        else:
            draft_item_ids.add(c["item_id"])

    print("=" * 60)
    print("DRY RUN SUMMARY")
    print("=" * 60)
    for (old, new), count in rename_counts.most_common():
        print(f"  Will update {count} {old} → {new}")
    print(
        f"\n  Total: {len(planned_changes)} boxes across {len(task_ids)} tasks "
        f"({len(anno_item_ids)} annotations + {len(draft_item_ids)} drafts)"
    )
    print("=" * 60)

    confirm = input("\nProceed? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Aborted.")
        return

    # --- Apply changes ---
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    backup_dir = Path("data/backups")
    backup_dir.mkdir(parents=True, exist_ok=True)
    log_path = backup_dir / f"migration_log_{timestamp}.csv"

    log_rows: list[dict] = []
    updated_annotations: set[int] = set()
    updated_drafts: set[int] = set()

    # Re-process tasks and apply via API
    for task in tasks:
        task_id = task["id"]

        annotations = task.get("annotations") or []
        for anno in annotations:
            anno_id = anno["id"]
            new_result, changes = remap_result(anno.get("result", []))
            if not changes:
                continue
            if anno_id in updated_annotations:
                continue

            resp = client.patch(
                f"/api/annotations/{anno_id}/",
                json={"result": new_result},
            )
            if resp.status_code != 200:
                # Log failure for all boxes in this annotation
                for old_cls, new_cls in changes:
                    log_rows.append(
                        {
                            "task_id": task_id,
                            "item_type": "annotation",
                            "item_id": anno_id,
                            "old_class": old_cls,
                            "new_class": new_cls,
                            "status": f"FAILED ({resp.status_code})",
                        }
                    )
                # Write partial log and abort
                _write_log(log_path, log_rows)
                print(
                    f"\n!!! FAILED: PATCH /api/annotations/{anno_id}/ "
                    f"returned {resp.status_code}"
                )
                print(f"Response: {resp.text[:500]}")
                print(f"Partial log written to {log_path}")
                print(
                    f"Successfully updated {len(updated_annotations)} annotations "
                    f"and {len(updated_drafts)} drafts before failure."
                )
                sys.exit(1)

            updated_annotations.add(anno_id)
            for old_cls, new_cls in changes:
                log_rows.append(
                    {
                        "task_id": task_id,
                        "item_type": "annotation",
                        "item_id": anno_id,
                        "old_class": old_cls,
                        "new_class": new_cls,
                        "status": "OK",
                    }
                )

        drafts = task.get("drafts") or []
        for draft in drafts:
            draft_id = draft["id"]
            new_result, changes = remap_result(draft.get("result", []))
            if not changes:
                continue
            if draft_id in updated_drafts:
                continue

            resp = client.patch(
                f"/api/drafts/{draft_id}/",
                json={"result": new_result},
            )
            if resp.status_code != 200:
                for old_cls, new_cls in changes:
                    log_rows.append(
                        {
                            "task_id": task_id,
                            "item_type": "draft",
                            "item_id": draft_id,
                            "old_class": old_cls,
                            "new_class": new_cls,
                            "status": f"FAILED ({resp.status_code})",
                        }
                    )
                _write_log(log_path, log_rows)
                print(
                    f"\n!!! FAILED: PATCH /api/drafts/{draft_id}/ " f"returned {resp.status_code}"
                )
                print(f"Response: {resp.text[:500]}")
                print(f"Partial log written to {log_path}")
                print(
                    f"Successfully updated {len(updated_annotations)} annotations "
                    f"and {len(updated_drafts)} drafts before failure."
                )
                sys.exit(1)

            updated_drafts.add(draft_id)
            for old_cls, new_cls in changes:
                log_rows.append(
                    {
                        "task_id": task_id,
                        "item_type": "draft",
                        "item_id": draft_id,
                        "old_class": old_cls,
                        "new_class": new_cls,
                        "status": "OK",
                    }
                )

    _write_log(log_path, log_rows)

    print("\nMigration complete.")
    print(f"  Annotations updated: {len(updated_annotations)}")
    print(f"  Drafts updated:      {len(updated_drafts)}")
    print(f"  Total boxes renamed: {len(log_rows)}")
    print(f"  Log written to:      {log_path}")
    print("\nNext: re-run audit_annotations.py to verify, then reload the config.")


def _write_log(path: Path, rows: list[dict]) -> None:
    fieldnames = ["task_id", "item_type", "item_id", "old_class", "new_class", "status"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
