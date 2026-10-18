// #346: the three emails, their subjects and escaping, and the due date.
// Expected text is cc-prompt-landing-v2-form.md's, filled in.

import { describe, expect, it } from "vitest";
import { dueBy, receivedAt } from "./dates";
import { confirmation, escapeHtml, notification, subject, waitlistNotification, type Config } from "./emails";
import type { JobSubmission } from "./validate";

const C: Config = {
  to: "ryan@conestruct.com",
  from: "Ryan at Conestruct <ryan@conestruct.com>",
  turnaround: "2 to 3 business days",
  dueDays: 3,
};
const S: JobSubmission = {
  type: "job",
  name: "Dana Ortiz",
  company: "Front Range Traffic",
  email: "dana@frtraffic.com",
  phone: "",
  where: "E Colfax Ave & N Race St",
  city: "Denver",
  kind: "Shoulder work",
  side: "South side, eastbound",
  length_ft: "1,000",
  hours: "Daytime",
  notes: "",
};
// Sat Oct 17 2026, 11:05 AM in Denver (MDT, UTC−6).
const AT = new Date("2026-10-17T17:05:00Z");

describe("the confirmation, to the submitter", () => {
  const e = confirmation(S, C);

  it("addresses, subject and the plain-text body are the prompt's", () => {
    expect([e.from, e.to, e.replyTo, e.subject]).toEqual([
      C.from,
      "dana@frtraffic.com",
      "ryan@conestruct.com",
      "Got your job on E Colfax Ave & N Race St",
    ]);
    expect(e.text).toBe(
      [
        "Hi Dana,",
        "",
        "Thanks for sending over E Colfax Ave & N Race St in Denver. We'll draft it from the road and send back the plan sheet, device list, crew sheet and audit within 2 to 3 business days.",
        "",
        "Have the approved plan for this job? Reply to this email with it attached, and we'll send ours back beside it.",
        "",
        "Here's what you sent us:",
        "Kind of work: Shoulder work",
        "Side of the road: South side, eastbound",
        "Length: 1,000 ft",
        "Hours: Daytime",
        "Notes: none",
        "",
        "If anything's off, just reply and tell me.",
        "",
        "Ryan Makatura",
        "Founder, Conestruct",
        "407-252-2385 · conestruct.com · ryan@conestruct.com",
        "",
      ].join("\n"),
    );
  });

  it("the plain-text part carries the text signature only, no image", () => {
    expect(e.text).not.toContain("email-signature.png");
  });

  it("HTML: the signature image at 400×200 with its alt, then the text signature under it", () => {
    expect(e.html).toContain(
      '<img src="https://conestruct.com/email-signature.png" width="400" height="200" alt="Ryan Makatura, Founder, Conestruct"',
    );
    const img = e.html.indexOf("<img");
    expect(e.html.indexOf("Ryan Makatura<br>Founder, Conestruct<br>407-252-2385")).toBeGreaterThan(img);
  });

  it("HTML escapes the user's values", () => {
    expect(e.html).toContain("E Colfax Ave &amp; N Race St");
    expect(e.html).not.toContain("Ave & N");
  });

  it("notes keep their line breaks in both parts", () => {
    const n = confirmation({ ...S, notes: "35 mph\ntwo lanes" }, C);
    expect(n.text).toContain("Notes: 35 mph\ntwo lanes");
    expect(n.html).toContain("Notes: 35 mph<br>two lanes");
  });
});

describe("the notification, to Ryan", () => {
  const e = notification(S, C, AT);

  it("addresses, subject and the plain-text body are the prompt's", () => {
    expect([e.from, e.to, e.replyTo, e.subject]).toEqual([
      C.from,
      "ryan@conestruct.com",
      "dana@frtraffic.com",
      "Past job: Front Range Traffic · E Colfax Ave & N Race St, Denver",
    ]);
    expect(e.text).toBe(
      [
        "Dana Ortiz, Front Range Traffic",
        "dana@frtraffic.com · no phone",
        "",
        "Where: E Colfax Ave & N Race St, Denver",
        "Kind of work: Shoulder work",
        "Side: South side, eastbound · Length: 1,000 ft · Hours: Daytime",
        "Notes: none",
        "",
        "Received Sat, Oct 17, 2026, 11:05 AM MDT. Due back by Wed Oct 21 (2 to 3 business days).",
        "Hitting reply goes straight to them.",
        "",
      ].join("\n"),
    );
  });

  it("no signature", () => {
    expect(e.text).not.toContain("Ryan Makatura");
    expect(e.html).not.toContain("<img");
  });

  it("a given phone replaces 'no phone'", () => {
    expect(notification({ ...S, phone: "303-555-0100" }, C, AT).text).toContain("dana@frtraffic.com · 303-555-0100");
  });
});

describe("the waitlist notification (ruling: Scope addition)", () => {
  const e = waitlistNotification({ type: "waitlist", email: "pat@example.com" }, C, AT);
  it("one email to CONTACT_TO, subject `Waitlist: {email}`, reply goes to them", () => {
    expect([e.to, e.replyTo, e.subject]).toEqual(["ryan@conestruct.com", "pat@example.com", "Waitlist: pat@example.com"]);
    expect(e.text).toContain("pat@example.com joined the waitlist.");
  });
});

describe("escaping and subjects", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("a script in any field reaches every HTML part escaped", () => {
    const x = "<script>alert(1)</script>";
    const evil = { ...S, name: x, company: x, where: x, city: x, side: x, notes: x, phone: x };
    for (const e of [confirmation(evil, C), notification(evil, C, AT)]) {
      expect(e.html).not.toContain("<script>");
      expect(e.html).toContain("&lt;script&gt;");
    }
  });

  it("subjects stop at 80 characters, the 80th an ellipsis", () => {
    expect(subject("a".repeat(80))).toBe("a".repeat(80));
    expect(subject("a".repeat(81))).toBe("a".repeat(79) + "…");
    const long = notification({ ...S, where: "x".repeat(200) }, C, AT).subject;
    expect([...long]).toHaveLength(80);
    expect(confirmation({ ...S, where: "y".repeat(200) }, C).subject.endsWith("…")).toBe(true);
    expect([...waitlistNotification({ type: "waitlist", email: `${"z".repeat(240)}@x.com` }, C, AT).subject]).toHaveLength(80);
  });
});

describe("dates, on Denver's clock (weekends skipped, holidays not)", () => {
  const cases: [string, string, number, string][] = [
    ["Sat", "2026-10-17T17:05:00Z", 3, "Wed Oct 21"],
    ["Mon", "2026-10-19T15:00:00Z", 3, "Thu Oct 22"],
    ["Wed", "2026-10-21T15:00:00Z", 3, "Mon Oct 26"],
    ["Fri", "2026-10-23T15:00:00Z", 3, "Wed Oct 28"],
    ["Sun", "2026-10-25T15:00:00Z", 1, "Mon Oct 26"],
    // Thanksgiving (Thu Nov 26) is counted: no holiday calendar.
    ["Tue before Thanksgiving", "2026-11-24T15:00:00Z", 3, "Fri Nov 27"],
    // 11:30 PM Friday in Denver is already Saturday in UTC: Denver's date counts.
    ["Fri late (Sat in UTC)", "2026-10-24T05:30:00Z", 1, "Mon Oct 26"],
    // Across the month and year.
    ["Wed Dec 30", "2026-12-30T15:00:00Z", 3, "Mon Jan 4"],
  ];
  for (const [label, iso, n, want] of cases) {
    it(`${label} + ${n} → ${want}`, () => {
      expect(dueBy(new Date(iso), n)).toBe(want);
    });
  }

  it("received is Denver's wall clock with its zone (MDT, then MST)", () => {
    expect(receivedAt(AT)).toBe("Sat, Oct 17, 2026, 11:05 AM MDT");
    expect(receivedAt(new Date("2026-12-01T17:05:00Z"))).toBe("Tue, Dec 1, 2026, 10:05 AM MST");
  });
});
