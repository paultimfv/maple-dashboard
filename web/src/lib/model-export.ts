// SYRUP model export: the pipeline's model_ledger (one row per month) rolled up to years, quarters or months,
// laid out like the model sheet (metrics as rows, periods as columns) so Google Sheets can IMPORTDATA it.
import { q } from "./db";

export type Period = "year" | "quarter" | "month";
type Row = Record<string, number | string | boolean | null>;

export async function modelLedger(): Promise<Row[]> {
  const rows = await q(`SELECT l.*, r.otc_published FROM model_ledger l LEFT JOIN monthly_revenue r USING (month) WHERE l.month >= '2023-01-01' ORDER BY l.month`);
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k,
    v instanceof Date ? v.toISOString().slice(0, 10)
    : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : (v as Row[string])])));
}

const keyOf = (month: string, p: Period, ytdYear: string) => {
  const y = month.slice(0, 4), m = Number(month.slice(5, 7));
  if (p === "year") return y === ytdYear ? `${y} (YTD)` : y;
  if (p === "quarter") return `${y} Q${Math.ceil(m / 3)}`;
  return month.slice(0, 7);
};
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const sum = (rows: Row[], k: string) => rows.reduce((s, r) => s + (num(r[k]) ?? 0), 0);
const lastOf = (rows: Row[], k: string) => { for (let i = rows.length - 1; i >= 0; i--) { const v = num(rows[i][k]); if (v != null) return v; } return null; };
const avg = (rows: Row[], k: string) => { const v = rows.map((r) => num(r[k])).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const div = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b);

export type Metric = { section: string; label: string; key: string; fmt: "usd" | "pct" | "mult" | "price" | "count" };
export const METRICS: Metric[] = [
  { section: "MARKETS", label: "Total Stablecoin Supply", key: "stablecoin_supply", fmt: "usd" },
  { section: "MARKETS", label: "Total Supply Growth %", key: "stablecoin_growth", fmt: "pct" },
  { section: "BALANCES", label: "Loan Book (Total deposits)", key: "deposits_total", fmt: "usd" },
  { section: "BALANCES", label: "Total Outstanding Loans", key: "loans_total", fmt: "usd" },
  { section: "BALANCES", label: "Utilization Rate", key: "utilization", fmt: "pct" },
  { section: "BALANCES", label: "Collateral", key: "collateral", fmt: "usd" },
  { section: "BALANCES", label: "AUM", key: "aum", fmt: "usd" },
  { section: "BALANCES", label: "SyrupUSDC Deposits", key: "deposits_syrupusdc", fmt: "usd" },
  { section: "BALANCES", label: "SyrupUSDC Loans", key: "loans_syrupusdc", fmt: "usd" },
  { section: "BALANCES", label: "SyrupUSDT Deposits", key: "deposits_syrupusdt", fmt: "usd" },
  { section: "BALANCES", label: "SyrupUSDT Loans", key: "loans_syrupusdt", fmt: "usd" },
  { section: "BALANCES", label: "SyrupUSDG Deposits", key: "deposits_syrupusdg", fmt: "usd" },
  { section: "BALANCES", label: "SyrupUSDG Loans", key: "loans_syrupusdg", fmt: "usd" },
  { section: "BALANCES", label: "Other Pools Deposits", key: "deposits_other", fmt: "usd" },
  { section: "BALANCES", label: "Other Pools Loans", key: "loans_other", fmt: "usd" },
  { section: "REVENUE", label: "SyrupUSD Revenue", key: "syrup_revenue", fmt: "usd" },
  { section: "REVENUE", label: "Pool Revenue", key: "pool_revenue", fmt: "usd" },
  { section: "REVENUE", label: "Offchain Revenue", key: "offchain_revenue", fmt: "usd" },
  { section: "REVENUE", label: "Total Revenue", key: "total_revenue", fmt: "usd" },
  { section: "REVENUE", label: "Take rate on Loan book", key: "take_rate", fmt: "pct" },
  { section: "REVENUE", label: "Gross interest (onchain, open-term)", key: "gross_interest", fmt: "usd" },
  { section: "REVENUE", label: "Interest paid to lenders (onchain)", key: "interest_to_lenders", fmt: "usd" },
  { section: "REVENUE", label: "Maple share of interest (onchain fees / gross)", key: "maple_share_of_interest", fmt: "pct" },
  { section: "REVENUE", label: "Net interest margin (revenue / pool assets)", key: "nim", fmt: "pct" },
  { section: "REVENUE", label: "Months of revenue", key: "months", fmt: "count" },
  { section: "BUYBACKS", label: "Monthly Revenue (avg)", key: "monthly_revenue_avg", fmt: "usd" },
  { section: "BUYBACKS", label: "Buyback Rate (MIP-021, last month)", key: "buyback_rate", fmt: "pct" },
  { section: "BUYBACKS", label: "SYRUP Buybacks (actual, Maple-reported)", key: "buybacks_actual", fmt: "usd" },
  { section: "BUYBACKS", label: "SYRUP Buybacks (implied by rule)", key: "buybacks_implied", fmt: "usd" },
  { section: "VALUATION", label: "SYRUP FDV", key: "syrup_fdv", fmt: "usd" },
  { section: "VALUATION", label: "SYRUP Market Cap", key: "syrup_mcap", fmt: "usd" },
  { section: "VALUATION", label: "P/S Multiple (FDV/Revenue)", key: "ps_fdv", fmt: "mult" },
  { section: "VALUATION", label: "SYRUP Price", key: "syrup_price", fmt: "price" },
  // Conservative view (added last so existing sheet rows don't move). Blockworks' OTC line matches Maple's published
  // OTC series through Sep 2025 and is $0 after; Maple's offchain numbers from Oct 2025 are unconfirmed, so kept apart.
  { section: "CONSERVATIVE", label: "Onchain revenue (fees from pool contracts)", key: "onchain_revenue", fmt: "usd" },
  { section: "CONSERVATIVE", label: "OTC revenue, confirmed (to Sep 2025)", key: "otc_confirmed", fmt: "usd" },
  { section: "CONSERVATIVE", label: "Offchain revenue, unconfirmed (Oct 2025 on)", key: "offchain_unconfirmed", fmt: "usd" },
  { section: "CONSERVATIVE", label: "Total Revenue, conservative (onchain + confirmed OTC)", key: "revenue_conservative", fmt: "usd" },
  { section: "CONSERVATIVE", label: "P/S Multiple, conservative (FDV/Revenue)", key: "ps_conservative", fmt: "mult" },
];
const OTC_CONFIRMED_THROUGH = "2025-09-30";

/** Roll monthly ledger rows up to periods. Flows: sums of complete months. Stocks: last value in the period. */
export function aggregate(ledger: Row[], period: Period, from = "2024-01-01") {
  const rows = ledger.filter((r) => String(r.month) >= from);
  const ytdYear = String(rows.find((r) => r.partial_month)?.month ?? "").slice(0, 4);
  const groups = new Map<string, Row[]>();
  for (const r of rows) { const k = keyOf(String(r.month), period, ytdYear); groups.set(k, [...(groups.get(k) ?? []), r]); }
  const out: { period: string; asOf: string; values: Record<string, number | null> }[] = [];
  let prevSupply: number | null = lastOf(ledger.filter((r) => String(r.month) < from), "stablecoin_supply");
  for (const [p, g] of groups) {
    const done = g.filter((r) => !r.partial_month);                    // revenue counts complete months only
    const months = done.length;
    const syrup = months ? sum(done, "syrup_revenue") : null, pools = months ? sum(done, "pool_revenue") : null;
    const total = months ? sum(done, "total_revenue") : null;
    const residual = total != null && syrup != null && pools != null ? total - syrup - pools : null;  // offchain = Maple total - onchain, netted over the period
    const supply = lastOf(g, "stablecoin_supply");
    const annualised = total != null && months ? (total * 12) / months : null;
    const fdv = lastOf(g, "syrup_fdv");
    const onchain = months ? sum(done, "onchain_revenue") : null;
    const early = done.filter((r) => String(r.month) <= OTC_CONFIRMED_THROUGH), late = done.filter((r) => String(r.month) > OTC_CONFIRMED_THROUGH);
    const otcConfirmed = months ? sum(early, "otc_published") : null, offUnconfirmed = months ? sum(late, "offchain_revenue") : null;
    const conservative = onchain != null && otcConfirmed != null ? onchain + otcConfirmed : null;
    out.push({
      period: p, asOf: String(g[g.length - 1].month).slice(0, 7),
      values: {
        stablecoin_supply: supply, stablecoin_growth: div(supply, prevSupply) != null ? div(supply, prevSupply)! - 1 : null,
        deposits_total: lastOf(g, "deposits_total"), loans_total: lastOf(g, "loans_total"), utilization: lastOf(g, "utilization"),
        collateral: lastOf(g, "collateral"), aum: lastOf(g, "aum"),
        deposits_syrupusdc: lastOf(g, "deposits_syrupusdc"), loans_syrupusdc: lastOf(g, "loans_syrupusdc"),
        deposits_syrupusdt: lastOf(g, "deposits_syrupusdt"), loans_syrupusdt: lastOf(g, "loans_syrupusdt"),
        deposits_syrupusdg: lastOf(g, "deposits_syrupusdg"), loans_syrupusdg: lastOf(g, "loans_syrupusdg"),
        deposits_other: lastOf(g, "deposits_other"), loans_other: lastOf(g, "loans_other"),
        syrup_revenue: syrup, pool_revenue: pools, offchain_revenue: residual != null && residual >= 0 ? residual : null, total_revenue: total,
        take_rate: div(annualised, avg(done, "loans_total")), months,
        gross_interest: months ? sum(done, "gross_interest") : null, interest_to_lenders: months ? sum(done, "interest_to_lenders") : null,
        maple_share_of_interest: months ? div(sum(done, "gross_interest") - sum(done, "interest_to_lenders"), sum(done, "gross_interest")) : null,
        nim: div(annualised, avg(done, "pool_assets")),
        monthly_revenue_avg: div(total, months || null), buyback_rate: lastOf(done, "buyback_rate"),
        buybacks_actual: months ? sum(done, "buybacks_actual") : null, buybacks_implied: months ? sum(done, "buybacks_implied") : null,
        syrup_fdv: fdv, syrup_mcap: lastOf(g, "syrup_mcap"), ps_fdv: div(fdv, annualised), syrup_price: lastOf(g, "syrup_price"),
        onchain_revenue: onchain, otc_confirmed: otcConfirmed, offchain_unconfirmed: offUnconfirmed, revenue_conservative: conservative,
        ps_conservative: div(fdv, conservative != null && months ? (conservative * 12) / months : null),
      },
    });
    prevSupply = supply ?? prevSupply;
  }
  return out;
}

const cell = (v: number | null, fmt: Metric["fmt"]) =>
  v == null ? "" : fmt === "usd" ? Math.round(v).toString() : fmt === "price" ? v.toFixed(4) : fmt === "count" ? String(v) : v.toFixed(4);

/** CSV: section,metric,<period>... — raw numbers (USD unrounded to the dollar, ratios as decimals) so Sheets can format them. */
export function toCsv(periods: ReturnType<typeof aggregate>) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [["section", "metric", ...periods.map((p) => p.period)].map(esc).join(",")];
  for (const m of METRICS) lines.push([m.section, m.label, ...periods.map((p) => cell(p.values[m.key], m.fmt))].map(esc).join(","));
  lines.push(["", "As of (last month in period)", ...periods.map((p) => p.asOf)].map(esc).join(","));
  return lines.join("\n") + "\n";
}
