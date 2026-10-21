// #365 evidence: render the sidebar's extent rows (CorridorExtentLines, the
// real component) for the corner plan's served corridor_spec, before and
// after.   Copy into conestruct/site/ as _extent-crop.mts, then from there:
//   npx tsx _extent-crop.mts <spec.json> <out.html> <css>   (and delete the copy)
import { readFileSync, writeFileSync } from "node:fs";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// The site compiles JSX with Next ("jsx": "preserve"); tsx falls back to
// the classic transform, which needs a global React before the import.
(globalThis as { React?: unknown }).React = React;
const { CorridorExtentLines } = await import("./components/bands/WhereBand");

const [, , specPath, out, cssPath] = process.argv;
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const css = readFileSync(cssPath, "utf8");
const panel = (title: string, lengths: unknown) =>
  `<figure data-crop="${title}" style="width:340px;padding:12px;margin:8px;border:1px dashed #999;background:var(--paper)"><figcaption style="font:11px monospace;color:#93a0b0;margin-bottom:6px">${title}</figcaption>` +
  renderToStaticMarkup(
    createElement(CorridorExtentLines, { lengths: lengths as never, workLen: 700, kind: "near_intersection", note: null }),
  ) +
  `</figure>`;
writeFileSync(
  out,
  `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="background:#fff"><div class="workbench">` +
    panel("before (base 656fa1c corridor_spec)", spec.before) +
    panel("after (issue-365-corner-spec corridor_spec)", spec.after) +
    `</div></body></html>`,
);
