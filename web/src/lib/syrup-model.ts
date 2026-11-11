// Paul's SYRUP base model (sheet of 2026-11-10). History is the sheet's actuals; 2027E–2030E are computed.
// The same file lives in maple-model and maple-dashboard/web — keep them identical.

export const YEARS = ["2024", "2025", "2026 YTD", "2027E", "2028E", "2029E", "2030E"] as const;
export const HIST = 3; // first three columns are actuals
const YTD_ANNUALIZE = 365 / 304; // 2026 YTD runs to 31 Oct (304 days)

export type Row = {
  stablecoins: number; growth: number | null; yieldStables: number | null; yieldShare: number | null;
  onchainLoans: number; loanShare: number;
  mapleShareYield: number | null; syrupUSD: number; loanBook: number; loans: number; utilization: number;
  collateral: number; aum: number; mapleShareLoans: number;
  pools: { name: string; deposits: number; loans: number }[];
  syrupUSDRev: number; poolRev: number; otcRev: number; revenue: number; takeRate: number;
  monthlyRev: number; buybackRate: number; buybacks: number;
  fdv: number; supply: number; ps: number; price: number;
};

const POOLS = ["SyrupUSDC", "SyrupUSDT", "SyrupUSDG", "Other pools"];

// Actuals straight from the sheet
const H = {
  stablecoins: [203_763_644_082, 304_427_076_510, 292_360_000_000],
  yieldStables: [null, 12_564_442_805, 12_187_601_374],
  onchainLoans: [26_441_000_000, 36_676_000_000, 31_896_805_070],
  loanBook: [187_305_215, 2_105_353_779, 1_867_844_184],
  loans: [179_002_669, 2_032_578_122, 1_834_055_440],
  syrupUSD: [82_449_654, 2_007_349_041, 1_487_230_186],
  collateral: [254_731_700, 2_463_865_676, 2_557_673_858],
  deposits: [[57_723_505, 24_726_147, 0, 0], [1_314_998_294, 694_558_407, 0, 95_797_078], [930_376_020, 298_860_565, 318_666_908, 319_940_691]],
  poolLoans: [[55_385_100, 24_250_050, 0, 0], [1_295_075_644, 645_750_000, 0, 91_752_478], [918_721_521, 297_660_717, 298_950_015, 318_723_187]],
  syrupUSDRev: [259_790, 6_172_929, 11_251_412],
  poolRev: [1_665_927, 7_895_605, 12_270_772],
  otcRev: [1_153_122, 7_373_785, 4_495_595],
  months: [12, 12, 304 / (365 / 12)],
  buybackRate: [0, 0.1581, 0.2],
  buybacks: [0, 2_413_622.21, 972_982],
  fdv: [187_096_325, 397_221_254, 158_002_759],
  supply: [1_154_915_586, 1_216_231_641, 1_267_875_000],
  price: [0.15, 0.32, 0.1354],
};

// MIP-021: share of monthly revenue sent to buybacks
export const mip021 = (monthly: number) => (monthly >= 2e6 ? 0.3 : monthly >= 1.5e6 ? 0.2 : 0.1);

function history(): Row[] {
  return [0, 1, 2].map((i) => {
    const deposits = H.deposits[i], pl = H.poolLoans[i];
    const loanBook = H.loanBook[i], loans = H.loans[i];
    const revenue = H.poolRev[i] + H.otcRev[i];
    const ys = H.yieldStables[i];
    return {
      stablecoins: H.stablecoins[i], growth: i ? H.stablecoins[i] / H.stablecoins[i - 1] - 1 : null,
      yieldStables: ys, yieldShare: ys ? ys / H.stablecoins[i] : null,
      onchainLoans: H.onchainLoans[i], loanShare: H.onchainLoans[i] / H.stablecoins[i],
      mapleShareYield: ys ? H.syrupUSD[i] / ys : null, syrupUSD: H.syrupUSD[i], loanBook, loans, utilization: loans / loanBook,
      collateral: H.collateral[i], aum: loanBook + H.collateral[i], mapleShareLoans: loanBook / H.onchainLoans[i],
      pools: POOLS.map((name, k) => ({ name, deposits: deposits[k], loans: pl[k] })),
      syrupUSDRev: H.syrupUSDRev[i], poolRev: H.poolRev[i], otcRev: H.otcRev[i], revenue,
      takeRate: (revenue * (i === 2 ? YTD_ANNUALIZE : 1)) / loans,
      monthlyRev: i === 0 ? 0 : revenue / H.months[i], buybackRate: H.buybackRate[i], buybacks: H.buybacks[i],
      fdv: H.fdv[i], supply: H.supply[i], ps: H.fdv[i] / revenue, price: H.price[i],
    };
  });
}
export const ACTUALS = history();
const A = ACTUALS[2]; // 2026 YTD: the base every forecast ratio is held at

export type Params = {
  stable2030: number; yieldShare: number; loanShare: number; mapleShare: number;
  utilization: number; takeRate: number; ps: number; supply: number;
};
export const BASE: Params = {
  stable2030: 3e12, yieldShare: A.yieldShare!, loanShare: A.loanShare, mapleShare: A.mapleShareYield!,
  utilization: A.utilization, takeRate: A.takeRate, ps: 9.4, supply: A.supply,
};

// Ratios held at their 2026 level
const DEPOSITS_PER_SYRUPUSD = A.loanBook / A.syrupUSD;
const COLLATERAL_PER_LOAN = A.collateral / A.loans;
const SYRUPUSD_SHARE_OF_POOL = A.syrupUSDRev / A.poolRev;

export function run(p: Params): Row[] {
  const g = Math.pow(p.stable2030 / A.stablecoins, 1 / 4);
  const rows = [...ACTUALS];
  for (let i = 1; i <= 4; i++) {
    const prev = rows[rows.length - 1];
    const stablecoins = A.stablecoins * Math.pow(g, i);
    const yieldStables = stablecoins * p.yieldShare;
    const onchainLoans = stablecoins * p.loanShare;
    const syrupUSD = yieldStables * p.mapleShare;
    const loanBook = syrupUSD * DEPOSITS_PER_SYRUPUSD;
    const loans = loanBook * p.utilization;
    const collateral = loans * COLLATERAL_PER_LOAN;
    // pool revenue = average loans over the year × take rate; OTC is a separate line that grows with revenue
    const poolRev = ((prev.loans + loans) / 2) * p.takeRate;
    const revenue = poolRev;
    const otcRev = prev.otcRev * (revenue / prev.revenue);
    const monthlyRev = revenue / 12, buybackRate = mip021(monthlyRev);
    const fdv = revenue * p.ps;
    rows.push({
      stablecoins, growth: g - 1, yieldStables, yieldShare: p.yieldShare, onchainLoans, loanShare: p.loanShare,
      mapleShareYield: p.mapleShare, syrupUSD, loanBook, loans, utilization: p.utilization, collateral, aum: loanBook + collateral,
      mapleShareLoans: loanBook / onchainLoans,
      pools: A.pools.map((x) => ({ name: x.name, deposits: loanBook * (x.deposits / A.loanBook), loans: loans * (x.loans / A.loans) })),
      syrupUSDRev: poolRev * SYRUPUSD_SHARE_OF_POOL, poolRev, otcRev, revenue, takeRate: p.takeRate,
      monthlyRev, buybackRate, buybacks: revenue * buybackRate,
      fdv, supply: p.supply, ps: p.ps, price: fdv / p.supply,
    });
  }
  return rows;
}
