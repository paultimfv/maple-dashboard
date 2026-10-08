"use client";
import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, AreaChart, Area, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from "recharts";
import { usePalette } from "@/components/charts";
import type { ModelInputs } from "@/lib/queries";
import { fmtUsd } from "@/lib/fmt";

// Maple's cut of syrupUSDG interest: lenders earn 4.95%, Maple keeps 13.1% of gross interest
const LENDER_YIELD = 0.0495, MAPLE_CUT = 0.131;
const FEE_ON_SYRUP = (LENDER_YIELD / (1 - MAPLE_CUT)) * MAPLE_CUT;
const YEARS = ["2026 TTM", "2027E", "2028E", "2029E", "2030E"];

type Params = {
  s2028: number; s2030: number; coreShare: number; takeRate: number; earn2030: number;
  syrupShare: number; offchainMonthly: number; ps: number; retire: boolean;
};

type Row = { year: string; stablecoins: number; core: number; earn: number; syrup: number; deposits: number;
  coreRev: number; rhRev: number; offRev: number; revenue: number; tier: number; buybacks: number; mcap: number; supply: number; price: number };

function run(inp: ModelInputs, p: Params, steady = false): Row[] {
  const s0 = inp.stablecoins;
  const s28 = steady ? s0 * Math.pow(p.s2030 / s0, 0.5) : p.s2028;
  const S = [s0, Math.sqrt(s0 * s28), s28, Math.sqrt(s28 * p.s2030), p.s2030];
  const g = Math.pow(p.earn2030 / inp.earnTvl, 1 / 4);
  const earn = S.map((_, i) => inp.earnTvl * Math.pow(g, i));
  const syrup = earn.map((e, i) => (i === 0 ? inp.syrupOnEarn : e * p.syrupShare));
  const core = S.map((s, i) => (i === 0 ? inp.deposits - inp.syrupOnEarn : s * p.coreShare));
  const rows: Row[] = [];
  let supply = inp.supply;
  for (let i = 0; i < 5; i++) {
    let coreRev, rhRev, offRev, mcap;
    if (i === 0) {
      rhRev = inp.syrupOnEarn * FEE_ON_SYRUP; coreRev = inp.ttmOnchain - rhRev; offRev = inp.ttmOffchain; mcap = inp.mcap;
    } else {
      coreRev = ((core[i - 1] + core[i]) / 2) * p.takeRate;
      rhRev = ((syrup[i - 1] + syrup[i]) / 2) * FEE_ON_SYRUP;
      offRev = p.offchainMonthly * 12;
    }
    const revenue = coreRev + rhRev + offRev;
    const monthly = revenue / 12;
    const tier = monthly >= 2e6 ? 0.3 : monthly >= 1.5e6 ? 0.2 : 0.1;
    const buybacks = revenue * tier;
    if (i > 0) {
      mcap = revenue * p.ps;
      if (p.retire) supply = supply * (1 - buybacks / mcap);
    }
    rows.push({ year: YEARS[i], stablecoins: S[i], core: core[i], earn: earn[i], syrup: syrup[i], deposits: core[i] + syrup[i],
      coreRev, rhRev, offRev, revenue, tier, buybacks, mcap: mcap!, supply, price: mcap! / supply });
  }
  return rows;
}

const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;
const usd = (v: number) => (Math.abs(v) >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : fmtUsd(v));
const px = (v: number) => `$${v.toFixed(2)}`;

function Slider({ id, label, value, min, max, step, fmt, onChange, hint }: {
  id: string; label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-ink-2">{label}</label>
        <span className="font-mono text-sm tabular-nums text-ink">{fmt(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" />
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export default function Model({ inp }: { inp: ModelInputs }) {
  const base: Params = useMemo(() => ({
    s2028: 2e12, s2030: 3e12,
    coreShare: (inp.deposits - inp.syrupOnEarn) / inp.stablecoins,
    takeRate: inp.takeRateQ, earn2030: 5e9, syrupShare: inp.syrupOnEarn / inp.earnTvl,
    offchainMonthly: inp.offchainMonthlyQ, ps: inp.mcap / inp.ttmRevenue, retire: false,
  }), [inp]);
  const [p, setP] = useState<Params>(base);
  const set = (k: keyof Params) => (v: number | boolean) => setP((x) => ({ ...x, [k]: v }));

  const presets: { name: string; desc: string; p: Params }[] = [
    { name: "Base", desc: "Bessent path, today's share and multiple", p: base },
    { name: "Conservative", desc: "$1T stablecoins by 2030 (Bitwise's case)", p: { ...base, s2030: 1e12, s2028: inp.stablecoins * Math.sqrt(1e12 / inp.stablecoins) } },
    { name: "Bull", desc: "2025 share, SYRUP's median multiple, buybacks retire supply", p: { ...base, coreShare: inp.coreShare2025, ps: inp.psMedian, retire: true, offchainMonthly: inp.ttmOffchain / 12 } },
  ];

  const rows = useMemo(() => run(inp, p), [inp, p]);
  const end = rows[4];
  const mult = end.price / inp.price;

  const grid = useMemo(() => {
    const ss = [1e12, 2e12, 3e12];
    const ms = [10, p.ps, inp.psMedian];
    return { ss, ms, cells: ss.map((s) => ms.map((m) => run(inp, { ...p, s2030: s, ps: m }, true)[4].price)) };
  }, [inp, p]);

  const pal = usePalette();
  const tick = { fill: pal.axis, fontSize: 10.5, fontFamily: "var(--font-geist-mono)" };
  const tipStyle = { background: pal.surface, border: `1px solid ${pal.grid}`, borderRadius: 3, fontSize: 12 };

  const chart = rows.map((r) => ({ year: r.year, "core credit": r.coreRev, "Robinhood channel": r.rhRev, offchain: r.offRev, price: r.price }));

  return (
    <div className="grid gap-8">
      {/* headline */}
      <div className="grid gap-px overflow-hidden rounded-[3px] border border-line bg-line md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="bg-surface p-5">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted">SYRUP price, 2030</div>
          <div className="mt-2 text-5xl font-semibold tracking-tight">{px(end.price)}</div>
          <div className={`mt-1 text-sm ${mult >= 1 ? "text-up" : "text-down"}`}>{mult.toFixed(1)}x today&apos;s ${inp.price.toFixed(3)}</div>
        </div>
        {[["Revenue, 2030", usd(end.revenue), `vs ${usd(rows[0].revenue)} TTM`],
          ["Buybacks, 2030", usd(end.buybacks), `MIP-021 tier ${pct(end.tier, 0)}`],
          ["Market cap, 2030", usd(end.mcap), `${p.ps.toFixed(1)}x revenue`]].map(([l, v, s]) => (
          <div key={l} className="bg-surface p-5">
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted">{l}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{v}</div>
            <div className="mt-1 text-xs text-muted">{s}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* controls */}
        <div className="grid content-start gap-5 rounded-[3px] border border-line bg-surface p-5">
          <div className="flex flex-wrap gap-2">
            {presets.map((x) => (
              <button key={x.name} onClick={() => setP(x.p)} title={x.desc}
                className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:border-ink-2 hover:bg-wash">
                {x.name}
              </button>
            ))}
          </div>
          <div className="border-t border-line pt-3 font-mono text-[10.5px] uppercase tracking-wider text-muted">Market</div>
          <Slider id="s2030" label="Stablecoins in 2030" value={p.s2030} min={0.5e12} max={5e12} step={0.1e12} fmt={usd} onChange={set("s2030")} hint={`Today ${usd(inp.stablecoins)} · Bessent: $3T`} />
          <Slider id="s2028" label="Stablecoins in 2028" value={p.s2028} min={0.4e12} max={4e12} step={0.1e12} fmt={usd} onChange={set("s2028")} hint="Bessent: $2T" />
          <div className="border-t border-line pt-3 font-mono text-[10.5px] uppercase tracking-wider text-muted">Maple</div>
          <Slider id="share" label="Maple core share of stablecoins" value={p.coreShare} min={0.002} max={0.012} step={0.0001} fmt={(v) => pct(v)} onChange={set("coreShare")} hint={`Today ${pct(base.coreShare)} · end-2025 ${pct(inp.coreShare2025)}`} />
          <Slider id="take" label="Core take rate (revenue ÷ deposits)" value={p.takeRate} min={0.004} max={0.014} step={0.0001} fmt={(v) => pct(v)} onChange={set("takeRate")} hint={`Last 3 months ${pct(inp.takeRateQ)}`} />
          <Slider id="off" label="Offchain revenue per month" value={p.offchainMonthly} min={0} max={1.5e6} step={25000} fmt={usd} onChange={set("offchainMonthly")} hint={`Last 3 months ${usd(inp.offchainMonthlyQ)} · trailing year ${usd(inp.ttmOffchain / 12)}`} />
          <div className="border-t border-line pt-3 font-mono text-[10.5px] uppercase tracking-wider text-muted">Robinhood Earn</div>
          <Slider id="earn" label="Earn TVL in 2030" value={p.earn2030} min={0.5e9} max={20e9} step={0.5e9} fmt={usd} onChange={set("earn2030")} hint={`Today ${usd(inp.earnTvl)}`} />
          <Slider id="syr" label="syrupUSDG share of Earn" value={p.syrupShare} min={0.05} max={0.6} step={0.01} fmt={(v) => pct(v, 0)} onChange={set("syrupShare")} hint={`Today ${pct(base.syrupShare, 1)}`} />
          <div className="border-t border-line pt-3 font-mono text-[10.5px] uppercase tracking-wider text-muted">Valuation</div>
          <Slider id="ps" label="P/S multiple" value={p.ps} min={5} max={40} step={0.5} fmt={(v) => `${v.toFixed(1)}x`} onChange={set("ps")} hint={`Today ${base.ps.toFixed(1)}x · 2-year median ${inp.psMedian.toFixed(1)}x`} />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input id="retire" type="checkbox" checked={p.retire} onChange={(e) => set("retire")(e.target.checked)} className="" />
            Bought-back tokens leave circulation
          </label>
        </div>

        {/* outputs */}
        <div className="grid content-start gap-6">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="rounded-[3px] border border-line bg-surface p-4">
              <div className="mb-2 text-[13px] font-medium text-ink">Revenue by source</div>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={chart}>
                    <CartesianGrid stroke={pal.grid} vertical={false} />
                    <XAxis dataKey="year" tick={tick} tickLine={false} axisLine={{ stroke: pal.grid }} />
                    <YAxis tickFormatter={(v) => usd(Number(v))} tick={tick} tickLine={false} axisLine={false} width={58} />
                    <Tooltip cursor={{ fill: pal.grid, fillOpacity: 0.4 }} contentStyle={tipStyle} labelStyle={{ color: pal.ink, fontWeight: 600 }} itemStyle={{ color: pal.ink2, padding: 0 }} formatter={(v) => usd(Number(v))} />
                    <Legend iconType="square" iconSize={8} align="left" verticalAlign="top" itemSorter={null} wrapperStyle={{ paddingBottom: 8 }} formatter={(v) => <span style={{ color: pal.ink2, fontSize: 11.5 }}>{String(v)}</span>} />
                    {/* core credit = Maple coral, Robinhood channel = Robinhood green, offchain blue sits between so the two never touch */}
                    {([["core credit", pal.entity.maple], ["offchain", pal.series[1]], ["Robinhood channel", pal.entity.rh]] as const).map(([k, c], i) => (
                      <Bar key={k} dataKey={k} stackId="r" fill={c} maxBarSize={40} stroke={pal.surface} strokeWidth={1} radius={i === 2 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-[3px] border border-line bg-surface p-4">
              <div className="mb-2 text-[13px] font-medium text-ink">SYRUP price path <span className="font-normal text-muted">· dashed = today</span></div>
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={chart} margin={{ top: 28 }}>
                    <CartesianGrid stroke={pal.grid} vertical={false} />
                    <XAxis dataKey="year" tick={tick} tickLine={false} axisLine={{ stroke: pal.grid }} />
                    <YAxis tickFormatter={(v) => px(Number(v))} tick={tick} tickLine={false} axisLine={false} width={44} />
                    <Tooltip contentStyle={tipStyle} labelStyle={{ color: pal.ink, fontWeight: 600 }} itemStyle={{ color: pal.ink2, padding: 0 }} formatter={(v) => px(Number(v))} />
                    <ReferenceLine y={inp.price} stroke={pal.axis} strokeDasharray="3 3" />
                    <Area dataKey="price" stroke={pal.series[0]} strokeWidth={2} fill={pal.series[0]} fillOpacity={0.1}
                      dot={{ r: 3.5, fill: pal.series[0], stroke: pal.surface, strokeWidth: 2 }} activeDot={{ r: 5, stroke: pal.surface, strokeWidth: 2 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[3px] border border-line bg-surface p-4">
            <table className="w-full text-xs tabular-nums">
              <thead><tr className="text-left text-muted">
                <th className="py-1 pr-3 font-normal"></th>{rows.map((r) => <th key={r.year} className="py-1 pr-3 text-right font-normal">{r.year}</th>)}
              </tr></thead>
              <tbody className="font-mono">
                {([
                  ["Stablecoins", (r: Row) => usd(r.stablecoins)],
                  ["Maple deposits", (r: Row) => usd(r.deposits)],
                  ["  syrupUSDG on Earn", (r: Row) => usd(r.syrup)],
                  ["Robinhood Earn TVL", (r: Row) => usd(r.earn)],
                  ["Core credit revenue", (r: Row) => usd(r.coreRev)],
                  ["Robinhood channel revenue", (r: Row) => usd(r.rhRev)],
                  ["Offchain revenue", (r: Row) => usd(r.offRev)],
                  ["Total revenue", (r: Row) => usd(r.revenue)],
                  ["MIP-021 tier", (r: Row) => pct(r.tier, 0)],
                  ["Buybacks", (r: Row) => usd(r.buybacks)],
                  ["Market cap", (r: Row) => usd(r.mcap)],
                  ["Circulating supply", (r: Row) => `${(r.supply / 1e6).toFixed(0)}M`],
                  ["SYRUP price", (r: Row) => px(r.price)],
                ] as [string, (r: Row) => string][]).map(([l, f]) => (
                  <tr key={l} className={`border-t border-line ${l === "SYRUP price" || l === "Total revenue" ? "text-ink" : "text-ink-2"}`}>
                    <td className="whitespace-pre py-1.5 pr-3 font-sans">{l}</td>
                    {rows.map((r) => <td key={r.year} className="py-1.5 pr-3 text-right">{f(r)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-[3px] border border-line bg-surface p-4">
            <div className="mb-3 text-sm font-medium text-ink-2">2030 price by stablecoin market and multiple <span className="text-muted">(other inputs as set; steady growth to each 2030 level)</span></div>
            <table className="w-full text-sm tabular-nums">
              <thead><tr className="text-left text-muted">
                <th className="py-1 pr-3 font-normal">2030 stablecoins</th>
                {grid.ms.map((m, i) => <th key={i} className="py-1 pr-3 text-right font-normal">{m.toFixed(1)}x{i === 1 ? " (set)" : i === 2 ? " (median)" : ""}</th>)}
              </tr></thead>
              <tbody className="font-mono">
                {grid.ss.map((s, i) => (
                  <tr key={s} className="border-t border-line">
                    <td className="py-1.5 pr-3 font-sans text-ink-2">{usd(s)}</td>
                    {grid.cells[i].map((v, j) => (
                      <td key={j} className={`py-1.5 pr-3 text-right ${v >= inp.price ? "text-ink" : "text-down"}`}>{px(v)} <span className="text-muted">{(v / inp.price).toFixed(1)}x</span></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
