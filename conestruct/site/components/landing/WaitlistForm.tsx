"use client";

// The waitlist, under the paid pilot link (#346 "Scope addition"): one email,
// the same route as the job form with `type=waitlist`, the same guards.
// On success the form is replaced by "You're on the list."

import { Honeypot, SendError } from "./CompareForm";
import { useContactSubmit } from "./useContactSubmit";

export function WaitlistForm() {
  const { status, onSubmit, doneRef } = useContactSubmit("waitlist");
  if (status === "sent")
    return (
      <div id="join" ref={doneRef} tabIndex={-1} className="lv-join lv-sent">
        <p className="lv-body-15">You&apos;re on the list.</p>
      </div>
    );
  return (
    <form id="join" className="lv-join" aria-label="Join the waitlist" onSubmit={onSubmit}>
      <Honeypot id="w-website" />
      <label htmlFor="w-email" className="lv-field-label">
        Not ready? Get one email the day it opens.
      </label>
      <div className="lv-join-row">
        <input
          id="w-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="lv-input lv-join-input"
        />
        <button type="submit" className="lv-sec" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Join the waitlist"}
        </button>
      </div>
      <SendError status={status} />
    </form>
  );
}
