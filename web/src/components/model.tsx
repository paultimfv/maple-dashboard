"use client";
import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, AreaChart, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { usePalette } from "@/components/charts";
import { fmtUsd } from "@/lib/fmt";
import { YEARS, HIST, ROWS, params, run, type Params, type Col, type Assumptions, type Scenario } from "@/lib/syrup-model";
import { modelActuals } from "@/lib/model-actuals";
import assumptions from "../../config/syrup-model-assumptions.json";

const AS = assumptions as Assumptions;
const A = modelActuals();
const pct = (v: number | null | undefined, d = 2) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const usd = (v: number) => (Math.abs(v) >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : fmtUsd(v));
const px = (v: number) => `$${v.toFixed(4)}`;
const tok = (v: number) => `${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
const n = (c: Col, r: number) => Number(c[r] ?? 0);
const BASE = params(A, AS, "base");
const E = run(A, BASE)[HIST - 1];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longDate = (d: string) => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const SCENARIOS: { id: Scenario; name: string; desc: string; p: Params; draft: boolean }[] = (["bear", "base", "bull"] as const).map((id) => ({
  id, name: id[0].toUpperCase() + id.slice(1), p: params(A, AS, id), draft: !!AS.scenarios[id]?.flag_for_paul,
  desc: id === "base" ? "The sheet's base case" : AS.scenarios[id]?.tooltip ?? "",
}));
const same = (a: Params, b: Params) => JSON.stringify(a) === JSON.stringify(b);

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

const FMT = { usd: (v: number) => usd(v), pct: (v: number) => pct(v), tokens: tok, mult: (v: number) => `${v.toFixed(2)}x`, price: px };
const SECTION: Record<number, string> = { 4: "Growth drivers", 12: "Protocol balances", 32: "Protocol revenue", 38: "Token buybacks", 43: "Token valuation" };
const BOLD = new Set([35, 40, 43, 48]);

export default function Model({ livePrice, liveDay }: { livePrice?: number; liveDay?: string }) {
  const [p, setP] = useState<Params>(BASE);
  const set = (k: keyof Params) => (v: number) => setP((x) => ({ ...x, [k]: v }));
  const setPath = (k: "share12" | "share19") => (v: number) => setP((x) => ({ ...x, [k]: [v, v, v, v] }));
  const rows = useMemo(() => run(A, p), [p]);
  const end = rows[rows.length - 1];
  const ref = n(E, 48);
  const sc = SCENARIOS.find((x) => same(p, x.p));

  const grid = useMemo(() => {
    const ss = [1e12, 2e12, 3e12, 5e12];
    const ms = [5.3, 9.4, 14, 20];
    return { ss, ms, cells: ss.map((s) => ms.map((m) => n(run(A, { ...p, stable2030: s, ps: m })[6], 48))) };
  }, [p]);

  const pal = usePalette();
  const tick = { fill: pal.axis, fontSize: 11, fontFamily: "var(--font-num)" };
  const tipStyle = { background: pal.ink, border: 0, borderRadius: 2, fontSize: 12, color: pal.surface };
  const chart = rows.map((r, i) => ({ year: YEARS[i], revenue: n(r, 35), price: n(r, 48) }));

  return (
    <div className="grid gap-8">
      <div className="grid items-end gap-x-10 gap-y-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <div className="text-[14px] text-ink-2">SYRUP price in 2030, {sc ? `${sc.id} case` : "on these settings"}</div>
          <div className="mt-2 text-[40px] font-bold leading-none tracking-[-0.03em] text-ink">{px(n(end, 48))}</div>
          <div className={`mt-2 text-[14px] font-semibold ${n(end, 48) >= ref ? "text-up" : "text-down"}`}>{(n(end, 48) / ref).toFixed(1)}× the 2026 reference price of {px(ref)}</div>
          {livePrice ? <div className="mt-1 text-[13px] text-muted">{(n(end, 48) / livePrice).toFixed(1)}× the market price of ${livePrice.toFixed(3)} on {liveDay ? longDate(liveDay) : "the latest day"} (CoinGecko)</div> : null}
        </div>
        <div className="stats grid grid-cols-3">
          {[["Revenue", usd(n(end, 35)), `vs ${usd(n(E, 35))} in 2026 to ${longDate(A.as_of).replace(/^\d+ /, "").replace(/ \d+$/, "")}`],
            ["Buybacks", usd(n(end, 40)), `flat ${pct(p.buybackRate, 0)} of revenue`],
            ["Market cap", usd(n(end, 43)), `${p.ps.toFixed(1)}× revenue, exit multiple`]].map(([l, v, sub]) => (
            <div key={l} className="stat"><div className="stat-l">{l}, 2030</div><div className="stat-v">{v}</div><div className="stat-s">{sub}</div></div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="grid content-start gap-5 self-start rounded-[2px] border-t-2 border-ink bg-surface p-5">
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((x) => (
              <button key={x.id} onClick={() => setP(x.p)} title={x.desc}
                className={`rounded-full border border-ink px-3.5 py-1.5 text-[13px] font-medium text-ink hover:bg-ink hover:text-page ${sc?.id === x.id ? "bg-ink text-page" : ""}`}>
                {x.name}
              </button>
            ))}
          </div>
          <div className="-mt-2 text-xs text-muted">{sc && sc.id !== "base" ? `${sc.desc} Provisional: Bear and Bull are still being checked.` : "Bear and Bull are provisional."}</div>
          <div className="border-t border-line pt-4 text-[13px] font-bold tracking-tight text-ink">Market</div>
          <Slider id="s2030" label="Stablecoins in 2030" value={p.stable2030} min={0.5e12} max={5e12} step={0.1e12} fmt={usd} onChange={set("stable2030")}
            hint={`2026 ${usd(n(E, 4))} · ${pct(n(rows[3], 5), 1)} a year to get there. Base $2T: the $2T-by-2028 call (Standard Chartered, Bessent) two years later; $3T is upside.`} />
          <Slider id="ys" label="Yield stablecoins, share of all" value={p.yieldShare} min={0.01} max={0.15} step={0.0005} fmt={(v) => pct(v)} onChange={set("yieldShare")} hint={`2026 ${pct(BASE.yieldShare)}`} />
          <Slider id="ls" label="Onchain loans, share of stablecoins" value={p.loanShare} min={0.05} max={0.25} step={0.0005} fmt={(v) => pct(v)} onChange={set("loanShare")} hint={`2026 ${pct(BASE.loanShare)}`} />
          <div className="border-t border-line pt-4 text-[13px] font-bold tracking-tight text-ink">Maple</div>
          <Slider id="ml" label="Maple share of onchain loans, 2030" value={p.share19[3]} min={0.02} max={0.2} step={0.0005} fmt={(v) => pct(v)} onChange={setPath("share19")} hint={`2026 ${pct(n(E, 19))} · sets the loan book, and so revenue`} />
          <Slider id="ms" label="Maple share of yield stablecoins, 2030" value={p.share12[3]} min={0.03} max={0.35} step={0.001} fmt={(v) => pct(v)} onChange={setPath("share12")} hint={`2026 ${pct(n(E, 12))} · moves the syrupUSD line only`} />
          <Slider id="ut" label="Utilization (loans ÷ deposits)" value={p.utilization} min={0.8} max={1} step={0.001} fmt={(v) => pct(v)} onChange={set("utilization")} hint={`2026 ${pct(BASE.utilization)}`} />
          <Slider id="tr" label="Take rate on average loans" value={p.takeRate} min={0.004} max={0.02} step={0.0001} fmt={(v) => pct(v)} onChange={set("takeRate")} hint={`2026 ${pct(BASE.takeRate)} annualised · 2025 ${pct(n(rows[1], 36))}`} />
          <Slider id="bb" label="Buyback rate" value={p.buybackRate} min={0} max={0.5} step={0.01} fmt={(v) => pct(v, 0)} onChange={set("buybackRate")} hint={`2026 ${pct(n(E, 39))} actual · MIP-021 tiers would be 30%`} />
          <div className="border-t border-line pt-4 text-[13px] font-bold tracking-tight text-ink">Valuation</div>
          <Slider id="ps" label="P/S exit multiple (market cap ÷ revenue)" value={p.ps} min={3} max={40} step={0.1} fmt={(v) => `${v.toFixed(1)}x`} onChange={set("ps")} hint={`2026 ${n(E, 47).toFixed(1)}x · 2025 ${n(rows[1], 47).toFixed(1)}x`} />
          <Slider id="sup" label="Circulating supply" value={p.circ} min={1e9} max={1.3e9} step={1e6} fmt={(v) => `${(v / 1e6).toFixed(0)}M`} onChange={set("circ")} hint={`${longDate(A.as_of)} ${tok(n(E, 46))} · total supply ${tok(n(E, 45))}, not used for price`} />
        </div>

        <div className="grid content-start gap-6">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="fig">
              <div className="fig-t mb-3 block">Total revenue <span className="font-normal text-muted">· pools + other</span></div>
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
              <div className="fig-t mb-3 block">SYRUP price <span className="font-normal text-muted">· dashed = 2026 reference</span></div>
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={chart} margin={{ top: 28 }}>
                    <CartesianGrid stroke={pal.grid} vertical={false} />
                    <XAxis dataKey="year" tick={tick} tickLine={false} axisLine={{ stroke: pal.grid }} />
                    <YAxis orientation="right" tickFormatter={(v) => `$${Number(v).toFixed(2)}`} tick={tick} tickLine={false} axisLine={false} width={44} />
                    <Tooltip contentStyle={tipStyle} labelStyle={{ color: pal.surface, fontWeight: 600 }} itemStyle={{ color: pal.surface, padding: 0 }} formatter={(v) => px(Number(v))} />
                    <ReferenceLine y={ref} stroke={pal.axis} strokeDasharray="3 3" />
                    <Area dataKey="price" stroke={pal.series[0]} strokeWidth={2} fill={pal.series[0]} fillOpacity={0.1}
                      dot={{ r: 3.5, fill: pal.series[0], stroke: pal.surface, strokeWidth: 2 }} activeDot={{ r: 5, stroke: pal.surface, strokeWidth: 2 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="fig overflow-x-auto">
            <div className="fig-t mb-2 block">2030 price by stablecoin supply and P/S <span className="font-normal text-muted">· other settings as set; × the 2026 reference price</span></div>
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
                      <td key={j} className={`py-1.5 pr-3 text-right ${v >= ref ? "text-ink" : "text-down"}`}>{px(v)} <span className="text-muted">{(v / ref).toFixed(1)}x</span></td>
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
            {ROWS.flatMap((r) => [
              ...(SECTION[r.row] ? [<tr key={`s${r.row}`}><td colSpan={YEARS.length + 1} className="pt-4 pb-1 font-sans text-[11px] font-bold uppercase tracking-wide text-ink">{SECTION[r.row]}</td></tr>] : []),
              <tr key={r.row} className={`border-t border-line ${BOLD.has(r.row) ? "font-semibold text-ink" : ""}`}>
                <td className="py-1.5 pr-3 font-sans text-ink-2">{r.label}</td>
                {rows.map((c, i) => <td key={i} className={`py-1.5 pr-3 text-right ${i < HIST ? "text-muted" : ""} ${i === HIST ? "border-l border-line pl-3" : ""}`}>{c[r.row] == null ? "—" : FMT[r.fmt](Number(c[r.row]))}</td>)}
              </tr>,
            ])}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">2024–2026 are actuals (2026 through {longDate(A.as_of)}). Forecast: stablecoins compound at a constant rate to the 2030 setting; yield stablecoins and onchain loans hold their 2026 shares; the loan book is Maple&apos;s share of onchain loans (6.40% from 2027); loans = loan book × utilization; revenue = take rate (2026, annualised) × average of the year&apos;s opening and closing loans, split pool/other as in 2026; buybacks a flat 20% of revenue; market cap = revenue × P/S; price = market cap ÷ circulating supply, held flat at {tok(n(E, 46))}. Buybacks don&apos;t retire supply. The same engine as the model sheet; inputs at /api/actuals.csv, assumptions at /api/assumptions.json, output at /api/forecast.csv. Not investment advice.</p>
      </div>
    </div>
  );
}
