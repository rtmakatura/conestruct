"use client";

// #252 (s2-arc23, GO ruling b) — the write lock.  One boolean from the
// shell (the same ``planInFlight`` the working band mounts on) reaches
// every control that can change the plan or open a request:
//
//   · a WRITE control renders ``disabled={locked || ownReason}`` and
//     carries ``data-write`` — the attribute the one CSS rule dims
//     uniformly (.workbench.ws-locked [data-write]:disabled) and the
//     enumeration test keys on;
//   · a READ control (expanders, disclosures, the nav's own save word)
//     carries ``data-read`` and stays live — reading is never blocked
//     (spec 26/27, mandatory);
//   · a route link (nav, footer, sign-up) carries neither.
//
// The enumeration is honest by construction: WriteLock.test.tsx walks
// every control in the post-generate DOM with a request held open and
// fails, by name, on any control that is neither — a new control has to
// declare what it is before it ships.  ``inert`` is not used: the strip
// holds writes and reads in one container.  A saved-mode download
// ``<a href>`` cannot take ``disabled``: it renders ``aria-disabled``,
// ``tabIndex -1`` and the same dim (the rule matches both forms).

import { createContext, useContext } from "react";

export const WriteLockContext = createContext<boolean>(false);

// #252 (GO ruling a, RENDERING): a file render — the zip, a per-file
// render, the audit PDF, the quote preview / XLSX — is a server request
// too.  The shell owns the set of open ones; a renderer brackets its
// fetch with ``begin(label)`` … ``end()`` and the band names the file
// while it renders.  The default (outside the shell) records nothing.
export type BeginRender = (label: string) => () => void;
export const RenderRequestContext = createContext<BeginRender>(() => () => {});

/** ``const end = beginRender("plan sheet PDF"); try { … } finally { end(); }`` */
export function useRenderRequest(): BeginRender {
  return useContext(RenderRequestContext);
}

/** True while a request for the generated scenario is open. */
export function useWriteLock(): boolean {
  return useContext(WriteLockContext);
}

/** The props a locked anchor carries (an ``<a>`` has no ``disabled``). */
export function lockedAnchorProps(locked: boolean) {
  return locked
    ? { "aria-disabled": "true" as const, tabIndex: -1 }
    : {};
}
