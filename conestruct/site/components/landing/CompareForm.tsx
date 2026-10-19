"use client";

// Landing v2, "Send us a job you've already permitted".  The labels and
// placeholders are the lean page's (design/landing-v2/lean-page/); the
// names are the ones cc-prompt-landing-v2-form.md gives the route, and
// the payload is unchanged: phone and notes sit closed behind "+ Add a
// phone number or a note" and still submit.  It posts to /api/contact
// (#346); on success the form is replaced by its confirmation, and any
// refusal shows the honest inline error (ruling 5).
//
// "Kind of work" is radio chips (the plain name only; the wire value was
// always the name) and "Hours" a two-part segmented radio: native inputs,
// visually hidden, the visible state from :checked.

import { useState } from "react";
import { HONEYPOT, KINDS } from "@/lib/contact/validate";
import { FALLBACK_EMAIL, SEND_ERROR, useContactSubmit, type Status } from "./useContactSubmit";

function Field({
  id,
  name,
  label,
  optional,
  span,
  ...input
}: {
  span: string;
  id: string;
  name: string;
  label: string;
  optional?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`lv-field ${span}`}>
      <label htmlFor={id} className="lv-field-label">
        {label}
        {optional && <span className="lv-optional"> (optional)</span>}
      </label>
      <input id={id} name={name} className="lv-input" {...input} />
    </div>
  );
}

/** Hidden from people and from the tab order; a bot fills it in. */
export function Honeypot({ id }: { id: string }) {
  return (
    <div className="lv-pot" aria-hidden="true">
      <label htmlFor={id}>Leave this empty</label>
      <input id={id} name={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

/** The one inline error every refusal shows (ruling 5). */
export function SendError({ status }: { status: Status }) {
  if (status !== "error") return null;
  return (
    <p role="alert" className="lv-small lv-send-error">
      <span aria-hidden="true">⚠ </span>
      {SEND_ERROR} <a href={`mailto:${FALLBACK_EMAIL}`}>{FALLBACK_EMAIL}</a>.
    </p>
  );
}

export function CompareForm() {
  const { status, onSubmit, doneRef } = useContactSubmit("job");
  const [more, setMore] = useState(false);
  if (status === "sent")
    return (
      <div ref={doneRef} tabIndex={-1} className="lv-form lv-sent">
        <p className="lv-body-15">Got it. Check your inbox for a confirmation.</p>
      </div>
    );
  return (
    <form className="lv-form" aria-label="Send us a past job" onSubmit={onSubmit}>
      <Honeypot id="c-website" />
      <div className="lv-fgrid">
        <Field span="lv-s3" required id="c-name" name="name" label="Name" type="text" autoComplete="name" />
        <Field span="lv-s3" required id="c-company" name="company" label="Company" type="text" autoComplete="organization" />
        <Field span="lv-s6" required id="c-email" name="email" label="Work email" type="email" autoComplete="email" />
        <Field span="lv-s4" required id="c-where" name="where" label="Where does the work start?" type="text" placeholder="Address or cross streets" />
        <Field span="lv-s2" required id="c-city" name="city" label="City" type="text" />
        <fieldset className="lv-fs-plain lv-s6">
          <legend className="lv-field-legend">Kind of work</legend>
          <div className="lv-opts">
            {KINDS.map((k) => (
              <label key={k} className="lv-opt">
                <input type="radio" name="kind" value={k} className="lv-vh" required />
                <span className="lv-opt-box">
                  <span aria-hidden="true" className="lv-opt-dot" />
                  <span className="lv-opt-title">{k}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field span="lv-s2" required id="c-side" name="side" label="Side of the road" type="text" placeholder="e.g. south side" />
        <div className="lv-field lv-s2">
          <label htmlFor="c-length" className="lv-field-label">
            Length
          </label>
          <div className="lv-unit-wrap">
            <input
              id="c-length"
              name="length_ft"
              required
              type="text"
              inputMode="numeric"
              className="lv-input lv-input-unit"
            />
            <span aria-hidden="true" className="lv-unit">
              ft
            </span>
          </div>
        </div>
        <fieldset className="lv-fs-plain lv-s2">
          <legend className="lv-field-legend">Hours</legend>
          <div className="lv-segs">
            {["Daytime", "Night"].map((h) => (
              <label key={h} className="lv-seg">
                <input type="radio" name="hours" value={h} className="lv-vh" required />
                <span className="lv-seg-box">{h}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="lv-s6">
          <button
            type="button"
            className="lv-textlink lv-reveal"
            aria-expanded={more}
            aria-controls="c-more"
            onClick={() => setMore((m) => !m)}
          >
            <span aria-hidden="true">{more ? "−" : "+"}</span> Add a phone number or a note
          </button>
        </div>
        <div id="c-more" className="lv-fgrid lv-s6" hidden={!more}>
          <Field span="lv-s3" id="c-phone" name="phone" label="Phone" optional type="tel" autoComplete="tel" placeholder="(303) 555-0100" />
          <div className="lv-field lv-s6">
            <label htmlFor="c-notes" className="lv-field-label">
              Anything else?<span className="lv-optional"> (optional)</span>
            </label>
            <textarea
              id="c-notes"
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="Posted speed, lane count, dates, or what the approved plan called for"
              className="lv-input lv-textarea"
            />
          </div>
        </div>
      </div>

      <div className="lv-submit">
        <SendError status={status} />
        <div className="lv-submit-row">
          <button type="submit" className="lv-pri" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send us the job"}
          </button>
          <p className="lv-submit-note">We&apos;ll email a confirmation. Reply to it with the approved plan.</p>
        </div>
        <p className="lv-mono-note">used only to draft your comparison</p>
      </div>
    </form>
  );
}
