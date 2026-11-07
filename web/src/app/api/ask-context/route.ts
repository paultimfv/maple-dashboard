// GET /api/ask-context → every dataset on this dashboard as compact text, read by the "Ask AI" assistant.
import * as Q from "@/lib/queries";
import { table, contextResponse } from "@/lib/ask-context";
import { modelLedger, aggregate } from "@/lib/model-export";

export const dynamic = "force-dynamic";

export async function GET() {
  const [rev, model, aumPools, aumRep, ledger, supply, snap, lenders, borrowers, ssf, bsheet] = await Promise.all([
    Q.mapleRevenueMonthly(), Q.mapleModelMonthly(), Q.mapleAumByPool(), Q.mapleAumReported(), modelLedger(), Q.syrupSupply(),
    Q.poolsSnapshot(), Q.mapleLenders(), Q.mapleBorrowers(), Q.ssfDaily(), Q.mapleBalanceSheet(),
  ]);
  const [syrup, buybacks, share, util, interest, loans, pool, top, bridgeRev, stableGlobal, alloc, inputs] = await Promise.all([
    Q.syrupPrice(), Q.syrupBuybacks(), Q.earnShare(), Q.utilization(), Q.interestWeekly(), Q.loansWeekly(), Q.poolState(), Q.topLoans(),
    Q.revenueBridge(), Q.stablecoinSupplyGlobal(), Q.earnAllocation(), Q.modelInputs(),
  ]);

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
