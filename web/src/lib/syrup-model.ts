// SYRUP 2030 model. Same engine as Paul's Google Sheet ("Model" tab, Option A: circulating supply held flat).
// The sheet owns the assumptions (config/syrup-model-assumptions.json is the dashboard's copy) and the forecast logic;
// the dashboard owns the 2026 actuals (served at /api/actuals.csv, which the sheet imports into column E).
// Rows are the sheet's row numbers. Columns: C 2024, D 2025, E 2026 YTD (to the as-of month-end), F–I 2027E–2030E.
// No imports: tests run this file directly with node.

export const YEARS = ["2024", "2025", "2026 YTD", "2027E", "2028E", "2029E", "2030E"] as const;
export const COLS = ["c_2024", "d_2025", "e_2026", "f_2027", "g_2028", "h_2029", "i_2030"] as const;
export const HIST = 3; // first three columns are actuals

export type Col = Record<number, number | null>;

/** Hardcoded actual rows in column E (and C/D), as the sheet has them. Ratio rows are never inputs. */
export const INPUTS: { row: number; key: string; label: string; unit: "usd" | "tokens" | "usd_per_token"; source: string }[] = [
  { row: 4, key: "stablecoin_supply", label: "Total Stablecoin Supply", unit: "usd", source: "defillama" },
  { row: 6, key: "yield_stablecoins", label: "Yield Stablecoins Supply (Top 15)", unit: "usd", source: "defillama" },
  { row: 8, key: "onchain_loans", label: "Outstanding Onchain Loans", unit: "usd", source: "defillama" },
  { row: 13, key: "syrupusd_supply", label: "Total SyrupUSD Supply", unit: "usd", source: "onchain" },
  { row: 14, key: "loan_book", label: "Loan Book (Total deposits)", unit: "usd", source: "maple" },
  { row: 15, key: "loans_outstanding", label: "Total Outstanding Loans", unit: "usd", source: "maple" },
  { row: 17, key: "collateral", label: "Collateral", unit: "usd", source: "maple" },
  { row: 23, key: "syrupusdc_deposits", label: "SyrupUSDC Deposits", unit: "usd", source: "maple" },
  { row: 24, key: "syrupusdc_loans", label: "SyrupUSDC Loans", unit: "usd", source: "maple" },
  { row: 25, key: "syrupusdt_deposits", label: "SyrupUSDT Deposits", unit: "usd", source: "maple" },
  { row: 26, key: "syrupusdt_loans", label: "SyrupUSDT Loans", unit: "usd", source: "maple" },
  { row: 27, key: "syrupusdg_deposits", label: "SyrupUSDG Deposits", unit: "usd", source: "maple" },
  { row: 28, key: "syrupusdg_loans", label: "SyrupUSDG Loans", unit: "usd", source: "maple" },
  { row: 29, key: "other_pools_deposits", label: "Other Pools Deposits", unit: "usd", source: "maple" },
  { row: 30, key: "other_pools_loans", label: "Other Pools Loans", unit: "usd", source: "maple" },
  { row: 32, key: "syrupusd_revenue", label: "SyrupUSD Revenue (memo, part of Pool)", unit: "usd", source: "onchain" },
  { row: 33, key: "pool_revenue", label: "Pool Revenue", unit: "usd", source: "onchain" },
  { row: 34, key: "other_revenue", label: "Other Revenue", unit: "usd", source: "maple" },
  { row: 40, key: "buybacks", label: "Buyback Value", unit: "usd", source: "maple" },
  { row: 43, key: "market_cap", label: "SYRUP Market Cap", unit: "usd", source: "coingecko" },
  { row: 44, key: "protocol_held_tokens", label: "Protocol Held Tokens", unit: "tokens", source: "maple" },
  { row: 45, key: "total_supply", label: "Total SYRUP Supply", unit: "tokens", source: "onchain" },
  { row: 46, key: "circulating_supply", label: "SYRUP Circ. Supply", unit: "tokens", source: "coingecko" },
  { row: 48, key: "price", label: "SYRUP Price", unit: "usd_per_token", source: "coingecko" },
];

export type Actuals = { as_of: string; C: Col; D: Col; E: Col };

/** The sheet's actuals as of 31 Oct 2026 (handoff section 5). Test fixture, and what /api/actuals.csv serves until a newer month-end is wired. */
export const FIXTURE: Actuals = {
  as_of: "2026-10-31",
  C: { 4: 203763644082, 6: null, 8: 26441000000, 13: 82449654, 14: 187305215, 15: 179002669, 17: 254731700,
    23: 57723505, 24: 55385100, 25: 24726147, 26: 24250050, 27: 0, 28: 0, 29: 0, 30: 0,
    32: 259790, 33: 1665927, 34: 1153122, 40: 0, 43: 187096325, 44: null, 45: null, 46: 1154915586, 48: 0.15 },
  D: { 4: 304427076510, 6: 12564442805, 8: 36676000000, 13: 2007349041, 14: 2105353779, 15: 2032578122, 17: 2463865676,
    23: 1314998294, 24: 1295075644, 25: 694558407, 26: 645750000, 27: 0, 28: 0, 29: 95797078, 30: 91752478,
    32: 6172929, 33: 7895605, 34: 7373785, 40: 2413622.21, 43: 397221254, 44: null, 45: null, 46: 1216231641, 48: 0.32 },
  E: { 4: 292360000000, 6: 12187601374, 8: 31896805070, 13: 1487230186, 14: 1867844184, 15: 1834055440, 17: 2557673858,
    23: 930376020, 24: 918721521, 25: 298860565, 26: 297660717, 27: 318666908, 28: 298950015, 29: 319940691, 30: 318723187,
    32: 11251412, 33: 12270772, 34: 4495595, 40: 1119517, 43: 158002759, 44: 127550000, 45: 1267875000, 46: 1166933227, 48: 0.1354 },
};

const PAIRS: [number, number][] = [[23, 24], [25, 26], [27, 28], [29, 30]];
const v = (c: Col, r: number) => Number(c[r] ?? 0);
const div = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || !b ? null : a / b);
/** days in the 2026 YTD column: Jan 1 to the as-of date */
const ytdDays = (asOf: string) => Math.round((Date.parse(asOf) - Date.parse(asOf.slice(0, 4) + "-01-01")) / 864e5) + 1;

/** columns C–E: the inputs plus the sheet's formula rows */
export function history(a: Actuals): Col[] {
  const days = ytdDays(a.as_of), months = days / (365 / 12);
  return [a.C, a.D, a.E].map((x, i) => {
    const c: Col = { ...x };
    const prev = i ? [a.C, a.D][i - 1] : null;
    c[5] = prev ? v(x, 4) / v(prev, 4) - 1 : null;
    c[7] = div(x[6], x[4]); c[9] = div(x[8], x[4]); c[12] = div(x[13], x[6]); c[16] = div(x[15], x[14]);
    c[18] = v(x, 14) + v(x, 17); c[19] = div(x[14], x[8]);
    c[35] = v(x, 33) + v(x, 34);
    c[36] = i === 2 ? (v(c, 35) * 365) / days / v(x, 15) : v(c, 35) / v(x, 15);
    c[38] = i === 0 ? 0 : i === 1 ? v(c, 35) / 12 : v(c, 35) / Math.round(months);
    c[39] = v(x, 40) / v(c, 35);
    c[41] = div(x[40], x[48]);
    c[47] = v(x, 43) / v(c, 35);
    return c;
  });
}

/** What the forecast columns run on. Share paths are [2027, 2028, 2029, 2030]. */
export type Params = {
  stable2030: number; yieldShare: number; loanShare: number;
  share12: number[]; share19: number[];
  utilization: number; takeRate: number; buybackRate: number; ps: number; circ: number;
};

type Rule = { rule: string; factor?: number; to?: number } | number | string | undefined;
export type Assumptions = {
  stablecoins_2030: number; maple_share_of_yield_stables: Rule; maple_share_of_onchain_loans: Rule;
  buyback_rate_forecast: number; ps_multiple: number;
  scenarios: Record<string, { ps_multiple?: number; maple_share_of_yield_stables?: Rule; maple_share_of_onchain_loans?: Rule; flag_for_paul?: boolean; tooltip?: string }>;
};
export const SCENARIOS = ["bear", "base", "bull"] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** turn the sheet's assumption cells + a scenario's overrides into slider values */
export function params(a: Actuals, as: Assumptions, scenario: Scenario = "base"): Params {
  const E = history(a)[2];
  const e12 = v(E, 12), e19 = v(E, 19);
  const sc = scenario === "base" ? {} : as.scenarios[scenario] ?? {};
  const r12 = sc.maple_share_of_yield_stables ?? as.maple_share_of_yield_stables;
  const r19 = sc.maple_share_of_onchain_loans ?? as.maple_share_of_onchain_loans;
  const k4 = [1, 2, 3, 4];
  const share12 = k4.map((k) => {
    if (typeof r12 === "number") return r12;
    if (typeof r12 === "object" && r12.rule === "e12_times") return e12 * (r12.factor ?? 1);
    if (typeof r12 === "object" && r12.rule === "linear_ramp") return e12 + ((r12.to ?? e12) - e12) * (k / 4);
    if (typeof r12 === "object" && r12.rule === "step") return r12.to ?? e12;
    return e12; // hold_2026
  });
  const share19 = k4.map((_, j) => {
    if (typeof r19 === "number") return r19;
    if (typeof r19 === "object" && r19.rule === "scale_with_yield_share_from_2026") return (e19 * share12[j]) / e12;
    return e19; // hold_2026
  });
  return {
    stable2030: as.stablecoins_2030, yieldShare: v(E, 7), loanShare: v(E, 9), share12, share19,
    utilization: v(E, 16), takeRate: v(E, 36), buybackRate: as.buyback_rate_forecast,
    ps: sc.ps_multiple ?? as.ps_multiple, circ: v(a.E, 46),
  };
}

/** all seven columns, C–I */
export function run(a: Actuals, p: Params): Col[] {
  const cols = history(a);
  const E = cols[2];
  const g = Math.pow(p.stable2030 / v(E, 4), 1 / 4) - 1;
  for (let k = 1; k <= 4; k++) {
    const P = cols[cols.length - 1], c: Col = {};
    c[4] = k < 4 ? v(E, 4) * Math.pow(1 + g, k) : p.stable2030;
    c[5] = g;
    c[7] = p.yieldShare; c[6] = v(c, 4) * p.yieldShare;
    c[9] = p.loanShare; c[8] = v(c, 4) * p.loanShare;
    c[12] = p.share12[k - 1]; c[13] = v(c, 6) * v(c, 12);
    c[16] = p.utilization; c[19] = p.share19[k - 1];
    c[14] = v(c, 8) * v(c, 19);            // the loan book follows Maple's share of onchain loans, not row 12
    c[15] = v(c, 14) * p.utilization;
    c[17] = (v(c, 14) * v(E, 17)) / v(E, 14);
    c[18] = v(c, 14) + v(c, 17);
    for (const [d, l] of PAIRS) { c[d] = (v(c, 14) * v(E, d)) / v(E, 14); c[l] = v(E, d) ? (v(c, d) * v(E, l)) / v(E, d) : 0; }
    c[36] = p.takeRate;
    const avg = (v(P, 15) + v(c, 15)) / 2;
    c[33] = (p.takeRate * avg * v(E, 33)) / v(E, 35);
    c[34] = (p.takeRate * avg * v(E, 34)) / v(E, 35);
    c[35] = v(c, 33) + v(c, 34);
    c[32] = (v(c, 33) * v(E, 32)) / v(E, 33);  // memo, part of pool revenue
    c[38] = v(c, 35) / 12;
    c[39] = p.buybackRate; c[40] = v(c, 35) * p.buybackRate;
    c[47] = p.ps; c[43] = p.ps * v(c, 35);
    c[45] = v(E, 45); c[46] = p.circ;
    c[48] = v(c, 43) / p.circ;              // price = market cap ÷ circulating supply
    c[41] = v(c, 40) / v(c, 48);
    c[44] = v(P, 44) + v(c, 41);
    cols.push(c);
  }
  return cols;
}

/** model rows for tables and /api/forecast.csv (rows 20–22 are unused in the sheet) */
export const ROWS: { row: number; key: string; label: string; fmt: "usd" | "pct" | "tokens" | "mult" | "price" }[] = [
  { row: 4, key: "stablecoin_supply", label: "Total stablecoin supply", fmt: "usd" },
  { row: 5, key: "stablecoin_growth", label: "Supply growth", fmt: "pct" },
  { row: 6, key: "yield_stablecoins", label: "Yield stablecoins (top 15)", fmt: "usd" },
  { row: 7, key: "yield_share", label: "Yield share of stablecoins", fmt: "pct" },
  { row: 8, key: "onchain_loans", label: "Onchain loans outstanding", fmt: "usd" },
  { row: 9, key: "loan_share", label: "Loans share of stablecoins", fmt: "pct" },
  { row: 12, key: "maple_share_yield", label: "Maple share of yield stables", fmt: "pct" },
  { row: 13, key: "syrupusd_supply", label: "syrupUSD supply", fmt: "usd" },
  { row: 14, key: "loan_book", label: "Loan book (deposits)", fmt: "usd" },
  { row: 15, key: "loans_outstanding", label: "Loans outstanding", fmt: "usd" },
  { row: 16, key: "utilization", label: "Utilization", fmt: "pct" },
  { row: 17, key: "collateral", label: "Collateral", fmt: "usd" },
  { row: 18, key: "aum", label: "Assets under management", fmt: "usd" },
  { row: 19, key: "maple_share_loans", label: "Maple share of onchain loans", fmt: "pct" },
  { row: 23, key: "syrupusdc_deposits", label: "syrupUSDC deposits", fmt: "usd" },
  { row: 24, key: "syrupusdc_loans", label: "syrupUSDC loans", fmt: "usd" },
  { row: 25, key: "syrupusdt_deposits", label: "syrupUSDT deposits", fmt: "usd" },
  { row: 26, key: "syrupusdt_loans", label: "syrupUSDT loans", fmt: "usd" },
  { row: 27, key: "syrupusdg_deposits", label: "syrupUSDG deposits", fmt: "usd" },
  { row: 28, key: "syrupusdg_loans", label: "syrupUSDG loans", fmt: "usd" },
  { row: 29, key: "other_pools_deposits", label: "Other pools deposits", fmt: "usd" },
  { row: 30, key: "other_pools_loans", label: "Other pools loans", fmt: "usd" },
  { row: 32, key: "syrupusd_revenue", label: "syrupUSD revenue (memo, part of pool)", fmt: "usd" },
  { row: 33, key: "pool_revenue", label: "Pool revenue", fmt: "usd" },
  { row: 34, key: "other_revenue", label: "Other revenue", fmt: "usd" },
  { row: 35, key: "total_revenue", label: "Total revenue", fmt: "usd" },
  { row: 36, key: "take_rate", label: "Take rate on loans", fmt: "pct" },
  { row: 38, key: "monthly_revenue", label: "Monthly revenue", fmt: "usd" },
  { row: 39, key: "buyback_rate", label: "Buyback rate", fmt: "pct" },
  { row: 40, key: "buybacks", label: "SYRUP buybacks", fmt: "usd" },
  { row: 41, key: "tokens_bought", label: "Tokens bought", fmt: "tokens" },
  { row: 43, key: "market_cap", label: "SYRUP market cap", fmt: "usd" },
  { row: 44, key: "protocol_held_tokens", label: "Protocol held tokens", fmt: "tokens" },
  { row: 45, key: "total_supply", label: "Total supply", fmt: "tokens" },
  { row: 46, key: "circulating_supply", label: "Circulating supply", fmt: "tokens" },
  { row: 47, key: "ps", label: "P/S (market cap ÷ revenue)", fmt: "mult" },
  { row: 48, key: "price", label: "SYRUP price", fmt: "price" },
];
