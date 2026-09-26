// Every word on the coming-soon page, in one place (coming-soon-gate R5 /
// R5a: "build it so copy and layout are easy to change").  The layout is
// in components/coming-soon/; nothing there types a sentence.
//
// Wording is A2-Q6: the replacements proposed in checkpoint-arc2.md §3,
// each checked against the product (file:line there).  One change of
// spelling only: "labor", the site's own (QuotePanel's "labor rates"),
// not the checkpoint's "labour" (P2, one voice).

import { PUBLIC_LINE } from "./public-copy";

// A2-Q1: no form in Arc 2.  "Get notified" is a mail link.
export const NOTIFY_EMAIL = "ryan@conestruct.com";
export const NOTIFY_SUBJECT = "Conestruct — let me know when it opens";
export const NOTIFY_HREF = `mailto:${NOTIFY_EMAIL}?subject=${encodeURIComponent(NOTIFY_SUBJECT)}`;

export const NAV = {
  how: "How it works",
  sources: "Sources",
  notify: "Get notified",
} as const;

export const SHEET = {
  step: "SHEET",
  title: "Coming soon",
  standards: "colorado · mutcd 2023 · cdot s-630-1",
} as const;

// A2-Q6: the label names no disabled kind (the multilane lane closure is
// not enabled, src/api/render_api.py ENABLED_SCENARIOS).  The right-lane
// train is the live near-intersection kind's approach.
export const DRAWING = {
  label: "ILLUSTRATION · RIGHT LANE CLOSED",
  scale: "not to scale",
  callout: "you mark the work — the rest is laid out around it",
  note: "illustration · a real plan is drawn on the road you pick",
  work: "WORK",
  aria:
    "Illustration of a plan drawing: the right lane of a one-direction road closed for work. Advance warning signs, a merging taper and an empty buffer lead up to the work; devices line the closed lane through the work area, and a downstream taper follows. Not to scale.",
} as const;

export const HERO = {
  step: "A TRAFFIC CONTROL PLAN GENERATOR · COMING SOON",
  stepPhone: "A TRAFFIC CONTROL PLAN GENERATOR",
  // One voice (P2): the page metadata says the same sentence.
  line: PUBLIC_LINE,
  howLink: "How a plan is made ↓",
  sourcesLink: "What it cites ↓",
} as const;

export const TITLE_BLOCK: readonly (readonly [string, string])[] = [
  ["PROJECT", "Conestruct"],
  ["STATUS", "Coming soon"],
  ["STANDARD", "MUTCD 2023 · CDOT S-630-1"],
  ["REGION", "Colorado"],
  ["OUTPUT", "Draft plans for licensed review"],
];

export const NOTIFY = {
  question: "Want to know when it opens?",
  button: "Get notified",
  line: "Email us and we'll write back once, when Conestruct opens.",
} as const;

export const HOW = {
  n: "01",
  title: "How a plan is made",
  prov: "pin · job · plan",
  steps: [
    {
      step: "STEP 1",
      title: "Mark the work",
      body: "An address, a cross-street pair, or a pin — the way an 811 ticket describes it. The system finds the road, its direction and who owns it.",
      label: "work starts here",
    },
    {
      step: "STEP 2",
      title: "Say what the job is",
      body: "Kind of work, length, which side. The road's own details come filled in for you to check — the kind of work is always yours to confirm.",
      label: "the work · its length · its side",
    },
    {
      step: "STEP 3",
      title: "Take the plan",
      body: "The drawing and the device count, with a contractor estimate one click away — anything that needs a person flagged first, everything that passed one click away.",
      label: null,
    },
  ],
} as const;

export const HAND_OVER = {
  n: "02",
  title: "What you hand over",
  prov: "each one written for the person who reads it",
  items: [
    {
      step: "FOR THE BID",
      title: "The plan sheet",
      body: "The traffic control drawing, laid out on the road you picked.",
    },
    {
      step: "FOR THE PRICE",
      title: "The count and the quote",
      body: "Every device the plan calls for, and an estimate at your labor rates and markup.",
    },
    {
      step: "FOR THE REVIEWER",
      title: "The audit",
      body: "Every check the system ran, and the MUTCD or CDOT source behind each taper, buffer and spacing.",
    },
    {
      step: "FOR THE CREW",
      title: "The crew sheet",
      body: "What to set and where, written for the people setting it.",
    },
  ],
} as const;

export const SOURCES = {
  n: "03",
  title: "Every dimension has a source",
  question: "Where did that number come from?",
  body: "Every taper, buffer and spacing in the plan's audit carries its citation — the MUTCD 2023 section, table or figure, or the CDOT S-630-1 sheet it came from — so the person who reviews the plan can check it in one step. Where a value needs a person, the plan flags it rather than hiding it.",
  prov: "some of the references it cites",
  // A2-Q6: only the four verified by subject (checkpoint-arc2.md §3).
  // Each is a string the product already emits, so the citation counter
  // stays at 19.
  chips: ["MUTCD 2023 · Table 6B-1", "§6B.06", "Table 6B-3", "CDOT S-630-1 · Sheet 10"],
} as const;

export const WHO = {
  n: "04",
  title: "Who it's for",
  prov: "traffic-control subcontractors · colorado first",
  // FLOW.md §1's two readers.
  people: [
    {
      step: "IN THE FIELD",
      title: "The sales rep with a bid due today",
      body: "On site or just back from it, on a laptop or a phone. Knows where the work is. Leaves with a plan and a price to attach to the bid.",
    },
    {
      step: "AT THE DESK",
      title: "The estimator pricing a job",
      body: "Works from a description or a set of coordinates. Needs a device count that drives the number, and can come back to change one thing and see what it did.",
    },
  ],
} as const;

export const CLOSE = {
  title: "Built in Colorado",
  body: "For the people who set the cones, and the people who price them.",
  // The design's "↑" pointed back up the page to the form.  Under A2-Q1
  // the link opens a mail client instead, so the arrow would promise a
  // scroll that does not happen.
  link: "Get notified",
} as const;
