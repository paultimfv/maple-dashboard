"use client";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";

type Row = Record<string, unknown>;
const C = ["#7c9cff", "#f4b860", "#7bd389", "#ef7d7d", "#b088f9"];

import { fmtUsd, fmtPct } from "@/lib/fmt";

export type Fmt = "usd" | "pct" | "rate" | "raw";
const F: Record<Fmt, (v: number) => string> = { usd: fmtUsd, pct: fmtPct, rate: (v) => v.toFixed(4), raw: (v) => v.toLocaleString() };
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDay = (d: unknown) => { const s = String(d); return `${MON[Number(s.slice(5, 7)) - 1]} ${s.slice(8, 10)}`; };

const axis = { stroke: "#666", fontSize: 11 };
const grid = <CartesianGrid stroke="#222" vertical={false} />;
const tip = (f: (v: number) => string) => (
  <Tooltip contentStyle={{ background: "#141414", border: "1px solid #333", fontSize: 12 }} formatter={(v) => f(Number(v))} labelFormatter={(l) => String(l).slice(0, 10)} />
);

export function Counter({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 text-sm font-medium text-neutral-300">{title}</div>
      <div className="h-64">{children}</div>
    </div>
  );
}

/** long → wide pivot for the stacked-by-category charts */
function pivot(data: Row[], x: string, y: string, group: string) {
  const keys = Array.from(new Set(data.map((r) => String(r[group]))));
  const byX = new Map<string, Row>();
  for (const r of data) {
    const k = String(r[x]).slice(0, 10);
    if (!byX.has(k)) byX.set(k, { [x]: k });
    byX.get(k)![String(r[group])] = Number(r[y]);
  }
  return { keys, wide: Array.from(byX.values()) };
}

/** Stacked area by a category column — for shares / % only (sums to 100%). */
export function StackedArea({ data, x, y, group, fmt = "pct" }: { data: Row[]; x: string; y: string; group: string; fmt?: Fmt }) {
  const { keys, wide } = pivot(data, x, y, group);
  return (
    <ResponsiveContainer>
      <AreaChart data={wide}>
        {grid}
        <XAxis dataKey={x} tickFormatter={fmtDay} {...axis} />
        <YAxis tickFormatter={F[fmt]} width={64} {...axis} />
        {tip(F[fmt])}
        <Legend />
        {keys.map((k, i) => <Area key={k} dataKey={k} stackId="1" stroke={C[i % C.length]} fill={C[i % C.length]} fillOpacity={0.35} />)}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Stacked columns by a category column — for absolute amounts. */
export function StackedColumns({ data, x, y, group, fmt = "usd" }: { data: Row[]; x: string; y: string; group: string; fmt?: Fmt }) {
  const { keys, wide } = pivot(data, x, y, group);
  return (
    <ResponsiveContainer>
      <BarChart data={wide}>
        {grid}
        <XAxis dataKey={x} tickFormatter={fmtDay} {...axis} />
        <YAxis tickFormatter={F[fmt]} width={64} {...axis} />
        {tip(F[fmt])}
        <Legend />
        {keys.map((k, i) => <Bar key={k} dataKey={k} stackId="1" fill={C[i % C.length]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleArea({ data, x, y, fmt = "usd" }: { data: Row[]; x: string; y: string; fmt?: Fmt }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={data}>
        {grid}
        <XAxis dataKey={x} tickFormatter={fmtDay} {...axis} />
        <YAxis tickFormatter={F[fmt]} width={64} {...axis} />
        {tip(F[fmt])}
        <Area dataKey={y} stroke={C[0]} fill={C[0]} fillOpacity={0.3} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleLine({ data, x, ys, fmt = "pct" }: { data: Row[]; x: string; ys: string[]; fmt?: Fmt }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data}>
        {grid}
        <XAxis dataKey={x} tickFormatter={fmtDay} {...axis} />
        <YAxis tickFormatter={F[fmt]} width={64} {...axis} />
        {tip(F[fmt])}
        {ys.length > 1 && <Legend />}
        {ys.map((y, i) => <Line key={y} dataKey={y} stroke={C[i % C.length]} dot={false} strokeWidth={2} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StackedBars({ data, x, ys, fmt = "usd" }: { data: Row[]; x: string; ys: string[]; fmt?: Fmt }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        {grid}
        <XAxis dataKey={x} tickFormatter={fmtDay} {...axis} />
        <YAxis tickFormatter={F[fmt]} width={64} {...axis} />
        {tip(F[fmt])}
        <Legend />
        {ys.map((y, i) => <Bar key={y} dataKey={y} stackId="1" fill={C[i % C.length]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarsPlusLine({ data, x, bar, line, fmt = "usd" }: { data: Row[]; x: string; bar: string; line: string; fmt?: Fmt }) {
  return (
    <ResponsiveContainer>
      <ComposedChart data={data}>
        {grid}
        <XAxis dataKey={x} tickFormatter={fmtDay} {...axis} />
        <YAxis yAxisId="l" tickFormatter={F[fmt]} width={64} {...axis} />
        <YAxis yAxisId="r" orientation="right" tickFormatter={F[fmt]} width={64} {...axis} />
        {tip(F[fmt])}
        <Legend />
        <Bar yAxisId="l" dataKey={bar} fill={C[0]} />
        <Line yAxisId="r" dataKey={line} stroke={C[1]} dot={false} strokeWidth={2} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Table({ rows, cols }: { rows: Row[]; cols: { key: string; title: string; fmt?: Fmt | "addr" }[] }) {
  const f = (v: unknown, k?: Fmt | "addr") =>
    v == null ? "" : k === "addr" ? `${String(v).slice(0, 6)}…${String(v).slice(-4)}` : k && k !== "raw" ? F[k](Number(v)) : String(v);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-neutral-500">{cols.map((c) => <th key={c.key} className="py-1 pr-3 font-normal">{c.title}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-t border-neutral-800">{cols.map((c) => <td key={c.key} className="py-1 pr-3 font-mono">{f(r[c.key], c.fmt)}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
