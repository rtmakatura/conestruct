"use client";

import { useEffect, useRef, useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import type { ScenarioParams } from "@/lib/compute";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  params: ScenarioParams;
  planId: string | null;
  planName: string | null;
  onSaved: (id: string, name: string) => void;
}

export function PlanSaveButton({ params, planId, planName, onSaved }: Props) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen]);

  useEffect(() => {
    if (status !== "saved" && status !== "error") return;
    const t = setTimeout(() => setStatus("idle"), status === "saved" ? 2500 : 3500);
    return () => clearTimeout(t);
  }, [status]);

  const doCreate = async (name: string) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, data: params }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const row = await res.json();
      onSaved(row.id, row.name);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const doUpdate = async () => {
    if (!planId || !planName) return;
    setStatus("saving");
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: planName, data: params }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const row = await res.json();
      onSaved(row.id, row.name);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const onClick = () => {
    if (status === "saving") return;
    if (planId) {
      doUpdate();
    } else {
      setNameDraft(params.project || "Untitled plan");
      setPopoverOpen(true);
    }
  };

  const onConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setPopoverOpen(false);
    doCreate(trimmed);
  };

  const label = (() => {
    if (status === "saving") return "Saving…";
    if (status === "saved") return "Saved";
    if (status === "error") return "Save failed";
    return "Save";
  })();

  return (
    <div className="relative flex items-stretch">
      <button
        type="button"
        onClick={onClick}
        disabled={status === "saving"}
        className="flex items-center px-5 border-l border-[color:var(--rule)] font-sans font-medium text-[13px] text-[color:var(--ink-on-dark)] hover:text-white hover:bg-[color:var(--rule)] transition-colors disabled:opacity-50"
      >
        {label}
      </button>
      {popoverOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-px w-[320px] z-40 border border-[color:var(--rule)] bg-[color:var(--canvas-tint)] p-4 shadow-xl"
        >
          <form onSubmit={onConfirm}>
            <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)] mb-2">
              Plan name
            </label>
            <input
              autoFocus
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full bg-[color:var(--canvas)] border border-[color:var(--rule)] px-3 py-2 text-[13px] text-white outline-none focus:border-[color:var(--cyan)]"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setPopoverOpen(false)}
                className="px-3 py-1.5 font-sans text-[12px] text-[color:var(--ink-on-dark-faint)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!nameDraft.trim()}
                className="px-3 py-1.5 font-sans text-[12px] bg-[color:var(--cyan)] text-[color:var(--canvas)] disabled:opacity-50 hover:bg-white"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function PlanSignInToSaveButton() {
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className="flex items-center px-5 border-l border-[color:var(--rule)] font-sans font-medium text-[13px] text-[color:var(--ink-on-dark)] hover:text-white hover:bg-[color:var(--rule)] transition-colors"
      >
        Sign in to save
      </button>
    </SignInButton>
  );
}
