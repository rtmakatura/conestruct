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
export const NOTIFY_SUBJECT = "Conestruct: let me know when it opens";
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
  callout: "You mark the work. The rest is laid out around it.",
  note: "Illustration. A real plan is drawn on the road you pick.",
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

// R22: the three step bodies are Ryan's, verbatim.
// Arc 3 (R15): 01 is one road drawn three times — the pin → job → plan
// strip — with the three step texts under it.
export const HOW = {
  n: "01",
  title: "How a plan is made",
  prov: "pin · job · plan",
  // The artboard's name for the whole strip (design/FullPage.dc.html).
  // The strip is drawn as three stations so a phone can stack them, so
  // the drawings are decorative and this sentence is read once, before
  // them.
  strip:
    "One road drawn three times, left to right: a pin marks where the work starts; the work gets its length and side; then the full plan is laid out around it.",
  steps: [
    {
      step: "STEP 1 · PIN",
      title: "Mark the work",
      body: "Type an address or two cross streets, or drop a pin. It's how an 811 ticket already describes a job. Conestruct finds the road, which way it runs, and whose road it is.",
      label: "work starts here",
    },
    {
      step: "STEP 2 · JOB",
      title: "Say what the job is",
      body: "Tell it the kind of work, how long, and which side. The road's own details come filled in for you to check. The kind of work is always your call.",
      label: "the work · its length · its side",
    },
    {
      step: "STEP 3 · PLAN",
      title: "Take the plan",
      body: "You get the drawing and the device count, with a contractor estimate one click away. Anything that needs a person shows up first. Everything that passed is there when you want it.",
      label: "laid out around it",
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
  title: "Every number shows where it came from",
  question: "Where did that number come from?",
  body: "Every taper, buffer and spacing in the plan's audit carries its citation: the MUTCD 2023 section, table or figure, or the CDOT S-630-1 sheet it came from. The person who reviews the plan can check it in one step. Where a value needs a person, the plan flags it.",
  prov: "some of the references it cites",
  // A2-Q6: only the four verified by subject (checkpoint-arc2.md §3).
  // Each is a string the product already emits, so the citation counter
  // stays at 19.
  chips: ["MUTCD 2023 · Table 6B-1", "§6B.06", "Table 6B-3", "CDOT S-630-1 · Sheet 10"],
  // R15: the taper-and-buffer detail.  An illustration: dimension LINES,
  // no values (checkpoint-arc3.md §3) — the buffer empty and the devices
  // on the lane line through the work (A2-Q5).
  detail: {
    label: "DETAIL · TAPER AND BUFFER",
    scale: "not to scale",
    work: "WORK",
    dims: ["taper", "buffer", "spacing"],
    note: "source cited in the audit",
    aria: "Detail of a taper and buffer. Dimension lines mark the taper, the buffer and the device spacing; all three lead to one note: source cited in the audit.",
  },
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
  // R15: the connector between the two cards.
  same: "same plan",
} as const;

// R17, section 05, verbatim — except the third paragraph's middle
// clause, which is A3-Q1's: "every number" is not true today (lane and
// shoulder widths are assumed, device rates are built in;
// checkpoint-arc3.md Q1), so it says what the hero and 02 say.
export const FOUNDERS = {
  n: "05",
  title: "Why we're building it",
  prov: "a note from the founders",
  headline: "Ninety years of hard-won rules.",
  // "1935": FHWA, The Evolution of MUTCD — "On November 7, 1935, the
  // first edition of MUTCD was approved as a National standard"
  // (arc3-evidence/fhwa-kno-history.htm).
  paragraphs: [
    "The first national manual on traffic control devices came out in 1935. Every edition since has added what the last one learned: how far ahead a driver needs warning, how long a merge has to be, how much room a crew needs to work safely.",
    "That knowledge is public, and it's precise. Applying it to one specific road, at its speed, its lane widths and its side, is careful work every single time.",
    "We think the people who set the cones deserve tools as good as the rules they work under. So we're building one. It applies the manual to your road, shows the source for every taper, buffer and spacing, and leaves the calls that need experience to the people who have it.",
  ],
  signoff: "The founders",
  // R24: Ryan, James, Zac, top to bottom (supersedes R23's order).  A
  // photo is a file in public/founders/ plus its path here; without one
  // the row shows the founder's initial in a placeholder square.
  people: [
    { name: "Ryan", role: "PRODUCT & ENGINEERING", photo: "/founders/ryan.jpg" },
    { name: "James", role: "GO-TO-MARKET & PRICING", photo: null },
    { name: "Zac", role: "SALES & CUSTOMERS", photo: null },
  ],
} as const;

export const CLOSE = {
  title: "Built in Colorado",
  body: "For the people who set the cones, and the people who price them.",
  // The design's "↑" pointed back up the page to the form.  Under A2-Q1
  // the link opens a mail client instead, so the arrow would promise a
  // scroll that does not happen.
  link: "Get notified",
  // R18's drawn map.  A3-Q4: its name says it is a drawing, not a road
  // map (positions are plotted from lat/long, checkpoint-arc3.md §3).
  map: {
    aria: "Drawing of Colorado, not a road map: mountains west of the Front Range, I-25 north–south and I-70 east–west crossing at Denver, which is pinned.",
    state: "COLORADO",
    pinned: "denver",
    roads: ["I-25", "I-70"],
    cities: ["fort collins", "colorado springs", "pueblo", "grand junction", "durango"],
  },
} as const;

// R13 / R14 — the milepost road and its marker.  The stretch words and
// colours are NOT here: they are ZONE_LABEL / ZONE_COLOR (R9, one
// source), read by lib/coming-soon-road.ts.
export const ROAD = {
  aria: "A road runs down the left edge. As you scroll, it draws itself and fades in ahead of you through the lane closure: advance warning, taper, buffer, the work, and downstream.",
  work: "WORK",
  milepost: "MILEPOST",
  posts: ["01", "02", "03", "04", "CO"],
} as const;

// R19 — the 404 (design/NotFound.dc.html).
export const NOT_FOUND = {
  title: "Road closed · Conestruct",
  step: "SHEET",
  sheet: "404 · PAGE NOT FOUND",
  scale: "not to scale",
  barricade: "barricade",
  sign: ["ROAD", "CLOSED"],
  detour: "DETOUR",
  detourTo: "to conestruct.com",
  note: "This page isn't here. The way home is open.",
  aria: "A road closed with a barricade and a Road Closed sign. A dashed detour line leaves the road before the barricade and leads back to the Conestruct home page.",
  heading: "This road is closed.",
  body: "The page you were looking for isn't here. The detour takes you home.",
  home: "Back to conestruct.com",
} as const;
