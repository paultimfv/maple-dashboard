// GET /api/ask-context → every dataset on this dashboard as compact text, read by the "Ask AI" assistant.
import * as Q from "@/lib/queries";
import { table, contextResponse } from "@/lib/ask-context";
import { modelLedger, aggregate } from "@/lib/model-export";

export const revalidate = 21600; // data updates daily; cache 6h so each view does not query Neon

export async function GET() {
  const [rev, model, aumPools, aumRep, ledger, supply, snap, lenders, borrowers, ssf, bsheet] = await Promise.all([
    Q.mapleRevenueMonthly(), Q.mapleModelMonthly(), Q.mapleAumByPool(), Q.mapleAumReported(), modelLedger(), Q.syrupSupply(),
    Q.poolsSnapshot(), Q.mapleLenders(), Q.mapleBorrowers(), Q.ssfDaily(), Q.mapleBalanceSheet(),
  ]);
  const [syrup, buybacks, share, util, interest, loans, pool, top, bridgeRev, stableGlobal, alloc, inputs] = await Promise.all([
    Q.syrupPrice(), Q.syrupBuybacks(), Q.earnShare(), Q.utilization(), Q.interestWeekly(), Q.loansWeekly(), Q.poolState(), Q.topLoans(),
    Q.revenueBridge(), Q.stablecoinSupplyGlobal(), Q.earnAllocation(), Q.modelInputs(),
  ]);
  const [pools, lyield, cover, flows, book, holders, staked, tre] = await Promise.all([
    Q.poolTable(), Q.lenderYield(), Q.collateralCover(), Q.lenderFlows(), Q.loanBook(), Q.syrupHolders(), Q.syrupStaked(), Q.treasuryDaily(),
  ]);
  const [yb, ethLend, llamaLend, cgYb, mapleBook] = await Promise.all([Q.yieldBearing(), Q.ethLending(), Q.llamaLending(), Q.cgYieldBearing(), Q.mapleBookDaily()]);
  /* take rate = Maple's cut of the interest on its loans: onchain fees x 12 / loans outstanding at month end */
  const take = ledger.filter((x) => !x.partial_month && x.loans_total && x.onchain_revenue != null)
    .map((x) => ({ month: x.month, onchain_revenue: x.onchain_revenue, loans_total: x.loans_total, take_rate: (Number(x.onchain_revenue) * 12) / Number(x.loans_total) }));

  return contextResponse([
    `# Maple Finance dashboard (maple.paultimofeev.com)
Pages: Business (/), Macro (/macro), Model (/model). Every Maple number is rebuilt from contract events and state on Ethereum and Robinhood Chain, except Maple's reported revenue total, AUM, collateral and buybacks (published by Maple) and SYRUP price (CoinGecko). Buybacks and Syrup Strategic Fund (SSF) holdings are Maple-reported; June-August 2026 buybacks verified onchain (Binance withdrawals to 0x99f0…a9ca). Maple runs buybacks on a centralised exchange.
Definitions: revenue = syrupUSD (syrupUSDC/USDT/USDG loan managers + strategies) + other pools (every other onchain pool), both from contract fee events (open-term ClaimedFundsDistributed, fixed-term fees, strategy fees; WETH pools excluded), + offchain (Maple-reported total minus onchain; Maple Direct / institutional). Total revenue is always Maple-reported; when onchain exceeds it (Sep-Oct 2026) offchain is not separable. Loans outstanding = principalOut() of every USD loan manager, month-end. AUM = lender deposits + borrower collateral. MIP-021 buyback tiers: 10% of monthly revenue below $1.5M, 20% below $2M, 30% above. P/S = SYRUP market cap / trailing-12-month revenue. syrupUSDG = Maple's USDG pool; most of it sits on Robinhood Chain as collateral in Robinhood Earn.
`,
    table("SYRUP price, daily (USD, CoinGecko)", syrup, { max: 200, cols: ["day", "price_usd", "mcap_usd", "volume_usd"] }),
    table("SYRUP supply", supply.slice(-30)),
    table("SYRUP buybacks by month", buybacks),
    table("Syrup Strategic Fund holdings", ssf, { max: 60 }),
    table("Maple balance sheet", bsheet),
    table("Maple revenue by month and source (USD)", rev),
    table("Monthly model: TTM revenue, P/S, revenue yield on AUM, MIP-021 tier", model),
    table("AUM, Maple-reported (weekly)", aumRep, { max: 80 }),
    table("Lender deposits by pool (month-end)", aumPools, { max: 300 }),
    table("Pools today", snap),
    table("SYRUP model by year (same as /api/model)", aggregate(ledger, "year").map((p) => ({ year: p.period, ...p.values }))),
    table("SYRUP model by quarter", aggregate(ledger, "quarter").map((p) => ({ quarter: p.period, ...p.values }))),
    table("Lenders per month", lenders),
    table("Borrowers per month", borrowers),
    table("syrupUSDG share of Robinhood Earn", share, { max: 80 }),
    table("Take rate by month: Maple's cut of the interest on its loans = onchain fees x 12 / loans outstanding at month end", take),
    table("Pools today: deposits, 30-day change, loans, utilization (lent out), lender yield (30-day share-price growth, annualised), borrower rate (size-weighted, open loans), open loans, collateral cover", pools),
    table("Lender yield by pool, 30-day annualised", lyield, { max: 200 }),
    table("Collateral cover by pool (collateral / loans), daily, Maple API", cover, { max: 120 }),
    table("Lender flows into the syrup pools by month: deposits, withdrawals (negative), net", flows),
    table("Open loans today, read from each loan contract: borrower, pool, asset, principal, rate, date funded", book, { max: 100 }),
    table("SYRUP staked in stSYRUP, daily", staked),
    table("Top 50 holders of SYRUP, syrupUSDC, syrupUSDT on Ethereum today, with public name and type", holders, { max: 160 }),
    table("Maple treasury, daily: SYRUP and liquid assets (USD)", tre),
    table("Growth drivers: yield-bearing stablecoins, CoinGecko category top 15 (all chains), daily market cap by coin; the SYRUP model uses their sum", cgYb, { max: 900 }),
    table("Maple loans outstanding and deposits by day (USD pools)", mapleBook, { max: 200 }),
    table("Growth drivers: yield-bearing stablecoins on Ethereum, weekly, USD by token (contract reads)", yb, { max: 400 }),
    table("Growth drivers: stablecoin loans on Ethereum by lender (Aave, Spark, Compound contract reads; Maple loans outstanding), weekly: borrowed, supplied", ethLend, { max: 400 }),
    table("Growth drivers: onchain lending, all chains, 25 largest lending protocols (DefiLlama), weekly: supplied, borrowed", llamaLend, { max: 600 }),
    table("syrupUSDG pool state (AUM, exchange rate)", pool, { max: 80 }),
    table("syrupUSDG utilization and loans outstanding", util, { max: 80 }),
    table("syrupUSDG interest, weekly", interest, { max: 80 }),
    table("syrupUSDG loans, weekly", loans, { max: 80 }),
    table("syrupUSDG top loans by interest", top),
    table("syrupUSDG revenue vs Maple onchain fees, monthly", bridgeRev),
    table("Global stablecoin supply (Macro page)", stableGlobal, { max: 80 }),
    table("Robinhood Earn allocation (Macro page)", alloc, { max: 120 }),
    `## SYRUP valuation model inputs (Model page)\n${JSON.stringify(inputs).slice(0, 20000)}\n`,
  ]);
}
