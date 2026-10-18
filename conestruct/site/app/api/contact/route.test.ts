// #346: /api/contact mounted (Rule 11): the real handler, the real
// validator, emails and limiter.  Only the edges are stand-ins: Upstash is
// an in-memory fixed-window counter that honours each limiter's cap and
// prefix, and Resend is a stubbed `fetch` that records what was sent.

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  counts: new Map<string, number>(),
  limitThrows: false,
}));

vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    cap: number;
    prefix: string;
    static fixedWindow(cap: number) {
      return { cap };
    }
    constructor(opts: { limiter: { cap: number }; prefix: string }) {
      this.cap = opts.limiter.cap;
      this.prefix = opts.prefix;
    }
    async limit(key: string) {
      if (h.limitThrows) throw new Error("upstash down");
      const k = `${this.prefix}:${key}`;
      const n = (h.counts.get(k) ?? 0) + 1;
      h.counts.set(k, n);
      return { success: n <= this.cap };
    }
  },
}));

import { __resetRateLimitStateForTests } from "@/lib/rate-limit";
import { POST } from "./route";

const ENV = {
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "t",
  RESEND_API_KEY: "re_test",
  CONTACT_TO: "ryan@conestruct.com",
  CONTACT_FROM: "Ryan at Conestruct <ryan@conestruct.com>",
  REPLY_TURNAROUND: "2 to 3 business days",
  REPLY_DUE_BUSINESS_DAYS: "3",
};

const JOB = {
  type: "job",
  website: "",
  elapsed_ms: 12_000,
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
const WAIT = { type: "waitlist", website: "", elapsed_ms: 5_000, email: "pat@example.com" };

type Sent = { from: string; to: string[]; reply_to: string; subject: string; html: string; text: string };
let sent: Sent[];
let resendStatus: number[];

function post(body: unknown, ip = "1.2.3.4", contentType = "application/json") {
  return POST(
    new NextRequest("http://localhost/api/contact", {
      method: "POST",
      headers: { "content-type": contentType, "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  h.counts.clear();
  h.limitThrows = false;
  __resetRateLimitStateForTests();
  sent = [];
  resendStatus = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.resend.com/emails");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
      sent.push(JSON.parse(init.body as string));
      return new Response("{}", { status: resendStatus.shift() ?? 200 });
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("type=job", () => {
  it("sends Ryan's notification, then the submitter's confirmation, and answers 200", async () => {
    const res = await post(JOB);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sent.map((s) => [s.to, s.reply_to, s.subject])).toEqual([
      [["ryan@conestruct.com"], "dana@frtraffic.com", "Past job: Front Range Traffic · E Colfax Ave & N Race St, Denver"],
      [["dana@frtraffic.com"], "ryan@conestruct.com", "Got your job on E Colfax Ave & N Race St"],
    ]);
    for (const s of sent) {
      expect(s.from).toBe("Ryan at Conestruct <ryan@conestruct.com>");
      expect(s.html.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
    }
  });

  it("the notification failing sends no confirmation and answers 502", async () => {
    resendStatus = [500];
    const res = await post(JOB);
    expect(res.status).toBe(502);
    expect(sent).toHaveLength(1);
  });

  it("the confirmation failing answers 502 (no silent success)", async () => {
    resendStatus = [200, 422];
    expect((await post(JOB)).status).toBe(502);
    expect(sent).toHaveLength(2);
  });

  it("Resend unreachable answers 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect((await post(JOB)).status).toBe(502);
  });
});

describe("type=waitlist", () => {
  it("sends one notification to CONTACT_TO and no confirmation", async () => {
    const res = await post(WAIT);
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(["ryan@conestruct.com"]);
    expect(sent[0].reply_to).toBe("pat@example.com");
    expect(sent[0].subject).toBe("Waitlist: pat@example.com");
  });

  it("refuses the job form's fields", async () => {
    expect((await post({ ...WAIT, name: "Pat" })).status).toBe(400);
    expect(sent).toHaveLength(0);
  });
});

describe("refusals send nothing", () => {
  const cases: [string, unknown, number][] = [
    ["an unknown field", { ...JOB, extra: "x" }, 400],
    ["an unknown type", { ...JOB, type: "other" }, 400],
    ["a missing required field", { ...JOB, city: undefined }, 400],
    ["a filled honeypot", { ...JOB, website: "http://spam.example" }, 400],
    ["under 3 seconds", { ...JOB, elapsed_ms: 2_999 }, 400],
    ["no elapsed time", { ...JOB, elapsed_ms: undefined }, 400],
    ["not JSON", "{not json", 400],
    ["an array", [JOB], 400],
  ];
  for (const [label, body, status] of cases) {
    it(`${label} → ${status}`, async () => {
      expect((await post(body)).status).toBe(status);
      expect(sent).toHaveLength(0);
    });
  }

  it("a non-JSON content type → 415", async () => {
    expect((await post(JOB, "1.2.3.4", "text/plain")).status).toBe(415);
  });

  it("a body over 16 KB → 413", async () => {
    expect((await post({ ...JOB, notes: "x".repeat(17_000) })).status).toBe(413);
    expect(sent).toHaveLength(0);
  });
});

describe("config: every variable required, no default in code", () => {
  for (const k of ["RESEND_API_KEY", "CONTACT_TO", "CONTACT_FROM", "REPLY_TURNAROUND", "REPLY_DUE_BUSINESS_DAYS"]) {
    it(`${k} unset → 503, nothing sent`, async () => {
      vi.stubEnv(k, "");
      expect((await post(JOB)).status).toBe(503);
      expect(sent).toHaveLength(0);
    });
  }
  for (const v of ["0", "three", "2.5", "-1"]) {
    it(`REPLY_DUE_BUSINESS_DAYS=${v} → 503`, async () => {
      vi.stubEnv("REPLY_DUE_BUSINESS_DAYS", v);
      expect((await post(JOB)).status).toBe(503);
    });
  }
});

describe("rate limit (ruling 5): 5 an hour per IP, 50 a day global, fails closed", () => {
  it("the sixth from one IP in the hour → 429, nothing sent", async () => {
    for (let i = 0; i < 5; i++) expect((await post(WAIT)).status).toBe(200);
    const before = sent.length;
    expect((await post(WAIT)).status).toBe(429);
    expect(sent).toHaveLength(before);
    expect((await post(WAIT, "5.6.7.8")).status).toBe(200);
  });

  it("the job form and the waitlist share one per-IP count", async () => {
    for (let i = 0; i < 3; i++) await post(WAIT);
    for (let i = 0; i < 2; i++) expect((await post(JOB)).status).toBe(200);
    expect((await post(JOB)).status).toBe(429);
  });

  it("the 51st in the day, across IPs → 429", async () => {
    for (let i = 0; i < 50; i++) expect((await post(WAIT, `10.0.0.${i}`)).status).toBe(200);
    expect((await post(WAIT, "10.0.1.1")).status).toBe(429);
    expect(sent).toHaveLength(50);
  });

  it("Upstash unreachable → 503, nothing sent", async () => {
    h.limitThrows = true;
    expect((await post(JOB)).status).toBe(503);
    expect(sent).toHaveLength(0);
  });

  it("Upstash unset → 503, nothing sent", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    expect((await post(JOB)).status).toBe(503);
    expect(sent).toHaveLength(0);
  });

  it("a refused submission does not spend the count", async () => {
    for (let i = 0; i < 5; i++) await post({ ...WAIT, website: "spam" });
    expect((await post(WAIT)).status).toBe(200);
  });
});
