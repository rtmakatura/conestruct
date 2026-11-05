// #443: the suites that read a row's opened text go through the one renderer
// the page uses, with the Source line the row adds from `cite`.

import { renderToStaticMarkup } from "react-dom/server";

import { DetailView } from "./ReferenceSections";
import type { RowDetail } from "@/lib/row-detail";

export function DetailOf({ spec }: { spec: { detail: RowDetail; cite?: string } | null | undefined }) {
  if (!spec) return null;
  return <DetailView detail={{ ...spec.detail, source: spec.detail.source ?? spec.cite }} m={null} />;
}

export function renderDetail(spec: { detail: RowDetail; cite?: string } | null | undefined): string {
  return renderToStaticMarkup(<DetailOf spec={spec} />);
}
