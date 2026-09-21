// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DisclosureRow } from "./DisclosureRow";

// #288 step 4 — rules 87–89 and rule 129.

const row = (over: Partial<Parameters<typeof DisclosureRow>[0]> = {}) =>
  render(
    <DisclosureRow
      symbol="✓"
      name="Checked"
      count={12}
      open={false}
      onToggle={() => {}}
      {...over}
    >
      <p>inside</p>
    </DisclosureRow>,
  );

describe("DisclosureRow (rules 87–89)", () => {
  it("rule 88: symbol → name → count → provenance → caret, caret last", () => {
    const { container } = row({ provenance: "sourced corpus" });
    const head = container.querySelector(".disc-head")!;
    const order = Array.from(head.children).map((e) => e.className.split(" ")[0]);
    expect(order).toEqual(["disc-glyph", "disc-name", "disc-count", "disc-prov", "disc-caret"]);
  });

  it("rule 89: a counted tier shows its number", () => {
    const { container } = row({ count: 12 });
    expect(container.querySelector(".disc-count")?.textContent).toBe("12");
  });

  it("rule 89: the UNCOUNTED reference tier renders no numeral — not a zero", () => {
    const { container } = row({ count: null, provenance: "permit · hours · standing hazards" });
    expect(container.querySelector(".disc-count")).toBeNull();
    // A zero would read as "nothing in here", which is the opposite of
    // what an uncounted reference tier means.
    expect(container.querySelector(".disc-head")?.textContent).not.toContain("0");
    expect(container.querySelector(".disc-prov")?.textContent).toBe("permit · hours · standing hazards");
  });

  it("absent provenance renders nothing, not an empty element", () => {
    const { container } = row({ provenance: undefined });
    expect(container.querySelector(".disc-prov")).toBeNull();
  });

  it("closed: the panel is not in the DOM at all", () => {
    const { container } = row({ open: false });
    expect(container.querySelector(".disc-panel")).toBeNull();
    expect(container.textContent).not.toContain("inside");
  });

  it("open: the panel renders in place, below the header", () => {
    const { container } = row({ open: true });
    const panel = container.querySelector(".disc-panel");
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain("inside");
    // In place: the panel is the row's own next sibling, not a portal
    // and not somewhere above the header.
    expect(container.querySelector(".disc")!.children[1]).toBe(panel);
  });

  it("rule 129: the control is a READ — disclosing is not a write", () => {
    const { container } = row();
    const head = container.querySelector(".disc-head")!;
    expect(head.hasAttribute("data-read")).toBe(true);
    expect(head.hasAttribute("data-write")).toBe(false);
  });

  it("announces its own state and owns its panel", async () => {
    const onToggle = vi.fn();
    const { container } = row({ open: false, onToggle });
    const head = container.querySelector(".disc-head") as HTMLButtonElement;
    expect(head.getAttribute("aria-expanded")).toBe("false");
    const controls = head.getAttribute("aria-controls");
    await userEvent.click(head);
    expect(onToggle).toHaveBeenCalledTimes(1);
    const { container: openContainer } = row({ open: true });
    const openHead = openContainer.querySelector(".disc-head")!;
    expect(openHead.getAttribute("aria-expanded")).toBe("true");
    expect(openContainer.querySelector(".disc-panel")!.id).toBe(controls);
  });

  it("nested rows take the lifted ground (rule 87)", () => {
    const { container } = row({ nested: true });
    expect(container.querySelector(".disc")!.className).toContain("is-nested");
  });
});
