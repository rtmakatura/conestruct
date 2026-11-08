// #456: the aerial and geometry answers are remembered for the session
// (lib/corridor-aerial.ts, lib/corridor-geometry.ts).  Each test starts with
// nothing remembered, so a test's requests are its own.
import { beforeEach } from "vitest";
import { forgetAerials } from "@/lib/corridor-aerial";
import { forgetGeometries } from "@/lib/corridor-geometry";

beforeEach(() => {
  forgetAerials();
  forgetGeometries();
});
