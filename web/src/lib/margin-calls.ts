// Maple's margin call stats, as Maple reports them (posts on X). Add a row when Maple posts a new update.
export type MarginWeek = {
  week: string; // last day of the week covered
  calls: number; cured: number; liquidations: number;
  cure_hours: number; // average time to cure; the cure period is 24 hours
  collateral_usd: number; // additional collateral posted against the calls
  above_required_usd: number; // part of that above what the calls required
  unrequested_usd: number; // top-ups from borrowers who were not called
  source: string;
};
export const MARGIN_WEEKS: MarginWeek[] = [
  { week: "2026-11-16", calls: 26, cured: 26, liquidations: 0, cure_hours: 2 + 46 / 60, collateral_usd: 127.3e6, above_required_usd: 44e6, unrequested_usd: 46e6,
    source: "https://x.com/maplefinance/status/2122396422444397053" },
];
/** chart rows: collateral posted, split into what the calls required and the extra, plus top-ups nobody asked for */
export const marginRows = MARGIN_WEEKS.map((w) => ({
  week: w.week, required_usd: w.collateral_usd - w.above_required_usd, above_required_usd: w.above_required_usd, unrequested_usd: w.unrequested_usd,
  calls: w.calls, cured: w.cured, liquidations: w.liquidations, cure_hours: w.cure_hours,
}));
export const hm = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
