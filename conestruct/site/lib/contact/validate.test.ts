// #346: the contact route's validator.  Field rules are
// cc-prompt-landing-v2-form.md's; the caps are rulings.md S6.

import { describe, expect, it } from "vitest";
import { CAPS, multiLine, oneLine, validate, type JobSubmission } from "./validate";

const JOB = {
  type: "job",
  website: "",
  elapsed_ms: 4000,
  name: "  Dana   Ortiz ",
  company: "Front Range Traffic",
  email: "dana@frtraffic.com",
  phone: "",
  where: "E Colfax Ave & N Race St",
  city: "Denver",
  kind: "Flagger lane closure",
  side: "South side",
  length_ft: "1,000",
  hours: "Night",
  notes: "",
};

const job = (patch: Record<string, unknown>) => validate({ ...JOB, ...patch });
const field = (patch: Record<string, unknown>) => {
  const r = job(patch);
  return r.ok ? null : r.field;
};

describe("validate: type=job", () => {
  it("accepts the full form, trimmed and collapsed", () => {
    const r = job({});
    expect(r.ok).toBe(true);
    const v = (r as { value: JobSubmission }).value;
    expect(v.name).toBe("Dana Ortiz");
    expect(v.phone).toBe("");
    expect(v.notes).toBe("");
  });

  it("phone and notes are optional; absent reads as empty", () => {
    const r = validate({ ...JOB, phone: undefined, notes: undefined });
    expect(r.ok && r.value.type === "job" && [r.value.phone, r.value.notes]).toEqual(["", ""]);
  });

  for (const k of ["name", "company", "email", "where", "city", "side", "length_ft", "kind", "hours"]) {
    it(`${k} is required (missing, or only whitespace)`, () => {
      expect(field({ [k]: undefined })).toBe(k);
      expect(field({ [k]: "   " })).toBe(k);
    });
  }

  for (const [k, cap] of Object.entries(CAPS)) {
    it(`${k} is capped at ${cap} characters`, () => {
      const at = k === "email" ? "a".repeat(cap - 6) + "@x.com" : k === "length_ft" ? "1".repeat(cap) : "a".repeat(cap);
      expect(field({ [k]: at })).toBeNull();
      expect(field({ [k]: at + (k === "email" ? "m" : "1") })).toBe(k);
    });
  }

  it("length_ft: a positive integer, commas as thousands separators only", () => {
    for (const ok of ["1", "1000", "1,000", "12,345,678", "0001"]) expect(field({ length_ft: ok }), ok).toBeNull();
    for (const bad of ["0", "0,000", "-5", "1.5", "1,00", "10,0000", ",100", "1 000", "abc", "1e3"])
      expect(field({ length_ft: bad }), bad).toBe("length_ft");
  });

  it("kind and hours are the form's own values, exactly", () => {
    expect(field({ kind: "shoulder work" })).toBe("kind");
    expect(field({ kind: "Something else" })).toBeNull();
    expect(field({ hours: "Evening" })).toBe("hours");
  });

  it("email must look like an address", () => {
    for (const bad of ["dana", "dana@", "@x.com", "dana@x", "da na@x.com", "dana@x..com"])
      expect(field({ email: bad }), bad).toBe("email");
  });

  it("a non-string value is refused", () => {
    expect(field({ name: 42 })).toBe("name");
    expect(field({ notes: ["a"] })).toBe("notes");
  });

  it("an unknown field is refused", () => {
    expect(field({ admin: true })).toBe("admin");
  });
});

describe("validate: the bot check (ruling 4)", () => {
  it("a filled honeypot is a bot", () => {
    expect(job({ website: "x" })).toEqual({ ok: false, reason: "bot" });
  });
  it("under 3 seconds since mount is a bot; 3 s exactly passes", () => {
    expect(job({ elapsed_ms: 2999 })).toEqual({ ok: false, reason: "bot" });
    expect(job({ elapsed_ms: 3000 }).ok).toBe(true);
  });
  it("a missing or non-numeric elapsed time is a bot", () => {
    for (const e of [undefined, "5000", NaN, Infinity]) expect(job({ elapsed_ms: e }).ok, String(e)).toBe(false);
  });
});

describe("validate: type=waitlist", () => {
  const W = { type: "waitlist", website: "", elapsed_ms: 4000, email: " pat@example.com " };
  it("takes one email", () => {
    expect(validate(W)).toEqual({ ok: true, value: { type: "waitlist", email: "pat@example.com" } });
  });
  it("refuses any job field, and a bad email", () => {
    expect(validate({ ...W, city: "Denver" })).toMatchObject({ ok: false, field: "city" });
    expect(validate({ ...W, email: "pat" })).toMatchObject({ ok: false, field: "email" });
  });
  it("has the same bot check", () => {
    expect(validate({ ...W, website: "x" })).toEqual({ ok: false, reason: "bot" });
    expect(validate({ ...W, elapsed_ms: 100 })).toEqual({ ok: false, reason: "bot" });
  });
});

describe("validate: the envelope", () => {
  it("refuses a non-object, an array, and a missing or unknown type", () => {
    for (const b of [null, "x", 3, [], {}, { ...JOB, type: "Job" }]) expect(validate(b).ok).toBe(false);
  });
});

describe("whitespace and control characters (rulings.md S7)", () => {
  it("single-line fields turn CR, LF, tab and other controls into one space", () => {
    expect(oneLine(" a\r\nb\tc\u0000d e  f ")).toBe("a b c d e f");
  });
  it("notes keep line breaks (CRLF → LF) and drop other controls", () => {
    expect(multiLine(" one\r\ntwo\rthree\u0007\n ")).toBe("one\ntwo\nthree");
  });
  it("a header-injection attempt in a single-line field becomes one line", () => {
    const r = job({ where: "Main St\r\nBcc: victim@example.com" });
    expect(r.ok && r.value.type === "job" && r.value.where).toBe("Main St Bcc: victim@example.com");
  });
});
