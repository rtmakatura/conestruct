"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  name: string;
  updatedLabel: string;
  createdByLabel: string;
}

export function PlanRow({ id, name, updatedLabel, createdByLabel }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraftName(name);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftName(name);
  };

  const commitEdit = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === name) {
      cancelEdit();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        cancelEdit();
      }
    } catch {
      cancelEdit();
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/plans/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmingDelete(false);
        router.refresh();
      }
    } catch {
      // leave modal open so user can retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <tr className="group border-b border-[color:var(--rule)] hover:bg-[color:var(--canvas-tint)] transition-colors">
        <td className="py-3 px-4">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={onKeyDown}
              disabled={busy}
              className="w-full bg-[color:var(--canvas)] border border-[color:var(--cyan)] px-2 py-1 text-[14px] text-white outline-none disabled:opacity-50"
            />
          ) : (
            <Link
              href={`/app/plans/${id}`}
              className="text-white hover:text-[color:var(--cyan)] font-medium text-[14px]"
            >
              {name}
            </Link>
          )}
        </td>
        <td className="py-3 px-4 text-[color:var(--ink-on-dark-faint)] text-[13px] font-mono">
          {updatedLabel}
        </td>
        <td className="py-3 px-4 text-[color:var(--ink-on-dark-faint)] text-[13px]">
          {createdByLabel}
        </td>
        <td className="py-3 px-2 w-[80px]">
          {!editing && (
            <span className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={startEdit}
                className="p-1.5 hover:bg-[color:var(--rule)] text-[color:var(--ink-on-dark-faint)] hover:text-white transition-colors"
                aria-label={`Rename ${name}`}
                title="Rename"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="p-1.5 hover:bg-[color:var(--rule)] text-[color:var(--ink-on-dark-faint)] hover:text-[color:var(--orange)] transition-colors"
                aria-label={`Delete ${name}`}
                title="Delete"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </span>
          )}
        </td>
      </tr>

      {confirmingDelete && (
        <DeleteConfirmModal
          name={name}
          busy={busy}
          onConfirm={onDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}

function DeleteConfirmModal({
  name,
  busy,
  onConfirm,
  onCancel,
}: {
  name: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="border border-[color:var(--rule)] bg-[color:var(--canvas-tint)] p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--orange)] mb-3">
          Confirm · Delete
        </div>
        <h2 className="text-white text-[18px] font-semibold mb-2">
          Delete this plan?
        </h2>
        <p className="text-[color:var(--ink-on-dark-faint)] text-[14px] mb-5">
          &ldquo;<span className="text-white">{name}</span>&rdquo; will be
          permanently removed. This can&rsquo;t be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 font-sans text-[13px] text-[color:var(--ink-on-dark)] hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 font-sans text-[13px] bg-[color:var(--orange)] text-[color:var(--canvas)] hover:bg-white disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
