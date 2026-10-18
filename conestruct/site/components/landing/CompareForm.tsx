"use client";

// Landing v2, section 07: "Send us a past job".  The fields, labels and
// placeholders are the reference's; the names are the ones
// cc-prompt-landing-v2-form.md gives the route.  It posts to /api/contact
// (#346); on success the form is replaced by its confirmation, and any
// refusal shows the honest inline error (ruling 5).
//
// "Kind of work" is radio tiles and "Hours" a two-part segmented radio:
// native inputs, visually hidden, the visible state from :checked.

import { HONEYPOT } from "@/lib/contact/validate";
import { FALLBACK_EMAIL, SEND_ERROR, useContactSubmit, type Status } from "./useContactSubmit";

const KINDS = [
  { value: "Shoulder work", note: "TA-3 / TA-5 · S-630-1" },
  { value: "Flagger lane closure", note: "TA-10 · S-630-1" },
  { value: "Lane closure near an intersection", note: "cases 18 / 19 · S-630-1" },
  { value: "Something else", note: "tell us below" },
];

function Field({
  id,
  name,
  label,
  optional,
  ...input
}: {
  id: string;
  name: string;
  label: string;
  optional?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="lv-field">
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

function Legend({ n, title, optional }: { n: string; title: string; optional?: boolean }) {
  return (
    <legend className="lv-legend-row">
      <span className="lv-faint">{n}</span>
      {title}
      {optional && <span className="lv-faint lv-legend-opt">optional</span>}
    </legend>
  );
}

export function CompareForm() {
  const { status, onSubmit, doneRef } = useContactSubmit("job");
  if (status === "sent")
    return (
      <div ref={doneRef} tabIndex={-1} className="lv-form lv-sent">
        <p className="lv-body-15">Got it. Check your inbox for a confirmation.</p>
      </div>
    );
  return (
    <form className="lv-form" aria-label="Send us a past job" onSubmit={onSubmit}>
      <Honeypot id="c-website" />
      <fieldset className="lv-fs">
        <Legend n="01" title="YOU" />
        <div className="lv-fields">
          <Field required id="c-name" name="name" label="Name" type="text" autoComplete="name" placeholder="First and last" />
          <Field required id="c-company" name="company" label="Company" type="text" autoComplete="organization" placeholder="Company name" />
          <Field required id="c-email" name="email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" />
          <Field id="c-phone" name="phone" label="Phone" optional type="tel" autoComplete="tel" placeholder="(303) 555-0100" />
        </div>
      </fieldset>

      <fieldset className="lv-fs lv-fs-next">
        <Legend n="02" title="THE JOB" />
        <div className="lv-fields">
          <Field required id="c-where" name="where" label="Where does the work start?" type="text" placeholder="Address or cross streets" />
          <Field required id="c-city" name="city" label="City" type="text" placeholder="Denver" />
        </div>
        <fieldset className="lv-fs-plain">
          <legend className="lv-field-legend">Kind of work</legend>
          <div className="lv-opts">
            {KINDS.map((k) => (
              <label key={k.value} className="lv-opt">
                <input type="radio" name="kind" value={k.value} className="lv-vh" required />
                <span className="lv-opt-box">
                  <span aria-hidden="true" className="lv-opt-dot" />
                  <span className="lv-opt-title">{k.value}</span>
                  <span />
                  <span className="lv-opt-note">{k.note}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="lv-fields">
          <Field required id="c-side" name="side" label="Side of the road" type="text" placeholder="South side, eastbound" />
          <div className="lv-field">
            <label htmlFor="c-length" className="lv-field-label">
              Length of the work
            </label>
            <div className="lv-unit-wrap">
              <input
                id="c-length"
                name="length_ft"
                required
                type="text"
                inputMode="numeric"
                placeholder="1,000"
                className="lv-input lv-input-unit"
              />
              <span aria-hidden="true" className="lv-unit">
                ft
              </span>
            </div>
          </div>
        </div>
        <fieldset className="lv-fs-plain">
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
        <div className="lv-field">
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
      </fieldset>

      <fieldset className="lv-fs lv-fs-next">
        <Legend n="03" title="THE APPROVED PLAN" optional />
        <p className="lv-small lv-on-dark">
          Once you send this, we&apos;ll email you a confirmation. Reply to it with the approved plan and we&apos;ll send
          ours back beside it.
        </p>
      </fieldset>

      <div className="lv-submit">
        <SendError status={status} />
        <button type="submit" className="lv-pri lv-pri-block" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send us the job"}
        </button>
        <p className="lv-mono-note lv-center">used only to draft your comparison</p>
      </div>
    </form>
  );
}
