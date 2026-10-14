// @vitest-environment happy-dom
//
// #297 step 3: the NEEDS YOU row control.  The block writes nothing: a
// press hands the item's id and the action's kind to the shell, which
// stages it.  The control locks with the block's other writes, and the
// Apply row it is handed renders only where the condition rows (which
// carry their own Apply) are absent.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { NeedsYou } from "./NeedsYou";
import { deriveNeedsYou, type NeedsYouItem } from "@/lib/needs-you";

afterEach(cleanup);

const ID = "jur:delta:lakewood:a1070ec38f";
const item = (over: Partial<NeedsYouItem> = {}): NeedsYouItem => ({
  id: ID,
  tier: "attention",
  title: "double-posted set",
  result: "CONDITIONAL",
  cite: "Lakewood typical TCP sheet § note 6",
  evidence: "required by Lakewood",
  action: { kind: "acknowledge", label: "Acknowledge" },
  ...over,
});

const APPLY = <li data-testid="ny-ack-apply">apply</li>;

describe("#297: the row control", () => {
  it("a press hands the id and the kind to the shell", () => {
    const onAction = vi.fn();
    render(<NeedsYou model={deriveNeedsYou([item()])} onAction={onAction} />);
    fireEvent.click(document.querySelector('button[data-write="acknowledge"]')!);
    expect(onAction).toHaveBeenCalledWith(ID, "acknowledge");
  });

  it("the provenance and button follow the item's state", () => {
    render(
      <NeedsYou
        model={deriveNeedsYou([item({ ack: "acknowledged", action: { kind: "withdraw", label: "Withdraw" } })])}
      />,
    );
    expect(document.querySelector(".ny-prov")?.textContent).toBe(
      "needs attention · required by Lakewood · acknowledged",
    );
    expect(document.querySelector("button.act")?.textContent).toBe("Withdraw");
  });

  it("locks under a regeneration in flight", () => {
    render(<NeedsYou model={deriveNeedsYou([item()])} inFlight onAction={vi.fn()} />);
    expect((document.querySelector("button.act") as HTMLButtonElement).disabled).toBe(true);
  });

  it("the handed Apply row renders only without condition rows", () => {
    render(<NeedsYou model={deriveNeedsYou([item()])} applyRow={APPLY} />);
    expect(document.querySelector('[data-testid="ny-ack-apply"]')).not.toBeNull();
    cleanup();
    render(
      <NeedsYou
        model={deriveNeedsYou([item()])}
        conditions={<li data-testid="conditions">rows</li>}
        applyRow={APPLY}
      />,
    );
    expect(document.querySelector('[data-testid="ny-ack-apply"]')).toBeNull();
  });
});
