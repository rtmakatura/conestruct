// #517 (ruling 6, S7) — pick an option in the shared Listbox
// (components/ui/Listbox.tsx), as a person does: open the button, click
// the option.  The suites that drove the section's native selects with
// `fireEvent.change` use these instead.

import { act, fireEvent } from "@testing-library/react";

type UserLike = { click: (el: Element) => Promise<void> };

function button(id: string): HTMLButtonElement {
  const b = document.getElementById(id);
  if (!b) throw new Error(`no listbox button #${id} on screen`);
  return b as HTMLButtonElement;
}

function option(id: string, value: string): HTMLElement {
  const list = document.getElementById(`${id}-list`);
  if (!list) throw new Error(`listbox #${id} did not open`);
  const opt = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (o) => o.getAttribute("data-value") === value,
  );
  if (!opt) throw new Error(`listbox #${id} has no option with data-value="${value}"`);
  return opt;
}

/** fireEvent: open `#id`, click the option whose `data-value` is `value`. */
export function pickOption(id: string, value: string): void {
  act(() => {
    fireEvent.click(button(id));
  });
  const opt = option(id, value);
  act(() => {
    fireEvent.click(opt);
  });
}

/** The user-event variant. */
export async function pickOptionUser(user: UserLike, id: string, value: string): Promise<void> {
  await user.click(button(id));
  await user.click(option(id, value));
}

/** The words the listbox button shows (the selected label, or its
 *  placeholder when unset). */
export function listboxValue(id: string): string {
  return (document.getElementById(`${id}-val`)?.textContent ?? "").trim();
}
