"use client";
import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, AreaChart, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { usePalette } from "@/components/charts";
import { fmtUsd } from "@/lib/fmt";
import { YEARS, HIST, BASE, ACTUALS, run, type Params, type Row } from "@/lib/syrup-model";

const pct = (v: number | null, d = 2) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const usd = (v: number) => (Math.abs(v) >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : fmtUsd(v));
const px = (v: number) => `$${v.toFixed(4)}`;
const today = ACTUALS[HIST - 1];
const SCENARIOS: { name: string; desc: string; p: Params }[] = [
  { name: "Bear", desc: "$1T stablecoins by 2030, 2025 take rate (0.75%), 5x P/S", p: { ...BASE, stable2030: 1e12, takeRate: ACTUALS[1].takeRate, ps: 5 } },
  { name: "Base", desc: "Paul's base model", p: BASE },
  { name: "Bull", desc: "Maple back to its 2025 share of yield stablecoins (16%), 15x P/S", p: { ...BASE, mapleShare: ACTUALS[1].mapleShareYield!, ps: 15 } },
];
const same = (a: Params, b: Params) => (Object.keys(a) as (keyof Params)[]).every((k) => a[k] === b[k]);

function Slider({ id, label, value, min, max, step, fmt, onChange, hint }: {
  id: string; label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-ink-2">{label}</label>
        <span className="num text-sm font-semibold text-ink">{fmt(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

type Line = [string, (r: Row) => string] | string;
const LINES: Line[] = [
  "Growth drivers",
  ["Total stablecoin supply", (r) => usd(r.stablecoins)],
  ["Supply growth", (r) => pct(r.growth)],
  ["Yield stablecoins (top 15)", (r) => (r.yieldStables == null ? "—" : usd(r.yieldStables))],
  ["Yield share of stablecoins", (r) => pct(r.yieldShare)],
  ["Onchain loans outstanding", (r) => usd(r.onchainLoans)],
  ["Loans share of stablecoins", (r) => pct(r.loanShare)],
  "Protocol balances",
  ["Maple share of yield stables", (r) => pct(r.mapleShareYield)],
  ["syrupUSD supply", (r) => usd(r.syrupUSD)],
  ["Loan book (deposits)", (r) => usd(r.loanBook)],
  ["Loans outstanding", (r) => usd(r.loans)],
  ["Utilization", (r) => pct(r.utilization)],
  ["Collateral", (r) => usd(r.collateral)],
  ["Assets under management", (r) => usd(r.aum)],
  ["Maple share of onchain loans", (r) => pct(r.mapleShareLoans)],
  ...[0, 1, 2, 3].flatMap((k): Line[] => [
    [`${ACTUALS[2].pools[k].name} deposits`, (r) => usd(r.pools[k].deposits)],
    [`${ACTUALS[2].pools[k].name} loans`, (r) => usd(r.pools[k].loans)],
  ]),
  "Protocol revenue",
  ["syrupUSD revenue", (r) => usd(r.syrupUSDRev)],
  ["Pool revenue", (r) => usd(r.poolRev)],
  ["OTC revenue", (r) => usd(r.otcRev)],
  ["Total revenue", (r) => usd(r.revenue)],
  ["Take rate on loans", (r) => pct(r.takeRate)],
  "Token buybacks",
  ["Monthly revenue", (r) => usd(r.monthlyRev)],
  ["Buyback rate (MIP-021)", (r) => pct(r.buybackRate)],
  ["SYRUP buybacks", (r) => usd(r.buybacks)],
  "Token valuation",
  ["SYRUP FDV", (r) => usd(r.fdv)],
  ["Circulating supply", (r) => `${(r.supply / 1e6).toFixed(0)}M`],
  ["P/S (FDV ÷ revenue)", (r) => `${r.ps.toFixed(1)}x`],
  ["SYRUP price", (r) => px(r.price)],
];
const BOLD = new Set(["Total revenue", "SYRUP price", "SYRUP buybacks"]);

export default function Model() {
  const [p, setP] = useState<Params>(BASE);
  const set = (k: keyof Params) => (v: number) => setP((x) => ({ ...x, [k]: v }));
  const rows = useMemo(() => run(p), [p]);
  const end = rows[rows.length - 1];
  const mult = end.price / today.price;

  const grid = useMemo(() => {
    const ss = [1e12, 2e12, 3e12, 5e12];
    const ms = [5, 9.4, 15, 25];
    return { ss, ms, cells: ss.map((s) => ms.map((m) => { const r = run({ ...p, stable2030: s, ps: m }); return r[r.length - 1].price; })) };
  }, [p]);

  const pal = usePalette();
  const tick = { fill: pal.axis, fontSize: 11, fontFamily: "var(--font-num)" };
  const tipStyle = { background: pal.ink, border: 0, borderRadius: 2, fontSize: 12, color: pal.surface };
  const chart = rows.map((r, i) => ({ year: YEARS[i], revenue: r.revenue, price: r.price }));

  return (
    <div className="grid gap-8">
      <div className="grid items-end gap-x-10 gap-y-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <div className="text-[14px] text-ink-2">SYRUP price in 2030, {SCENARIOS.find((x) => same(p, x.p))?.name.toLowerCase().concat(" case") ?? "on these settings"}</div>
          <div className="mt-2 text-[40px] font-bold leading-none tracking-[-0.03em] text-ink">{px(end.price)}</div>
          <div className={`mt-2 text-[14px] font-semibold ${mult >= 1 ? "text-up" : "text-down"}`}>{mult.toFixed(1)}× the 2026 price of {px(today.price)}</div>
        </div>
        <div className="stats grid grid-cols-3">
          {[["Revenue", usd(end.revenue), `vs ${usd(today.revenue)} in 2026 YTD`],
            ["Buybacks", usd(end.buybacks), `MIP-021 rate ${pct(end.buybackRate, 0)}`],
            ["FDV", usd(end.fdv), `${p.ps.toFixed(1)}× revenue`]].map(([l, v, sub]) => (
            <div key={l} className="stat"><div className="stat-l">{l}, 2030</div><div className="stat-v">{v}</div><div className="stat-s">{sub}</div></div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="grid content-start gap-5 self-start rounded-[2px] border-t-2 border-ink bg-surface p-5">
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((x) => (
              <button key={x.name} onClick={() => setP(x.p)} title={x.desc}
                className={`rounded-full border border-ink px-3.5 py-1.5 text-[13px] font-medium text-ink hover:bg-ink hover:text-page ${same(p, x.p) ? "bg-ink text-page" : ""}`}>
                {x.name}
              </button>
            ))}
          </div>
          <div className="border-t border-line pt-4 text-[13px] font-bold tracking-tight text-ink">Market</div>
          <Slider id="s2030" label="Stablecoins in 2030" value={p.stable2030} min={0.5e12} max={5e12} step={0.1e12} fmt={usd} onChange={set("stable2030")}
            hint={`2026 ${usd(today.stablecoins)} · ${pct(rows[3].growth, 1)} a year to get there`} />
          <Slider id="ys" label="Yield stablecoins, share of all" value={p.yieldShare} min={0.01} max={0.15} step={0.0005} fmt={(v) => pct(v)} onChange={set("yieldShare")} hint={`2026 ${pct(BASE.yieldShare)}`} />
          <Slider id="ls" label="Onchain loans, share of stablecoins" value={p.loanShare} min={0.05} max={0.25} step={0.0005} fmt={(v) => pct(v)} onChange={set("loanShare")} hint={`2026 ${pct(BASE.loanShare)} · only moves Maple's share of loans`} />
          <div className="border-t border-line pt-4 text-[13px] font-bold tracking-tight text-ink">Maple</div>
          <Slider id="ms" label="Maple share of yield stablecoins" value={p.mapleShare} min={0.03} max={0.3} step={0.001} fmt={(v) => pct(v)} onChange={set("mapleShare")} hint={`2026 ${pct(BASE.mapleShare)} · 2025 ${pct(ACTUALS[1].mapleShareYield)}`} />
          <Slider id="ut" label="Utilization (loans ÷ deposits)" value={p.utilization} min={0.8} max={1} step={0.001} fmt={(v) => pct(v)} onChange={set("utilization")} hint={`2026 ${pct(BASE.utilization)}`} />
          <Slider id="tr" label="Take rate on loans" value={p.takeRate} min={0.004} max={0.02} step={0.0001} fmt={(v) => pct(v)} onChange={set("takeRate")} hint={`2026 ${pct(BASE.takeRate)} · 2025 ${pct(ACTUALS[1].takeRate)}`} />
          <div className="border-t border-line pt-4 text-[13px] font-bold tracking-tight text-ink">Valuation</div>
          <Slider id="ps" label="P/S multiple" value={p.ps} min={3} max={40} step={0.1} fmt={(v) => `${v.toFixed(1)}x`} onChange={set("ps")} hint={`2026 ${today.ps.toFixed(1)}x · 2025 ${ACTUALS[1].ps.toFixed(1)}x`} />
          <Slider id="sup" label="Circulating supply" value={p.supply} min={1e9} max={1.5e9} step={5e6} fmt={(v) => `${(v / 1e6).toFixed(0)}M`} onChange={set("supply")} hint={`2026 ${(BASE.supply / 1e6).toFixed(0)}M`} />
        </div>

        <div className="grid content-start gap-6">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="fig">
              <div className="fig-t mb-3 block">Revenue <span className="font-normal text-muted">· pools; OTC shown separately in the table</span></div>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={chart}>
                    <CartesianGrid stroke={pal.grid} vertical={false} />
                    <XAxis dataKey="year" tick={tick} tickLine={false} axisLine={{ stroke: pal.grid }} />
                    <YAxis orientation="right" tickFormatter={(v) => usd(Number(v))} tick={tick} tickLine={false} axisLine={false} width={58} />
                    <Tooltip cursor={{ fill: pal.grid, fillOpacity: 0.4 }} contentStyle={tipStyle} labelStyle={{ color: pal.surface, fontWeight: 600 }} itemStyle={{ color: pal.surface, padding: 0 }} formatter={(v) => usd(Number(v))} />
                    <Bar dataKey="revenue" fill={pal.entity.maple} maxBarSize={40} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="fig">
              <div className="fig-t mb-3 block">SYRUP price <span className="font-normal text-muted">· dashed = 2026</span></div>
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={chart} margin={{ top: 28 }}>
                    <CartesianGrid stroke={pal.grid} vertical={false} />
                    <XAxis dataKey="year" tick={tick} tickLine={false} axisLine={{ stroke: pal.grid }} />
                    <YAxis orientation="right" tickFormatter={(v) => `$${Number(v).toFixed(2)}`} tick={tick} tickLine={false} axisLine={false} width={44} />
                    <Tooltip contentStyle={tipStyle} labelStyle={{ color: pal.surface, fontWeight: 600 }} itemStyle={{ color: pal.surface, padding: 0 }} formatter={(v) => px(Number(v))} />
                    <ReferenceLine y={today.price} stroke={pal.axis} strokeDasharray="3 3" />
                    <Area dataKey="price" stroke={pal.series[0]} strokeWidth={2} fill={pal.series[0]} fillOpacity={0.1}
                      dot={{ r: 3.5, fill: pal.series[0], stroke: pal.surface, strokeWidth: 2 }} activeDot={{ r: 5, stroke: pal.surface, strokeWidth: 2 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="fig overflow-x-auto">
            <div className="fig-t mb-2 block">2030 price by stablecoin supply and P/S <span className="font-normal text-muted">· other settings as set</span></div>
            <table className="w-full text-xs tabular-nums">
              <thead><tr className="text-left text-muted">
                <th className="py-1 pr-3 font-normal">Stablecoins 2030</th>
                {grid.ms.map((m) => <th key={m} className="py-1 pr-3 text-right font-normal">{m}x</th>)}
              </tr></thead>
              <tbody className="num">
                {grid.ss.map((s, i) => (
                  <tr key={s} className="border-t border-line">
                    <td className="py-1.5 pr-3 font-sans text-ink-2">{usd(s)}</td>
                    {grid.cells[i].map((v, j) => (
                      <td key={j} className={`py-1.5 pr-3 text-right ${v >= today.price ? "text-ink" : "text-down"}`}>{px(v)} <span className="text-muted">{(v / today.price).toFixed(1)}x</span></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="fig overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs tabular-nums">
          <thead><tr className="text-left text-muted">
            <th className="py-1 pr-3 font-normal"></th>
            {YEARS.map((y, i) => <th key={y} className={`py-1 pr-3 text-right font-normal ${i === HIST ? "border-l border-line pl-3" : ""}`}>{y}</th>)}
          </tr></thead>
          <tbody className="num">
            {LINES.map((l) => typeof l === "string" ? (
              <tr key={l}><td colSpan={YEARS.length + 1} className="pt-4 pb-1 font-sans text-[11px] font-bold uppercase tracking-wide text-ink">{l}</td></tr>
            ) : (
              <tr key={l[0]} className={`border-t border-line ${BOLD.has(l[0]) ? "font-semibold text-ink" : ""}`}>
                <td className="py-1.5 pr-3 font-sans text-ink-2">{l[0]}</td>
                {rows.map((r, i) => <td key={i} className={`py-1.5 pr-3 text-right ${i < HIST ? "text-muted" : ""} ${i === HIST ? "border-l border-line pl-3" : ""}`}>{l[1](r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">2024–2026 are actuals (2026 to 31 Oct). Forecast: stablecoins compound to the 2030 setting; yield stables, onchain loans and syrupUSD follow their shares; deposits stay 1.26× syrupUSD and collateral 1.39× loans, as in 2026; pool revenue = average loans over the year × take rate; OTC revenue is a separate line that grows with it; buybacks follow MIP-021; FDV = revenue × P/S; price = FDV ÷ circulating supply.</p>
      </div>
    </div>
  );
}
