"use client";

// #443: the three sections under the results, one row style and a search
// box.  Rows are data (lib/reference-sections); search reads that data, so
// closed rows stay unmounted (X4).  The search state overlays the stored
// open and closed state and never writes it, so clearing restores it (P15).

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { jumpToAnchor } from "./GeneratorFormPrimitives";
import type { DeviceBreakdownState } from "./DeviceBreakdown";
import { useWriteLock } from "./WriteLock";
import type { StreetClass, WorkScheduleInput, JurisdictionBlock } from "@/lib/jurisdiction";
import { symClass } from "@/lib/design/symbols";
import type { AuditState } from "@/lib/render-types";
import {
  buildReferenceSections,
  type RefRow,
  type RefSection,
  type SectionId,
} from "@/lib/reference-sections";
import { planChips, searchSections, statusLine, type RowHit, type SearchResult } from "@/lib/reference-search";
import type { DetailLine, RowDetail } from "@/lib/row-detail";
import type { Scenario } from "@/lib/scenarios";
import { SITE_CORRECTIONS_ANCHOR } from "@/lib/scenarios/site-corrections";
import { deriveTierSources } from "@/lib/tier-sources";

export interface ReferenceSectionsProps {
  jurisdiction: JurisdictionBlock | null;
  jurisdictionLoading: boolean;
  revalidating: boolean;
  streetClass: StreetClass | null;
  schedule: WorkScheduleInput | null;
  scenario: Scenario;
  audit: AuditState;
  onRetry: () => void;
  generated: boolean;
  showAudit: boolean;
  breakdown: DeviceBreakdownState;
  /** The settled ledger's counts; null until an audit has settled (Rule 10). */
  checkedCount: number | null;
  pendingCount: number | null;
  cited: boolean;
  /** A failed audit opens section 3, where its Retry is (Rule 10). */
  referenceDefaultOpen: boolean;
}

// A sign or device code (R9-9, W21-5aR, M4-9a): it stays whole
// on a narrow line (X29).  Row results and a list line's sub-line only: a span
// would split pinned detail text across text nodes.
const CODE = /\b[A-Z]{1,3}\d+[A-Z]?(?:-\d+[A-Za-z]*)+\b/g;

/** Draw `text` with its matches in `<mark>` (ruling 7). */
function Hl({ text, m, codes = false }: { text: string; m: RegExp | null; codes?: boolean }) {
  const hits = m ? [...text.matchAll(m)].filter((h) => h[0] !== "") : [];
  // The text between from and to, with the matches that fall in it marked.
  const marked = (from: number, to: number): ReactNode[] => {
    const parts: ReactNode[] = [];
    let at = from;
    for (const hit of hits) {
      const start = Math.max(hit.index, from);
      const end = Math.min(hit.index + hit[0].length, to);
      if (start >= end) continue;
      if (start > at) parts.push(text.slice(at, start));
      parts.push(<mark key={start}>{text.slice(start, end)}</mark>);
      at = end;
    }
    if (at < to) parts.push(text.slice(at, to));
    return parts;
  };
  const out: ReactNode[] = [];
  let last = 0;
  for (const code of codes ? text.matchAll(CODE) : []) {
    const end = code.index + code[0].length;
    if (code.index > last) out.push(...marked(last, code.index));
    out.push(
      <span className="rr-code" key={`code-${code.index}`}>
        {marked(code.index, end)}
      </span>,
    );
    last = end;
  }
  if (last < text.length) out.push(...marked(last, text.length));
  return <>{out}</>;
}

export function DetailView({
  detail,
  m,
  hit,
}: {
  detail: RowDetail;
  m: RegExp | null;
  hit?: RowHit;
}) {
  const [showAll, setShowAll] = useState(false);
  const list = detail.list;
  const filtered = !showAll && hit?.listLines != null && list != null;
  const lines: DetailLine[] = list
    ? filtered
      ? hit!.listLines!.map((i) => list.lines[i])
      : list.lines
    : [];
  const total = list?.lines.length ?? 0;
  return (
    <div className="rr-detail">
      {hit?.inside && (
        <p className="tr-note">
          Opened because the match is inside.
          {filtered && list && ` ${lines.length} of ${total} ${list.noun.many} shown.`}
        </p>
      )}
      {detail.sentences?.map((s, i) => (
        <p className="tr-help" key={i}>
          <Hl text={s} m={m} />
        </p>
      ))}
      {detail.extra}
      {detail.pairs && detail.pairs.length > 0 && (
        <dl className="rr-pairs">
          {detail.pairs.map((p, i) => (
            <div className="rr-pair" key={i}>
              {p.label && (
                <dt>
                  <Hl text={p.label} m={m} />
                </dt>
              )}
              <dd className={p.mono ? "rr-num" : undefined}>
                <Hl text={p.value} m={m} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {lines.length > 0 && (
        <ul className="rr-lines">
          {lines.map((l, i) => (
            <li key={i}>
              <span className="rr-line-text">
                <Hl text={l.text} m={m} />
                {l.sub && (
                  <span className="tr-note rr-line-sub">
                    <Hl text={l.sub} m={m} codes />
                  </span>
                )}
              </span>
              {l.value && (
                <span className="rr-num rr-value">
                  <Hl text={l.value} m={m} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {filtered && list && (
        <button type="button" className="rr-link" data-read="" onClick={() => setShowAll(true)}>
          Show all {total} {list.noun.many === "device types" ? "types" : list.noun.many}
        </button>
      )}
      {detail.links?.map((l) => (
        <a className="rr-link" key={l.href} href={l.href} target="_blank" rel="noreferrer">
          <Hl text={l.label} m={m} />
        </a>
      ))}
      {detail.actions}
      {detail.source && (
        <p className="tr-note">
          Source: <Hl text={detail.source} m={m} />
        </p>
      )}
    </div>
  );
}

function Row({
  row,
  open,
  onToggle,
  m,
  hit,
}: {
  row: RefRow;
  open: boolean;
  onToggle: () => void;
  m: RegExp | null;
  hit?: RowHit;
}) {
  const panelId = useId();
  // Ruling 7: a match in the source shows the Source line under the title.
  const showSource = !open && hit?.inSource && row.detail.source;
  return (
    <div className="rr" data-row={row.id}>
      <button
        type="button"
        className="rr-head"
        data-read=""
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggle}
      >
        <span className={`rr-glyph ${symClass(row.glyph)}`} aria-hidden="true">
          {row.glyph}
        </span>
        <span className="rr-main">
          <span className="rr-title-line">
            <span className="rr-title">
              <Hl text={row.title} m={m} />
              {row.result && !row.resultMono ? ":" : ""}
            </span>
            {row.result && !row.resultMono && (
              <span className={`rr-result ${row.failed ? "is-fail" : ""}`}>
                {" "}
                <Hl text={row.result} m={m} codes />
              </span>
            )}
          </span>
          {showSource && (
            <span className="tr-note rr-source">
              Source: <Hl text={row.detail.source!} m={m} />
            </span>
          )}
        </span>
        {row.result && row.resultMono && (
          <span className="rr-num rr-value">
            <Hl text={row.result} m={m} />
          </span>
        )}
        <span className="rr-act">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div id={panelId}>
          <DetailView detail={row.detail} m={m} hit={hit?.inside ? hit : undefined} />
        </div>
      )}
    </div>
  );
}

function SectionView({
  section,
  open,
  onToggle,
  search,
  rowOpen,
  toggleRow,
  more,
  onMore,
  banner,
}: {
  section: RefSection;
  open: boolean;
  onToggle: () => void;
  search: SearchResult | null;
  rowOpen: (row: RefRow, hit?: RowHit) => boolean;
  toggleRow: (row: RefRow, hit?: RowHit) => void;
  more: boolean;
  onMore: () => void;
  banner?: ReactNode;
}) {
  const panelId = useId();
  const hits = search?.sections.get(section.id);
  const matched = hits?.rows.size ?? 0;
  const noMatch = search !== null && matched === 0;
  const m = search?.matcher ?? null;
  const showBody = search ? matched > 0 : open;
  const summary = search
    ? noMatch
      ? "No matches"
      : `${matched} of ${hits!.total} lines match`
    : section.summary;
  const head = (
    <>
      <span className={`rr-glyph ${symClass(section.glyph)}`} aria-hidden="true">
        {section.glyph}
      </span>
      <span className="rs-name">{section.name}</span>
      <span className="tr-note rs-summary">{summary}</span>
    </>
  );
  return (
    <section className={`rs ${noMatch ? "is-dim" : ""}`} data-section={section.id} aria-label={section.name}>
      {search ? (
        <div className="rs-head">{head}</div>
      ) : (
        <button
          type="button"
          className="rs-head"
          data-read=""
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={onToggle}
        >
          {head}
          <span className="rr-act">{open ? "Hide" : "Show"}</span>
        </button>
      )}
      {showBody && (
        <div id={panelId} className="rs-body">
          {!search && banner}
          {!search &&
            section.intro.map((t, i) => (
              <p className="tr-help rs-intro" key={i}>
                {t}
              </p>
            ))}
          {section.groups.map((g) => {
            const rows = search ? g.rows.filter((r) => hits!.rows.has(r.id)) : g.rows;
            if (rows.length === 0) return null;
            const cut = !search && !more && g.firstRows !== undefined ? g.firstRows : rows.length;
            const hidden = rows.length - cut;
            return (
              <div className="rs-group" key={g.label ?? "rows"}>
                {g.label && <div className="rs-label">{g.label}</div>}
                {rows.slice(0, cut).map((r) => {
                  const hit = hits?.rows.get(r.id);
                  return (
                    <Row
                      key={r.id}
                      row={r}
                      open={rowOpen(r, hit)}
                      onToggle={() => toggleRow(r, hit)}
                      m={m}
                      hit={hit}
                    />
                  );
                })}
                {hidden > 0 && (
                  <button type="button" className="rr-more" data-read="" onClick={onMore}>
                    Show {hidden} more check{hidden === 1 ? "" : "s"}
                  </button>
                )}
              </div>
            );
          })}
          {!search && section.groups.length === 0 && (
            <p className="tr-note rs-intro">Nothing here for this plan.</p>
          )}
        </div>
      )}
    </section>
  );
}

export function ReferenceSections(props: ReferenceSectionsProps) {
  const locked = useWriteLock();
  const sources = deriveTierSources({
    jurisdiction: props.jurisdiction,
    jurisdictionLoading: props.jurisdictionLoading,
    revalidating: props.revalidating,
    scenario: props.scenario,
    audit: props.audit,
    generated: props.generated,
    showAudit: props.showAudit,
  });
  const retryButton = (
    <button type="button" className="rr-link" data-write="" disabled={locked} onClick={props.onRetry}>
      Retry
    </button>
  );
  const signpost = (text: "Correct in setup ↑" | "Assert in setup ↑") => (
    <a
      className="rr-link tr-signpost"
      data-read=""
      href={`#${SITE_CORRECTIONS_ANCHOR}`}
      onClick={(e) => {
        e.preventDefault();
        jumpToAnchor(SITE_CORRECTIONS_ANCHOR);
      }}
    >
      {text}
    </a>
  );
  const sections = buildReferenceSections({
    sources,
    streetClass: props.streetClass,
    schedule: props.schedule,
    verifying: props.revalidating,
    breakdown: props.breakdown,
    cited: props.cited,
    checkedCount: props.checkedCount,
    pendingCount: props.pendingCount,
    jurisdictionLoading: props.jurisdictionLoading,
    showAudit: props.showAudit,
    signpost,
    retry: retryButton,
  });

  // Stored state: what the operator opened.  Search never writes these.
  const [sectionOpen, setSectionOpen] = useState<Record<SectionId, boolean>>({
    checked: false,
    pending: false,
    reference: props.referenceDefaultOpen,
  });
  const [rowState, setRowState] = useState<Record<string, boolean>>({});
  const [more, setMore] = useState(false);
  // The ReferenceDisclosure idiom: the flag arrives late, with the audit's answer.
  useEffect(() => {
    if (props.referenceDefaultOpen) setSectionOpen((s) => ({ ...s, reference: true }));
  }, [props.referenceDefaultOpen]);

  const [query, setQuery] = useState("");
  // A row toggled during a search: dropped with the query.
  const [searchRows, setSearchRows] = useState<Record<string, boolean>>({});
  const search = useMemo(() => searchSections(sections, query), [sections, query]);
  const inputRef = useRef<HTMLInputElement>(null);
  const change = (q: string) => {
    setQuery(q);
    setSearchRows({});
  };
  const clear = () => {
    change("");
    inputRef.current?.focus();
  };

  const rowOpen = (row: RefRow, hit?: RowHit) =>
    search
      ? (searchRows[row.id] ?? hit?.inside ?? false)
      : (rowState[row.id] ?? row.startOpen ?? false);
  const toggleRow = (row: RefRow, hit?: RowHit) => {
    const now = rowOpen(row, hit);
    if (search) setSearchRows((s) => ({ ...s, [row.id]: !now }));
    else setRowState((s) => ({ ...s, [row.id]: !now }));
  };

  const banner = sources.auditFailed ? (
    <div className="rs-banner" role="alert">
      {sources.declined ? (
        <span>Audit trail unavailable while generation is declined. See the notice above.</span>
      ) : (
        <>
          <span>
            {sources.throttled
              ? "Audit trail paused: too many updates in the last minute. Retry in a moment."
              : `Audit trail failed: ${props.audit.state === "error" ? props.audit.message : ""}`}
          </span>
          {retryButton}
        </>
      )}
    </div>
  ) : undefined;

  const status = search && search.count > 0 ? statusLine(sections, search) : null;
  const none = search !== null && search.count === 0;
  const chips = none ? planChips(sections) : [];

  return (
    <div className="ref-sections">
      <div className="rs-search">
        <label className="rs-label" htmlFor="ref-search">
          SEARCH THE DETAILS
        </label>
        <div className="rs-box">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l4 4" />
          </svg>
          <input
            ref={inputRef}
            id="ref-search"
            className="rs-input"
            type="search"
            data-read=""
            autoComplete="off"
            placeholder="A number, a rule or a word: taper, 6B, sidewalk, $500"
            value={query}
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                change("");
              }
            }}
          />
          {query && (
            <button type="button" className="rs-clear" data-read="" aria-label="Clear search" onClick={clear}>
              ×
            </button>
          )}
        </div>
        <p className={`tr-help rs-status ${none ? "sr-only" : ""}`} role="status" aria-live="polite">
          {status && (
            <>
              {status.lead}
              {status.where && <b>{status.where}</b>}
            </>
          )}
          {none && `No matches for "${query.trim()}".`}
        </p>
      </div>
      {none && (
        <div className="rs rs-none">
          <p className="rs-none-title">Nothing in this plan&apos;s details mentions &quot;{query.trim()}&quot;</p>
          <p className="tr-help">
            Search looks through this plan&apos;s checks, sources and {sources.jurisdictionName ?? "site"} {sources.jurisdictionName ? "rules" : "facts"}. It doesn&apos;t search the whole MUTCD.
          </p>
          {chips.length > 0 && (
            <>
              <p className="tr-note">Words that are in this plan:</p>
              <div className="rs-chips">
                {chips.map((c) => (
                  <button type="button" className="rs-chip" data-read="" key={c} onClick={() => change(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
          <button type="button" className="rr-link" data-read="" onClick={clear}>
            Clear search and show everything
          </button>
        </div>
      )}
      {sections.map((sec) => {
        const view = (
          <SectionView
            key={sec.id}
            section={sec}
            open={sectionOpen[sec.id]}
            onToggle={() => setSectionOpen((s) => ({ ...s, [sec.id]: !s[sec.id] }))}
            search={search}
            rowOpen={rowOpen}
            toggleRow={toggleRow}
            more={more}
            onMore={() => setMore(true)}
            banner={sec.id === "reference" ? banner : undefined}
          />
        );
        // #253 chip 2's jump target and #193's focus target.
        return sec.id === "reference" ? (
          <div id="reference" tabIndex={-1} className="jump-anchor outline-none" key={sec.id}>
            {view}
          </div>
        ) : (
          view
        );
      })}
    </div>
  );
}
