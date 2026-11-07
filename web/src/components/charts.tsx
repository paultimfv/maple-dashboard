"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, LineChart, Line, ComposedChart,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine, ReferenceDot, ReferenceArea,
} from "recharts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

type Row = Record<string, unknown>;

/* Two validated categorical palettes, fixed order, never cycled past 5 (validator: all checks pass in both modes).
   "maple" leads with Maple coral; "rh" (Robinhood sections) leads with Robinhood green and keeps blue between green
   and coral, the pair colorblind readers confuse. Light coral/amber/green sit below 3:1 on the card, so every chart
   keeps a legend + tooltip and the tables carry the values. Brand lime (#ccff00) is for UI accents only, never marks. */
const BASE = {
  light: { other: "#d8cec6", surface: "#f8f5f2", grid: "#ddd3cb", axis: "#8f8077", ink: "#1f140d", ink2: "#57483f", ref: "#8f8077" },
  dark: { other: "#4a4440", surface: "#1b1410", grid: "#3a2f28", axis: "#8d8681", ink: "#f6f3f0", ink2: "#c9c3be", ref: "#8d8681" },
};
const SERIES = {
  maple: { light: ["#f26b3a", "#2b6cb0", "#e8a33a", "#a8402a", "#1f9e8a"], dark: ["#e8663a", "#4b8fe0", "#bf8418", "#b83c3c", "#1f9e88"] },
  rh: { light: ["#6e9e00", "#2b6cb0", "#f26b3a", "#7a4fc9", "#e8a33a"], dark: ["#79a600", "#4b8fe0", "#e8663a", "#8a6be0", "#bf8418"] },
};
/* color follows the entity: Maple's tokens are always coral, Robinhood's USDG always green */
const ENTITY = { light: { maple: "#f26b3a", rh: "#6e9e00" }, dark: { maple: "#e8663a", rh: "#79a600" } };
const entityOf = (k: string): "maple" | "rh" | null => (k === "syrupUSDG" ? "maple" : k === "USDG" ? "rh" : null);

export type Tone = "maple" | "rh";
const ToneCtx = createContext<Tone>("maple");
/** sets the chart palette (and section accent) for everything inside */
export function ToneScope({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <ToneCtx.Provider value={tone}>{children}</ToneCtx.Provider>;
}
type Pal = (typeof BASE)["light"] & { dark: boolean; series: string[]; entity: { maple: string; rh: string } };

/** follows the <html data-theme> toggle and the OS setting */
export function usePalette(): Pal {
  const tone = useContext(ToneCtx);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const read = () => {
      const t = document.documentElement.dataset.theme;
      setDark(t === "dark" || (t !== "light" && mq.matches));
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    mq.addEventListener("change", read);
    return () => { mo.disconnect(); mq.removeEventListener("change", read); };
  }, []);
  const m = dark ? "dark" : "light";
  return { ...BASE[m], dark: m === "dark", series: SERIES[tone][m], entity: ENTITY[m] };
}

/** series named here render grey and go last in the stack (i.e. on top), so they don't interrupt the real buckets */
const MUTED_KEYS = new Set(["other"]);
/** key → color: entity keys take their entity color, "other" is grey, the rest take palette slots in order (skipping used ones) */
function colorsFor(pal: Pal, keys: string[]) {
  const out = new Map<string, string>(), used = new Set<string>();
  for (const k of keys) { const e = entityOf(k); if (e) { out.set(k, pal.entity[e]); used.add(pal.entity[e]); } }
  const free = pal.series.filter((c) => !used.has(c));
  let i = 0;
  for (const k of keys) {
    if (out.has(k)) continue;
    out.set(k, MUTED_KEYS.has(k) ? pal.other : free[Math.min(i++, free.length - 1)] ?? pal.series[0]);
  }
  return out;
}

/* readable names for column keys; anything unlisted falls back to "snake case → words" */
const LABELS: Record<string, string> = {
  syrup_revenue: "syrupUSD", pool_revenue: "Other pools", offchain_revenue: "Offchain", loans_syrupusdc: "syrupUSDC", loans_syrupusdt: "syrupUSDT",
  loans_syrupusdg: "syrupUSDG", loans_other: "Other pools", loans_total: "Loans outstanding", deposits_total: "Deposits",
  deposits_usd: "Lender deposits", collateral_usd: "Borrower collateral", ps_ttm: "P/S", revenue_yield_on_aum: "Revenue yield",
  new_lenders: "New", returning_lenders: "Returning", cumulative_lenders: "Lenders", new_borrowers: "New", existing_borrowers: "Existing",
  interest_paid_usd: "Interest paid", maple_share_of_earn: "syrupUSDG share", total_assets: "Pool AUM", loans_outstanding: "Loans outstanding",
  interest_to_depositors_usd: "To lenders", delegate_fee_usd: "Pool delegate", maple_fee_usd: "Maple", utilization: "Utilization",
  exch_rate: "Exchange rate", price_usd: "Price", syrup_held: "SYRUP held", amount_usd: "Bought back", avg_price: "Average price",
  originated_usd: "Originated", principal_outstanding_usd: "Outstanding",
  supply_usd: "Supply", capital_onchain_usd: "Capital on chain", eth_bridged_usd: "ETH bridged", llama_tvl_usd: "DeFiLlama TVL",
  maple_share_of_capital: "Share of capital", maple_share_of_llama_tvl: "Share of DeFiLlama TVL", txns: "Transactions",
  new_accounts: "New", active_accounts: "Active", l1_cost_usd: "L1 cost", sequencer_margin_usd: "Margin", new_aa_wallets: "Smart wallets",
  speculation: "Speculation", finance: "Finance", minted: "Minted", burned: "Burned", cumulative_shares: "Shares outstanding",
  allocated_usdg: "Allocated", new_users: "New", active_users: "Active", deposited_usd: "Deposited", net_flow_usd: "Net flow",
  usdg_native: "USDG minted", fees_usd: "Gas fees", bridged_in: "Bridged in", bridged_out: "Bridged out", cumulative_users: "Users", share: "Share",
};
export const label = (k: string) => LABELS[k] ?? k.replace(/_usd$/, "").replace(/_/g, " ");

export type Fmt = "usd" | "pct" | "rate" | "raw" | "mult" | "int";
const F: Record<Fmt, (v: number) => string> = { usd: fmtUsd, pct: fmtPct, rate: (v) => v.toFixed(4), raw: (v) => v.toLocaleString(), mult: (v) => `${v.toFixed(1)}x`, int: (v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 }) };
// axis ticks stay short: counts compact to 7.2M / 30K, everything else uses the normal formatter
const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${+(v / 1e3).toFixed(1)}K` : v.toLocaleString());
const AX: Record<Fmt, (v: number) => string> = { ...F, raw: compact, int: compact };
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// month-start dates (monthly series) render as "Mar '25"; anything else as "Mar 14"
const fmtDay = (d: unknown) => { const s = String(d); const m = MON[Number(s.slice(5, 7)) - 1]; if (!m) return s; return s.slice(8, 10) === "01" ? `${m} '${s.slice(2, 4)}` : `${m} ${s.slice(8, 10)}`; };
const fmtDayLong = (d: unknown) => { const s = String(d).slice(0, 10); const m = MON[Number(s.slice(5, 7)) - 1]; if (!m) return s; return s.slice(8, 10) === "01" ? `${m} ${s.slice(0, 4)}` : `${m} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}`; };

/* shared chrome: hairline solid grid, recessive axes, tooltip and legend on text tokens */
function chrome(pal: Pal, fmt: Fmt, x: string, legend: boolean) {
  const tick = { fill: pal.axis, fontSize: 11, fontFamily: "var(--font-num)" };
  return [
    <CartesianGrid key="g" stroke={pal.grid} strokeDasharray="1 3" vertical={false} />,
    <XAxis key="x" dataKey={x} tickFormatter={fmtDay} tick={tick} tickLine={false} axisLine={{ stroke: pal.ink2 }} minTickGap={36} padding={{ right: 4 }} />,
    <YAxis key="y" orientation="right" tickFormatter={AX[fmt]} width={56} tick={tick} tickLine={false} axisLine={false} />,
    <Tooltip key="t" cursor={{ stroke: pal.ink, strokeWidth: 1, fill: pal.grid, fillOpacity: 0.5 }}
      contentStyle={{ background: pal.ink, border: 0, borderRadius: 2, fontSize: 12, padding: "8px 10px", fontFamily: "var(--font-num)" }}
      labelStyle={{ color: pal.surface, fontWeight: 600, marginBottom: 4 }} itemStyle={{ color: pal.surface, padding: 0, opacity: 0.85 }}
      formatter={(v, n) => [F[fmt](Number(v)), label(String(n))]} labelFormatter={fmtDayLong} />,
    legend ? <Legend key="l" iconType="rect" iconSize={10} align="left" verticalAlign="top" itemSorter={null} wrapperStyle={{ paddingBottom: 10, marginLeft: -4 }}
      formatter={(v) => <span style={{ color: pal.ink2, fontSize: 12.5 }}>{label(String(v))}</span>} /> : null,
  ];
}

/** a stat's own history, so the number reads against where it has been */
function Spark({ d }: { d: number[] }) {
  const v = d.filter((x) => Number.isFinite(x));
  if (v.length < 3) return null;
  const lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || 1;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * 100, 26 - ((y - lo) / sp) * 24]);
  const [ex, ey] = pts[pts.length - 1];
  return (
    <div className="stat-spark" aria-hidden>
      <svg viewBox="0 0 100 28" preserveAspectRatio="none">
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <i style={{ left: `${ex}%`, top: `${(ey / 28) * 100}%` }} />
    </div>
  );
}

export function Counter({ label, value, sub, tone, spark, delta }: { label: string; value: string; sub?: string; tone?: "up" | "down"; spark?: number[]; delta?: number }) {
  return (
    <div className="stat">
      <div className="stat-l">{label}</div>
      <div className="stat-row">
        <div className={`stat-v ${tone === "up" ? "is-up" : tone === "down" ? "is-down" : ""}`}>{value}</div>
        {delta != null && Number.isFinite(delta) && <div className={`stat-d ${delta >= 0 ? "is-up" : "is-down"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(0)}% <span>y/y</span></div>}
      </div>
      {spark && <Spark d={spark} />}
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  );
}

/** a row of counters sharing hairline dividers, terminal-style */
export function Counters({ cols = "md:grid-cols-3 lg:grid-cols-6", children }: { cols?: string; children: React.ReactNode }) {
  return <div className={`stats grid grid-cols-2 ${cols}`}>{children}</div>;
}

export function Card({ title, sub, children, tall, wide, tone }: { title: string; sub?: string; children: React.ReactNode; tall?: boolean; wide?: boolean; tone?: Tone }) {
  if (tone) return <ToneScope tone={tone}><Card title={title} sub={sub} tall={tall} wide={wide}>{children}</Card></ToneScope>;
  return (
    <figure className={`fig ${wide ? "md:col-span-2" : ""}`}>
      <figcaption className="fig-h"><span className="fig-t">{title}</span>{sub && <span className="fig-s">{sub}</span>}</figcaption>
      <div className={tall ? "h-80" : "h-60"}>{children}</div>
    </figure>
  );
}

export function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="fig">
      <div className="fig-h"><span className="fig-t">{title}</span>{sub && <span className="fig-s">{sub}</span>}</div>
      {children}
    </div>
  );
}

export function Section({ n, title, lede, tone = "maple", children }: { n?: string; title: string; lede?: React.ReactNode; tone?: Tone; children: React.ReactNode }) {
  return (
    <ToneScope tone={tone}>
    <section className={`sec space-y-6 ${tone === "rh" ? "sec-rh" : ""}`} data-n={n}>
      <header className="sec-h">
        <h2 className="sec-t">{title}</h2>
        {lede && <div className="sec-l">{lede}</div>}
      </header>
      {children}
    </section>
    </ToneScope>
  );
}

/** how a number is built: one click away instead of a wall of small print */
export function Method({ title = "How these numbers are built", children }: { title?: string; children: React.ReactNode }) {
  return (
    <details className="method">
      <summary>{title}</summary>
      <div className="method-b">{children}</div>
    </details>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="max-w-4xl text-[11.5px] leading-relaxed text-muted">{children}</p>;
}

/** the series high, ringed and labelled with its date */
function peakMark(pal: Pal, data: Row[], x: string, y: string, fmt: Fmt) {
  const ok = data.filter((r) => r[y] != null && isFinite(Number(r[y])));
  if (ok.length < 3) return null;
  const pk = ok.reduce((a, b) => (Number(b[y]) > Number(a[y]) ? b : a));
  if (pk === ok[ok.length - 1]) return null;
  return <ReferenceDot key="peak" x={pk[x] as string} y={Number(pk[y])} r={3} fill={pal.surface} stroke={pal.ink} strokeWidth={1.5} ifOverflow="visible"
    label={{ value: `High ${F[fmt](Number(pk[y]))}, ${fmtDayLong(pk[x])}`, position: "right", offset: 8, fill: pal.ink2, fontSize: 11.5, fontFamily: "var(--font-num)" }} />;
}

/** the latest point, dotted and labelled, so the current value reads without hovering */
function endMark(pal: Pal, data: Row[], x: string, y: string, fmt: Fmt) {
  const last = [...data].reverse().find((r) => r[y] != null && isFinite(Number(r[y])));
  if (!last) return null;
  return <ReferenceDot key="end" x={last[x] as string} y={Number(last[y])} r={3.5} fill={pal.series[0]} stroke={pal.surface} strokeWidth={2} ifOverflow="visible"
    label={{ value: F[fmt](Number(last[y])), position: "left", offset: 10, fill: pal.ink, fontSize: 12, fontWeight: 600, fontFamily: "var(--font-num)" }} />;
}

const M = { top: 8, right: 0, left: 0, bottom: 0 };
/** past this many x points, bars get thinner than their gap; stacks switch to stacked areas */
const DENSE = 60;

function Areas({ pal, data, x, keys, fmt }: { pal: Pal; data: Row[]; x: string; keys: string[]; fmt: Fmt }) {
  const col = colorsFor(pal, keys);
  return (
    <ResponsiveContainer>
      <AreaChart data={data} margin={M}>
        {chrome(pal, fmt, x, keys.length > 1)}
        {keys.map((k) => <Area key={k} dataKey={k} stackId="1" stroke={col.get(k)} strokeWidth={1.5} fill={col.get(k)} fillOpacity={0.35} isAnimationActive={false} />)}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** stacked areas over named columns (absolute amounts) */
export function StackedAreas({ data, x, ys, fmt = "usd" }: { data: Row[]; x: string; ys: string[]; fmt?: Fmt }) {
  const pal = usePalette();
  return <Areas pal={pal} data={data} x={x} keys={ys} fmt={fmt} />;
}

/** one bar per category; `highlight` keys get their entity color, the rest stay neutral */
export function CategoryBars({ data, x, y, fmt = "usd", highlight = [] }: { data: Row[]; x: string; y: string; fmt?: Fmt; highlight?: string[] }) {
  const pal = usePalette();
  const tick = { fill: pal.axis, fontSize: 11, fontFamily: "var(--font-num)" };
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={M}>
        <CartesianGrid stroke={pal.grid} vertical={false} />
        <XAxis dataKey={x} interval={0} tick={tick} tickLine={false} axisLine={{ stroke: pal.grid }} />
        <YAxis tickFormatter={AX[fmt]} width={58} tick={tick} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: pal.grid, fillOpacity: 0.4 }} contentStyle={{ background: pal.surface, border: `1px solid ${pal.grid}`, borderRadius: 3, fontSize: 12 }}
          labelStyle={{ color: pal.ink, fontWeight: 600 }} itemStyle={{ color: pal.ink2, padding: 0 }} formatter={(v) => [F[fmt](Number(v)), label(y)]} />
        <Bar dataKey={y} maxBarSize={48} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {!highlight.length && (() => { const col = colorsFor(pal, data.map((r) => String(r[x]))); return data.map((r) => <Cell key={String(r[x])} fill={col.get(String(r[x]))} />); })()}
          {!!highlight.length && data.map((r) => { const k = String(r[x]), e = entityOf(k);
            return <Cell key={k} fill={highlight.includes(k) && e ? pal.entity[e] : highlight.includes(k) ? pal.series[0] : pal.other} />; })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** long → wide pivot for the stacked-by-category charts */
function pivot(data: Row[], x: string, y: string, group: string, max = 4) {
  // rank categories by their value at the latest x; past `max`, the rest fold into "other" (never a 6th hue)
  const lastX = data.reduce((m, r) => (String(r[x]) > m ? String(r[x]) : m), "");
  const size = new Map<string, number>();
  for (const r of data) if (String(r[x]) === lastX) size.set(String(r[group]), (size.get(String(r[group])) ?? 0) + Number(r[y]));
  const ranked = Array.from(new Set(data.map((r) => String(r[group])))).filter((k) => !MUTED_KEYS.has(k))
    .sort((a, b) => (size.get(b) ?? 0) - (size.get(a) ?? 0));
  const keep = new Set(ranked.slice(0, max));
  const fold = (k: string) => (keep.has(k) ? k : "other");
  const keys = [...ranked.slice(0, max), ...(ranked.length > max || data.some((r) => MUTED_KEYS.has(String(r[group]))) ? ["other"] : [])];
  const byX = new Map<string, Row>();
  for (const r of data) {
    const k = String(r[x]).slice(0, 10);
    if (!byX.has(k)) byX.set(k, { [x]: k });
    const g = fold(String(r[group])), row = byX.get(k)!;
    row[g] = Number(row[g] ?? 0) + Number(r[y]);
  }
  return { keys, wide: Array.from(byX.values()) };
}

/* bars: capped thickness, 4px rounded data-end on the top segment only, 1px surface gap between segments */
function bars(pal: Pal, keys: string[]) {
  const col = colorsFor(pal, keys);
  return keys.map((k, i) => (
    <Bar key={k} dataKey={k} stackId="1" fill={col.get(k)} maxBarSize={24} stroke={pal.surface} strokeWidth={1}
      radius={i === keys.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />
  ));
}

/** Stacked area by a category column — for shares / % only (sums to 100%). */
export function StackedArea({ data, x, y, group, fmt = "pct" }: { data: Row[]; x: string; y: string; group: string; fmt?: Fmt }) {
  const pal = usePalette();
  const { keys, wide } = pivot(data, x, y, group);
  return (
    <ResponsiveContainer>
      <AreaChart data={wide} margin={M}>
        {chrome(pal, fmt, x, true)}
        {(() => { const col = colorsFor(pal, keys); return keys.map((k) => <Area key={k} dataKey={k} stackId="1" stroke={col.get(k)} strokeWidth={1.5} fill={col.get(k)} fillOpacity={0.18} isAnimationActive={false} />); })()}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Stacked columns by a category column — for absolute amounts. */
export function StackedColumns({ data, x, y, group, fmt = "usd" }: { data: Row[]; x: string; y: string; group: string; fmt?: Fmt }) {
  const pal = usePalette();
  const { keys, wide } = pivot(data, x, y, group);
  if (wide.length > DENSE) return <Areas pal={pal} data={wide} x={x} keys={keys} fmt={fmt} />;
  return (
    <ResponsiveContainer>
      <BarChart data={wide} margin={M}>
        {chrome(pal, fmt, x, true)}
        {bars(pal, keys)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleArea({ data, x, y, fmt = "usd" }: { data: Row[]; x: string; y: string; fmt?: Fmt }) {
  const pal = usePalette();
  return (
    <ResponsiveContainer>
      <AreaChart data={data} margin={M}>
        {chrome(pal, fmt, x, false)}
        {endMark(pal, data, x, y, fmt)}
        <Area dataKey={y} stroke={pal.series[0]} strokeWidth={2} fill={pal.series[0]} fillOpacity={0.1} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** One series renders as a line over a faint wash; several render as plain lines with a legend. */
export function SimpleLine({ data, x, ys, fmt = "pct", peak }: { data: Row[]; x: string; ys: string[]; fmt?: Fmt; peak?: boolean }) {
  const pal = usePalette();
  if (ys.length === 1) {
    return (
      <ResponsiveContainer>
        <AreaChart data={data} margin={M}>
          {chrome(pal, fmt, x, false)}
          {peak && peakMark(pal, data, x, ys[0], fmt)}
          {endMark(pal, data, x, ys[0], fmt)}
          <Area dataKey={ys[0]} stroke={pal.series[0]} strokeWidth={2} fill={pal.series[0]} fillOpacity={0.06} dot={false}
            activeDot={{ r: 4, stroke: pal.surface, strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={M}>
        {chrome(pal, fmt, x, true)}
        {ys.map((y) => <Line key={y} dataKey={y} stroke={colorsFor(pal, ys).get(y)} dot={false} strokeWidth={2} activeDot={{ r: 4, stroke: pal.surface, strokeWidth: 2 }} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StackedBars({ data, x, ys, fmt = "usd" }: { data: Row[]; x: string; ys: string[]; fmt?: Fmt }) {
  const pal = usePalette();
  if (data.length > DENSE) return <Areas pal={pal} data={data} x={x} keys={ys} fmt={fmt} />;
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={M}>
        {chrome(pal, fmt, x, ys.length > 1)}
        {bars(pal, ys)}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Bars plus a line on ONE shared axis — only for two measures in the same unit and scale (e.g. deposits vs net flow). */
export function BarsAndLine({ data, x, bar, line, fmt = "usd" }: { data: Row[]; x: string; bar: string; line: string; fmt?: Fmt }) {
  const pal = usePalette();
  return (
    <ResponsiveContainer>
      <ComposedChart data={data} margin={M}>
        {chrome(pal, fmt, x, true)}
        <Bar dataKey={bar} fill={pal.series[0]} maxBarSize={24} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Line dataKey={line} stroke={pal.series[1]} dot={false} strokeWidth={2} connectNulls activeDot={{ r: 4, stroke: pal.surface, strokeWidth: 2 }} isAnimationActive={false} />
        <ReferenceLine y={0} stroke={pal.axis} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Table({ rows, cols }: { rows: Row[]; cols: { key: string; title: string; fmt?: Fmt | "addr" }[] }) {
  const f = (v: unknown, k?: Fmt | "addr") =>
    v == null ? "" : k === "addr" ? `${String(v).slice(0, 6)}…${String(v).slice(-4)}` : k && k !== "raw" ? F[k](Number(v)) : String(v);
  const numeric = (k?: Fmt | "addr") => k && k !== "addr";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead><tr className="border-b border-ink text-muted">
          {cols.map((c) => <th key={c.key} className={`py-1.5 pr-4 text-[11.5px] font-medium ${numeric(c.fmt) ? "text-right" : "text-left"}`}>{c.title}</th>)}
        </tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-t border-line hover:bg-wash">
            {cols.map((c, j) => <td key={c.key} className={`num whitespace-nowrap py-1.5 pr-4 tabular-nums ${numeric(c.fmt) ? "text-right" : "text-left"} ${j === 0 ? "text-ink" : "text-ink-2"}`}>{f(r[c.key], c.fmt)}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** Stacked bars with horizontal threshold lines (e.g. MIP-021 buyback tiers at $1.5M / $2M). */
export function StackedBarsWithLines({ data, x, ys, lines, bands = [], fmt = "usd" }: { data: Row[]; x: string; ys: string[]; lines: { y: number; label: string }[]; bands?: { from: number; to?: number; label: string }[]; fmt?: Fmt }) {
  const pal = usePalette();
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={M}>
        {chrome(pal, fmt, x, true)}
        {bands.map((b, i) => <ReferenceArea key={b.label} y1={b.from} y2={b.to} ifOverflow="extendDomain" fill={pal.series[0]} fillOpacity={0.07 + i * 0.06} stroke={pal.ref} strokeDasharray="3 3" strokeOpacity={0.6}
          label={{ value: b.label, position: "insideTopLeft", fill: pal.ink2, fontSize: 11, fontFamily: "var(--font-num)", offset: 6 }} />)}
        {bars(pal, ys)}
        {lines.map((l) => <ReferenceLine key={l.label} y={l.y} stroke={pal.ref} strokeDasharray="3 3"
          label={{ value: l.label, fill: pal.axis, fontSize: 10, fontFamily: "var(--font-num)", position: "insideTopLeft" }} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
