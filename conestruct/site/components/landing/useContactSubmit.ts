"use client";

// The landing page's two forms post to /api/contact (#346).  The form's
// own named controls are the payload, plus `type` and `elapsed_ms` (the
// 3-second floor, measured from mount: rulings.md S4).  Any non-2xx, or
// no answer at all, is "error": the page shows the honest inline error
// and never a silent success (ruling 5).

import { useEffect, useRef, useState, type FormEvent } from "react";

export type Status = "idle" | "sending" | "sent" | "error";

export const SEND_ERROR = "That didn't send. Try again, or email";
export const FALLBACK_EMAIL = "ryan@conestruct.com";

export function useContactSubmit(type: "job" | "waitlist") {
  const [status, setStatus] = useState<Status>("idle");
  const mountedAt = useRef(0);
  const doneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);
  // The form is replaced by its confirmation; focus follows, so a screen
  // reader lands on (and reads) the new text.
  useEffect(() => {
    if (status === "sent") doneRef.current?.focus();
  }, [status]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...fields, elapsed_ms: Date.now() - mountedAt.current }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return { status, onSubmit, doneRef };
}
