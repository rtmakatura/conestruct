// @vitest-environment happy-dom
//
// #517 ruling 6 (S7) — the shared listbox: "Inter at 15, options at least
// 44 px, the selected option on --pri-off with a check, and keyboard
// support (arrows, Enter, Esc, type-ahead)."  The roles, states and keys
// are asserted here; size and colour are the CSS's (globals.css .lb-*).

import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Listbox } from "./Listbox";
import { pickOption } from "../__fixtures__/listbox";

afterEach(cleanup);

const OPTIONS = [
  { value: "local", label: "Local" },
  { value: "collector", label: "Collector" },
  { value: "arterial", label: "Arterial" },
];

function Harness({
  initial = "local",
  onChange = () => {},
  disabled = false,
}: {
  initial?: string | null;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState<string | null>(initial);
  return (
    <div>
      <label htmlFor="lb-test">Street class</label>
      <Listbox
        id="lb-test"
        label="Street class"
        value={v}
        options={OPTIONS}
        disabled={disabled}
        onChange={(next) => {
          onChange(next);
          setV(next);
        }}
      />
      <button type="button">outside</button>
    </div>
  );
}

const btn = () => document.getElementById("lb-test") as HTMLButtonElement;
const list = () => document.getElementById("lb-test-list");
const active = () => {
  const id = list()?.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.getAttribute("data-value") : null;
};

describe("#517 ruling 6: the listbox", () => {
  it("a button named by its label, with the listbox popup roles", () => {
    render(<Harness />);
    expect(btn().getAttribute("aria-haspopup")).toBe("listbox");
    expect(btn().getAttribute("aria-expanded")).toBe("false");
    expect(btn().textContent).toContain("Local");
    act(() => {
      fireEvent.click(btn());
    });
    expect(btn().getAttribute("aria-expanded")).toBe("true");
    const l = list() as HTMLElement;
    expect(l.getAttribute("role")).toBe("listbox");
    expect(document.getElementById(l.getAttribute("aria-labelledby") ?? "")?.textContent).toBe(
      "Street class",
    );
    const opts = Array.from(l.querySelectorAll('[role="option"]'));
    expect(opts.map((o) => o.getAttribute("data-value"))).toEqual(["local", "collector", "arterial"]);
    expect(opts.map((o) => o.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    // The selected option carries the check, its glyph hidden from AT.
    expect(opts[0].querySelector('[aria-hidden="true"]')?.textContent).toBe("✓");
    expect(document.activeElement).toBe(l);
  });

  it("arrows, Home and End move the active option; Enter picks and returns focus", () => {
    const spy = vi.fn();
    render(<Harness onChange={spy} />);
    act(() => {
      fireEvent.keyDown(btn(), { key: "ArrowDown" });
    });
    expect(active()).toBe("local");
    act(() => {
      fireEvent.keyDown(list() as HTMLElement, { key: "ArrowDown" });
    });
    expect(active()).toBe("collector");
    act(() => {
      fireEvent.keyDown(list() as HTMLElement, { key: "End" });
    });
    expect(active()).toBe("arterial");
    act(() => {
      fireEvent.keyDown(list() as HTMLElement, { key: "Home" });
    });
    expect(active()).toBe("local");
    act(() => {
      fireEvent.keyDown(list() as HTMLElement, { key: "ArrowUp" });
    });
    expect(active()).toBe("local");
    act(() => {
      fireEvent.keyDown(list() as HTMLElement, { key: "ArrowDown" });
    });
    act(() => {
      fireEvent.keyDown(list() as HTMLElement, { key: "Enter" });
    });
    expect(spy).toHaveBeenCalledWith("collector");
    expect(list()).toBeNull();
    expect(document.activeElement).toBe(btn());
    expect(btn().textContent).toContain("Collector");
  });

  it("type-ahead jumps by first letters", () => {
    render(<Harness />);
    act(() => {
      fireEvent.click(btn());
    });
    act(() => {
      fireEvent.keyDown(list() as HTMLElement, { key: "a" });
    });
    expect(active()).toBe("arterial");
    act(() => {
      fireEvent.keyDown(list() as HTMLElement, { key: "c" });
    });
    // "ac" matches nothing after 'a', so a fresh letter later starts over.
    expect(active()).toBe("arterial");
  });

  it("Esc closes and returns focus to the button, picking nothing", () => {
    const spy = vi.fn();
    render(<Harness onChange={spy} />);
    act(() => {
      fireEvent.click(btn());
    });
    act(() => {
      fireEvent.keyDown(list() as HTMLElement, { key: "Escape" });
    });
    expect(list()).toBeNull();
    expect(document.activeElement).toBe(btn());
    expect(spy).not.toHaveBeenCalled();
  });

  it("a click outside closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(btn());
    expect(list()).not.toBeNull();
    await user.click(document.querySelector("button:not(#lb-test)") as HTMLElement);
    expect(list()).toBeNull();
  });

  it("picking the value already held still reports it (S2's check)", () => {
    const spy = vi.fn();
    render(<Harness onChange={spy} />);
    pickOption("lb-test", "local");
    expect(spy).toHaveBeenCalledWith("local");
  });

  it("unset shows the placeholder; disabled (the write lock) does not open", () => {
    render(<Harness initial={null} disabled />);
    expect(btn().textContent).toContain("Not set");
    expect(btn().disabled).toBe(true);
    expect(btn().hasAttribute("data-write")).toBe(true);
    act(() => {
      fireEvent.click(btn());
    });
    expect(list()).toBeNull();
  });
});
