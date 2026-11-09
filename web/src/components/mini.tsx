"use client";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, YAxis } from "recharts";
import { ToneScope, usePalette, type Tone } from "@/components/charts";

type Row = Record<string, unknown>;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const my = (d: unknown) => { const s = String(d); return `${MON[Number(s.slice(5, 7)) - 1] ?? ""} ${s.slice(0, 4)}`; };
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)}%`;

function Plot({ data, x, y, kind }: { data: Row[]; x: string; y: string; kind: "line" | "bars" }) {
  const pal = usePalette();
  const c = pal.series[0];
  return (
    <ResponsiveContainer width="100%" height="100%">
      {kind === "bars" ? (
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={1}>
          <YAxis hide domain={[0, "auto"]} />
          <Bar dataKey={y} fill={c} isAnimationActive={false} />
        </BarChart>
      ) : (
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 0 }}>
          <YAxis hide domain={["auto", "auto"]} />
          <Area dataKey={y} type="monotone" stroke={c} strokeWidth={1.5} fill={c} fillOpacity={0.08} dot={false} isAnimationActive={false} />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

/** One small chart that opens its full version on another page. */
export function Mini({ href, label, value, change, data, x, y, kind = "line", tone, where }: {
  href: string; label: string; value: string; change?: number; data: Row[]; x: string; y: string; kind?: "line" | "bars"; tone?: Tone; where: string;
}) {
  const rows = data.filter((r) => r[y] != null);
  const body = (
    <a href={href} className="mini">
      <span className="mini-l">{label}</span>
      <span className="mini-v">{value}
        {change != null && isFinite(change) && <span className={change >= 0 ? "is-up" : "is-down"}>{pct(change)} 1Y</span>}
      </span>
      <span className="mini-c"><Plot data={rows} x={x} y={y} kind={kind} /></span>
      <span className="mini-f"><span>{my(rows[0]?.[x])} – {my(rows[rows.length - 1]?.[x])}</span><span className="mini-go">{where}</span></span>
    </a>
  );
  return tone ? <ToneScope tone={tone}>{body}</ToneScope> : body;
}
