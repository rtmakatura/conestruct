// @vitest-environment happy-dom
//
// fix-spec-02 P1·05·02/03 — the form primitives expose programmatic
// state and names.  Before this, ChipRow/CheckRow selection existed
// only as a cyan fill (hue-alone, invisible to a screen reader) and
// LabelRow was a bare <div>, so no workbench select/slider/input had
// an accessible name.  Asserted on the rendered DOM, not on props.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckRow, ChipRow, LabelRow } from "./GeneratorFormPrimitives";

afterEach(cleanup);

describe("ChipRow aria-pressed", () => {
  it("marks exactly the selected chip pressed and flips on click", async () => {
    const onChange = vi.fn();
    render(
      <ChipRow
        options={[1, 2, 3].map((n) => ({ v: n, l: String(n) }))}
        value={2}
        onChange={onChange}
      />,
    );
    const chips = screen.getAllByRole("button");
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    await userEvent.click(chips[2]);
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe("CheckRow checkbox semantics", () => {
  it("exposes role=checkbox with aria-checked tracking the on state", () => {
    const { rerender } = render(
      <CheckRow on={false} label="Night operation" onToggle={() => {}} />,
    );
    const box = screen.getByRole("checkbox", { name: /Night operation/ });
    expect(box.getAttribute("aria-checked")).toBe("false");
    rerender(
      <CheckRow on={true} label="Night operation" onToggle={() => {}} />,
    );
    expect(
      screen.getByRole("checkbox", { name: /Night operation/ }).getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
  });

  it("toggles on click (native button keeps Space/Enter)", async () => {
    const onToggle = vi.fn();
    render(<CheckRow on={false} label="Night operation" onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("LabelRow htmlFor", () => {
  it("renders a real <label> when htmlFor is given, a <div> otherwise", () => {
    const { container } = render(
      <>
        <LabelRow htmlFor="the-input">Named field</LabelRow>
        <input id="the-input" />
        <LabelRow>Chip caption</LabelRow>
      </>,
    );
    expect(screen.getByLabelText("Named field").tagName).toBe("INPUT");
    const captions = container.querySelectorAll("div.field-label-row");
    expect(captions).toHaveLength(1);
    expect(captions[0].textContent).toBe("Chip caption");
  });
});
