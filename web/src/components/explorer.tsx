"use client";
import { useEffect, useMemo, useState } from "react";
import { Diagrams, type Fig } from "@/components/exhibit";
import { SimpleLine, StackedBars, StackedColumns, StackedBarsWithLines, ToneScope, type Fmt, type Tone } from "@/components/charts";

type Row = Record<string, unknown>;
export type Chart =
  | { kind: "line"; data: Row[]; x: string; ys: string[]; fmt?: Fmt; peak?: boolean }
  | { kind: "bars"; data: Row[]; x: string; ys: string[]; fmt?: Fmt }
  | { kind: "columns"; data: Row[]; x: string; y: string; group: string; fmt?: Fmt }
  | { kind: "tiers"; data: Row[]; x: string; ys: string[]; bands: { from: number; to?: number; label: string }[]; fmt?: Fmt };

export type Metric = {
  id: string;
  label: string;
  value: string;
  /** change on a year ago, as a fraction */
  change?: number;
  /** one plain line: what this is and where it comes from */
  note: string;
  chart: Chart;
  tone?: Tone;
  /** the box in a section diagram this metric is about */
  node?: { fig: string; id: string };
};

/** cut a series to its last year, keyed off its own latest date */
function lastYear(c: Chart): Chart {
  const xs = c.data.map((r) => String(r[c.x]).slice(0, 10)).sort();
  const end = xs[xs.length - 1];
  if (!end) return c;
  const cut = new Date(new Date(end).getTime() - 365 * 864e5).toISOString().slice(0, 10);
  return { ...c, data: c.data.filter((r) => String(r[c.x]).slice(0, 10) >= cut) } as Chart;
}

function Draw({ c }: { c: Chart }) {
  if (c.kind === "line") return <SimpleLine data={c.data} x={c.x} ys={c.ys} fmt={c.fmt} peak={c.peak} />;
  if (c.kind === "bars") return <StackedBars data={c.data} x={c.x} ys={c.ys} fmt={c.fmt} />;
  if (c.kind === "columns") return <StackedColumns data={c.data} x={c.x} y={c.y} group={c.group} fmt={c.fmt} />;
  return <StackedBarsWithLines data={c.data} x={c.x} ys={c.ys} lines={[]} bands={c.bands} fmt={c.fmt} />;
}

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)}%`;

/** A list of metrics; the chosen one opens as a chart beside it. One chart on screen at a time. */
export function Explorer({ metrics, label, aside, sel: selIn, onSel }: { metrics: Metric[]; label: string; aside?: React.ReactNode; sel?: string; onSel?: (id: string) => void }) {
  const [selOwn, setOwn] = useState(metrics[0]?.id);
  const sel = selIn ?? selOwn;
  const setSel = (id: string) => { setOwn(id); onSel?.(id); };
  const [range, setRange] = useState<"1y" | "all">("all");
  useEffect(() => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (metrics.some((m) => m.id === h)) setSel(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics]);
  const m = metrics.find((x) => x.id === sel) ?? metrics[0];
  const chart = useMemo(() => (range === "1y" ? lastYear(m.chart) : m.chart), [m, range]);
  const pick = (id: string) => { setSel(id); history.replaceState(null, "", `#${id}`); };
  const move = (e: React.KeyboardEvent, i: number) => {
    const j = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : -1;
    if (j < 0 || j >= metrics.length) return;
    e.preventDefault();
    pick(metrics[j].id);
    (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
  };

  const body = (
    <div className="ex">
      <div className="ex-list">
        <div className="ex-head" aria-hidden><span>Metric</span><span>Latest</span><span>1Y</span></div>
        <div role="listbox" aria-label={label} className="contents">
        {metrics.map((x, i) => (
          <button key={x.id} id={x.id} role="option" aria-selected={x.id === m.id} tabIndex={x.id === m.id ? 0 : -1}
            className="ex-row" onClick={() => pick(x.id)} onKeyDown={(e) => move(e, i)}>
            <span className="ex-l">{x.label}</span>
            <span className="ex-v">{x.value}</span>
            <span className={`ex-c ${x.change == null || !isFinite(x.change) ? "" : x.change >= 0 ? "is-up" : "is-down"}`}>
              {x.change == null || !isFinite(x.change) ? "" : pct(x.change)}
            </span>
            {x.id === m.id && <span className="ex-n">{x.note}</span>}
          </button>
        ))}
        </div>
        {aside && <div className="ex-aside">{aside}</div>}
      </div>
      <div className="ex-fig" aria-live="polite">
        <div className="ex-h">
          <div className="ex-t">{m.label}</div>
          <div className="ex-range" role="group" aria-label="Time range">
            {(["1y", "all"] as const).map((r) => (
              <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r === "1y" ? "1 year" : "All"}</button>
            ))}
          </div>
        </div>
        <div className="ex-chart"><Draw c={chart} /></div>
      </div>
    </div>
  );
  return m.tone ? <ToneScope tone={m.tone}>{body}</ToneScope> : body;
}

/** Section index: follows the scroll, jumps on click. Desktop only; phones scroll the page as written. */
export function Rail({ items }: { items: { id: string; label: string }[] }) {
  const [on, setOn] = useState(items[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setOn(vis[0].target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });
    items.forEach((i) => { const el = document.getElementById(i.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [items]);
  return (
    <nav className="rail" aria-label="On this page">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} aria-current={on === i.id ? "true" : undefined}>{i.label}</a>
      ))}
    </nav>
  );
}

/** A section's metrics and its diagram, wired together: pick a metric and its box lights up; click a box and its metric opens. */
export function Linked({ metrics, label, aside, figs }: { metrics: Metric[]; label: string; aside?: React.ReactNode; figs: Fig[] }) {
  const [sel, setSel] = useState(metrics[0]?.id);
  const m = metrics.find((x) => x.id === sel);
  const onNode = (fig: string, id: string) => { const hit = metrics.find((x) => x.node?.fig === fig && x.node.id === id); if (hit) { setSel(hit.id); history.replaceState(null, "", `#${hit.id}`); } };
  return (
    <div className="lk">
      <Explorer metrics={metrics} label={label} aside={aside} sel={sel} onSel={setSel} />
      <Diagrams figs={figs} focus={m?.node} onNode={onNode} />
    </div>
  );
}
