// @vitest-environment happy-dom
//
// #346 — /privacy, mounted.  Ryan's "Send us a past job" section is his
// wording, added with no rewording (rulings.md S15): the page must render
// it word for word, after the placeholder's four interim points.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PrivacyPage from "./page";

afterEach(cleanup);

const RULED =
  `"Send us a past job" form. When you use this form, we collect your name, company, email, phone (if you give it), the job's location, and the job details you enter. We email them to Conestruct through Resend, our email provider, and send you a copy. We use them only to draft your comparison plan and to reply to you. If you send us an approved plan, it arrives by email reply and we use it only for that comparison. To block abuse, our rate limiter (Upstash) keeps your IP address for a short time. We don't sell any of this. To have it deleted, email safety@conestruct.com.`;

describe("#346 — the past-job form's privacy section", () => {
  it("renders Ryan's wording exactly, as its own paragraph after the interim list", () => {
    const c = render(<PrivacyPage />).container;
    const paras = [...c.querySelectorAll("article p")].map((p) => p.textContent);
    expect(paras).toContain(RULED);
    const ruled = [...c.querySelectorAll("article p")].find((p) => p.textContent === RULED)!;
    expect(ruled.previousElementSibling?.tagName).toBe("UL");
  });

  it("keeps the placeholder's four interim points", () => {
    const c = render(<PrivacyPage />).container;
    expect(c.querySelectorAll("article li")).toHaveLength(4);
  });
});
