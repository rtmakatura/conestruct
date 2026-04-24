"""
Audit Label Studio annotations: count label instances and drafts per class,
plus task-level summary.

Usage:
    python -m src.labeling.audit_annotations \
        --api-key YOUR_KEY \
        --project-id 4

Task JSON shape reference (from /api/tasks/?fields=all):
    {
      "id": 1,
      "annotations": [          # list or None; None when fields!=all
        {
          "id": 1,
          "result": [            # list of label instances
            {
              "type": "rectanglelabels",
              "value": {
                "x": 45.3, "y": 47.9, "width": 0.79, "height": 1.23,
                "rectanglelabels": ["DRUM_36"]
              }, ...
            }, ...
          ], ...
        }
      ],
      "drafts": [               # list; same shape as annotations
        {
          "result": [ ... ],
          ...
        }
      ],
      "total_annotations": 1,
      ...
    }

Key insight: the task list endpoint returns annotations=None unless
you pass fields=all. Individual task endpoint (/api/tasks/{id}/)
always includes annotations.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

import httpx

DEFAULT_LS_URL = "http://localhost:8080"

EXPECTED_CLASSES = {
    "CONE",
    "DRUM",
    "TUBULAR_MARKER",
    "BARRICADE_TYPE_II",
    "BARRICADE_TYPE_III",
    "LONGITUDINAL_CHANNELIZER",
    "ARROW_BOARD",
    "PCMS",
    "TRUCK_MOUNTED_ATTENUATOR",
    "TEMPORARY_BARRIER",
    "FLAGGER_STATION",
    "TEMPORARY_SIGNAL",
    "SIGN_GENERIC",
    "DETOUR_MARKER",
    "CHANNELIZER_OPTIONAL",
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


def extract_class_names(results: list[dict]) -> list[str]:
    """Extract class names from annotation/draft result entries."""
    names = []
    for r in results:
        if r.get("type") != "rectanglelabels":
            continue
        labels = r.get("value", {}).get("rectanglelabels", [])
        names.extend(labels)
    return names


def fetch_all_tasks(client: httpx.Client, project_id: int) -> list[dict]:
    """Fetch all tasks with full annotations/drafts via pagination."""
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit Label Studio annotations.")
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

    tasks = fetch_all_tasks(client, args.project_id)

    annotation_counts: Counter[str] = Counter()
    draft_counts: Counter[str] = Counter()
    tasks_total = len(tasks)
    tasks_annotated = 0
    tasks_with_drafts = 0

    for task in tasks:
        annotations = task.get("annotations") or []
        drafts = task.get("drafts") or []

        if annotations:
            tasks_annotated += 1
            for anno in annotations:
                names = extract_class_names(anno.get("result", []))
                annotation_counts.update(names)

        if drafts:
            tasks_with_drafts += 1
            for draft in drafts:
                names = extract_class_names(draft.get("result", []))
                draft_counts.update(names)

    tasks_unannotated = tasks_total - tasks_annotated - tasks_with_drafts

    # Print results
    print("=" * 60)
    print("ANNOTATION AUDIT")
    print("=" * 60)

    print(
        f"\nTasks: {tasks_total} total, {tasks_annotated} with annotations, "
        f"{tasks_with_drafts} with drafts, {tasks_unannotated} unannotated"
    )

    total_anno_instances = sum(annotation_counts.values())
    print(f"\nIndividual label instances in submitted annotations ({total_anno_instances} total):")
    if annotation_counts:
        for cls, count in annotation_counts.most_common():
            flag = " *** UNEXPECTED ***" if cls not in EXPECTED_CLASSES else ""
            print(f"  {cls:35s} {count:5d}{flag}")
    else:
        print("  (none)")

    total_draft_instances = sum(draft_counts.values())
    print(f"\nIndividual label instances in drafts ({total_draft_instances} total):")
    if draft_counts:
        for cls, count in draft_counts.most_common():
            flag = " *** UNEXPECTED ***" if cls not in EXPECTED_CLASSES else ""
            print(f"  {cls:35s} {count:5d}{flag}")
    else:
        print("  (none)")

    # Check for unexpected classes
    all_classes = set(annotation_counts.keys()) | set(draft_counts.keys())
    unexpected = all_classes - EXPECTED_CLASSES
    if unexpected:
        print(f"\n!!! UNEXPECTED CLASSES FOUND: {unexpected}")
        print("!!! Review before proceeding.")
        sys.exit(1)
    elif all_classes:
        print("\nAll class names match expected 14-class taxonomy.")
    else:
        print("\nNo labels found — project is empty.")


if __name__ == "__main__":
    main()
