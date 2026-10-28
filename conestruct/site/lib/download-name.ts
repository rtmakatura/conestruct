// #401 (W11): the base name every public download is saved under.
//
// A plan with a project name keeps it, cleaned exactly as before.  A plan
// without one (every sandbox plan) is named for its road, its kind, the
// day it was downloaded and a 6-hex fingerprint of the plan itself, e.g.
// "East-Colfax-Avenue_shoulder_2026-10-27_3fa91c", so two plans in one
// Downloads folder don't collide as "plan (1).pdf" (two sides of one road,
// or two lengths, differ in the fingerprint) and the name says which plan
// it is.  The same plan downloaded again keeps its name.  No road
// confirmed: the kind, the day and the fingerprint.
// Pure and client-safe: the cards, the quote panel, the zip button and the
// bundle route all name files through it.
import type { Scenario } from "@/lib/scenarios";

function cleanProject(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_");
}

// Road names and kinds become hyphenated words, so "_" separates the parts.
function slug(text: string): string {
  return text
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The local calendar day, YYYY-MM-DD.
function day(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// FNV-1a (32-bit) of the plan as sent, without the Generate's signed scan
// token (a new token for the same inputs is the same plan), as 6 hex
// characters.  CHOSEN (#401, rulings.md call 6): long enough that two plans
// downloaded in one session practically never share it, short enough to
// read.  Not a security hash; it only tells plans apart.
export function planFingerprint(scenario: Scenario): string {
  const scan = (scenario as { site_scan?: Record<string, unknown> | null }).site_scan;
  const plan = scan ? { ...scenario, site_scan: { ...scan, token: undefined } } : scenario;
  const text = JSON.stringify(plan) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}

export function planBaseName(scenario: Scenario, now: Date = new Date()): string {
  const project = cleanProject(scenario.meta?.project ?? "");
  if (project) return project;
  const candidate = scenario.meta?.confirmedRoad?.candidate;
  const road = slug(candidate?.name ?? candidate?.ref ?? "");
  const kind = slug(scenario.kind ?? "") || "plan";
  return [road, kind, day(now), planFingerprint(scenario)].filter(Boolean).join("_");
}

export function planFilename(scenario: Scenario, ext: string, now: Date = new Date()): string {
  return `${planBaseName(scenario, now)}.${ext}`;
}

export function packageFilename(scenario: Scenario, now: Date = new Date()): string {
  return `${planBaseName(scenario, now)}_package.zip`;
}
