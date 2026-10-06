import { rhAum, earnAllocation, earnShare, interestWeekly, loansWeekly, shareOfUsdg, poolState, utilization, topLoans, syrupPrice, syrupBuybacks, revenueBridge, capitalOnChain, holders, mapleRevenueMonthly, mapleModelMonthly, mapleAumByPool, mapleAumLatest, annualInputs, syrupSupply, mapleAumReported, poolsSnapshot, mapleLenders, mapleBorrowers } from "@/lib/queries";
import { Counter, Card, StackedColumns, SimpleLine, StackedBars, BarsPlusLine, Table, StackedBarsWithLines } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];
const n = (v: unknown) => Number(v ?? 0);

export default async function MaplePage() {
  const [rev, model, aumPools, aumNow, annual, supply, aumRep, snap] = await Promise.all([
    mapleRevenueMonthly(), mapleModelMonthly(), mapleAumByPool(), mapleAumLatest(), annualInputs(), syrupSupply(), mapleAumReported(), poolsSnapshot(),
  ]);
  const ar = last(aumRep);
  const [lenders, borrowers] = await Promise.all([mapleLenders(), mapleBorrowers()]);
  const ln = last(lenders);
  const bw = last(borrowers);
  const yoy = <T extends Record<string, unknown>>(rows: T[], k: string) => {
    const a = rows.slice(-12).reduce((s, x) => s + n(x[k]), 0), b = rows.slice(-24, -12).reduce((s, x) => s + n(x[k]), 0);
    return b ? a / b - 1 : 0;
  };
  const [aum, alloc, share, interest, loans, usdg, pool, util, top, syrup, buybacks, bridgeRev, cap, hold] = await Promise.all([
    rhAum(), earnAllocation(), earnShare(), interestWeekly(), loansWeekly(), shareOfUsdg(), poolState(), utilization(), topLoans(),
    syrupPrice(), syrupBuybacks(), revenueBridge(), capitalOnChain(), holders(),
  ]);

  const m = last(model);
  const r = last(rev);
  const sp = last(syrup);
  const sup = last(supply);
    const ttm = [...model].reverse().find((x) => x.ttm_revenue != null);
  const psNow = ttm ? n(sp?.mcap_usd) / n(ttm.ttm_revenue) : 0;
  const bbTotal = buybacks.reduce((s, x) => s + n(x.amount_usd), 0);
  const holderOf = (t: string) => n(hold.find((x) => x.token === t)?.holders);

  const lastDay = last(aum)?.day;
  const aumRh = aum.filter((x) => x.day === lastDay).reduce((s, x) => s + n(x.aum_usd), 0);
  const p = last(pool);
  const sh = last(share);
  const al = last(alloc);
  const it = last(interest);
  const lo = [...loans].reverse().find((x) => x.principal_outstanding_usd != null);
  const u = last(util);
  const ug = last(usdg);
  const cl = last(cap);
  const rb = last(bridgeRev);

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Maple Finance + SYRUP</h1>
        <p className="text-sm text-neutral-500">
          Every Maple number on this page is rebuilt from contract events and state on Ethereum and Robinhood Chain (239-contract registry), except OTC desk revenue (published by Maple) and SYRUP price (CoinGecko).
        </p>
      </header>

      {/* ---------------------------------------------------------------- the business */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">The business: revenue, AUM, multiple</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Counter label="Revenue, trailing 12m" value={fmtUsd(n(ttm?.ttm_revenue))} sub={`through ${String(ttm?.month ?? "").slice(0, 7)}`} />
          <Counter label="Revenue, last full month" value={fmtUsd(n(r?.total_revenue))} sub={`${String(r?.month ?? "").slice(0, 7)} · ${fmtUsd(n(r?.onchain_revenue))} onchain`} />
          <Counter label="AUM (Maple definition)" value={fmtUsd(n(ar?.aum_usd))} sub={`${fmtUsd(n(ar?.deposits_usd))} deposits + ${fmtUsd(n(ar?.collateral_usd))} collateral · ${String(ar?.day ?? "").slice(0, 10)}`} />
          <Counter label="Revenue yield on AUM" value={fmtPct(n(m?.revenue_yield_on_aum))} sub="last month × 12 ÷ month-end AUM" />
          <Counter label="SYRUP market cap" value={fmtUsd(n(sp?.mcap_usd))} sub={`$${n(sp?.price_usd).toFixed(4)} (CoinGecko)`} />
          <Counter label="P/S, trailing 12m" value={`${psNow.toFixed(1)}x`} sub="market cap ÷ TTM revenue" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Revenue by month and source, vs MIP-021 buyback tiers">
            <StackedBarsWithLines data={rev} x="month" ys={["open_term_loans", "fixed_term_loans", "strategies", "otc_offchain"]}
              lines={[{ y: 1_500_000, label: "20% tier" }, { y: 2_000_000, label: "30% tier" }]} />
          </Card>
          <Card title="AUM = lender deposits + borrower collateral (weekly, Dune export)"><StackedBars data={aumRep} x="day" ys={["deposits_usd", "collateral_usd"]} /></Card>
          <Card title="Lender deposits by pool, month-end (pool totalAssets, live from contracts)"><StackedColumns data={aumPools} x="day" y="aum_usd" group="pool" /></Card>
          <Card title="P/S on trailing-12m revenue"><SimpleLine data={model.filter((x) => x.ps_ttm != null)} x="month" ys={["ps_ttm"]} fmt="mult" /></Card>
          <Card title="Revenue yield on AUM (annualised)"><SimpleLine data={model.filter((x) => x.revenue_yield_on_aum != null)} x="month" ys={["revenue_yield_on_aum"]} /></Card>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="mb-3 text-sm font-medium text-neutral-300">Pools snapshot (Dune export, Sep 2026)</div>
          <Table rows={snap} cols={[
            { key: "pool_name", title: "pool" }, { key: "tvl", title: "TVL", fmt: "usd" }, { key: "share_of_protocol_tvl", title: "share", fmt: "pct" },
            { key: "loans_outstanding_usd", title: "loans out", fmt: "usd" }, { key: "utilization_reported", title: "utilization", fmt: "pct" },
            { key: "xirr_30day", title: "30d yield", fmt: "pct" }, { key: "cumulative_originations_usd", title: "originated", fmt: "usd" },
          ]} />
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="mb-3 text-sm font-medium text-neutral-300">By year: the model&apos;s history columns</div>
          <Table rows={annual} cols={[
            { key: "year", title: "year" }, { key: "months", title: "months", fmt: "raw" },
            { key: "onchain_revenue", title: "onchain rev", fmt: "usd" }, { key: "offchain_revenue", title: "OTC / offchain", fmt: "usd" },
            { key: "total_revenue", title: "total revenue", fmt: "usd" }, { key: "aum_year_end", title: "AUM (yr-end)", fmt: "usd" },
            { key: "mcap_year_end", title: "mcap (yr-end)", fmt: "usd" }, { key: "ps", title: "P/S", fmt: "mult" }, { key: "buybacks", title: "buybacks", fmt: "usd" },
          ]} />
        </div>
        <p className="text-xs text-neutral-500">
          <span className="text-neutral-400">Onchain revenue</span> = open-term <code>ClaimedFundsDistributed</code> (platform + delegate fees) + fixed-term <code>ManagementFeesPaid</code> / <code>ServiceFeesPaid</code> / <code>OriginationFeesPaid</code> + strategy <code>StrategyFeesCollected</code>. WETH pools excluded.
          {" "}<span className="text-neutral-400">OTC / offchain</span> = Maple&apos;s published OTC desk revenue through May 2026; from July 2026 implied from onchain buybacks (MIP-021 buyback ÷ tier − onchain fees). June 2026 has no offchain figure.
        </p>
      </section>

      {/* ---------------------------------------------------------------- lenders + borrowers */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Lenders and borrowers</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="Unique lenders (all-time)" value={n(ln?.cumulative_lenders).toLocaleString()} sub={`${n(ln?.new_lenders).toLocaleString()} new in ${String(ln?.month ?? "").slice(0, 7)}`} />
          <Counter label="New lenders, last 12m vs prior 12m" value={`${yoy(lenders, "new_lenders") >= 0 ? "+" : ""}${fmtPct(yoy(lenders, "new_lenders"))}`} sub="pool Deposit events, all USD pools" />
          <Counter label="Unique borrowers (all-time)" value={n(bw?.cumulative_borrowers).toLocaleString()} sub={`${n(bw?.active_borrowers)} paying in ${String(bw?.month ?? "").slice(0, 7)} · ${n(bw?.active_loans)} loans`} />
          <Counter label="Interest paid, last 12m vs prior 12m" value={`${yoy(borrowers, "interest_paid_usd") >= 0 ? "+" : ""}${fmtPct(yoy(borrowers, "interest_paid_usd"))}`} sub="gross interest on open-term loans" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Lenders per month: new vs returning"><StackedBars data={lenders.map((x) => ({ ...x, returning_lenders: n(x.active_lenders) - n(x.new_lenders) }))} x="month" ys={["new_lenders", "returning_lenders"]} fmt="raw" /></Card>
          <Card title="Cumulative unique lenders"><SimpleLine data={lenders} x="month" ys={["cumulative_lenders"]} fmt="raw" /></Card>
          <Card title="Borrowers paying per month: new vs existing"><StackedBars data={borrowers.map((x) => ({ ...x, existing_borrowers: n(x.active_borrowers) - n(x.new_borrowers) }))} x="month" ys={["new_borrowers", "existing_borrowers"]} fmt="raw" /></Card>
          <Card title="Interest paid by borrowers per month"><StackedBars data={borrowers} x="month" ys={["interest_paid_usd"]} /></Card>
        </div>
        <p className="text-xs text-neutral-500">Lenders = distinct share recipients of ERC-4626 <code>Deposit</code> on every USD Maple pool. Borrowers = <code>loan.borrower()</code> for every loan that made a payment (<code>ClaimedFundsDistributed</code>, fixed-term fee events). Rebuilt from contracts; replaces the Dune versions.</p>
      </section>

      {/* ---------------------------------------------------------------- Robinhood channel */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">syrupUSDG × Robinhood Earn</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Counter label="syrupUSDG pool AUM" value={fmtUsd(n(p?.total_assets))} sub={`exch rate ${n(p?.exch_rate || 1).toFixed(4)}`} />
          <Counter label="of which on Robinhood Chain" value={fmtUsd(aumRh)} sub={`${fmtPct(aumRh / (n(p?.total_assets) || 1))} of pool`} />
          <Counter label="Robinhood Earn TVL" value={fmtUsd(n(al?.earn_tvl_usdg))} />
          <Counter label="syrupUSDG share of Earn" value={fmtPct(n(sh?.maple_share_of_earn))} />
          <Counter label="Interest generated (all-time)" value={fmtUsd(n(it?.cumulative_gross_interest_usd))} sub={`Maple take rate ${fmtPct(n(it?.maple_take_rate))}`} />
          <Counter label="syrupUSDG revenue, last month" value={fmtUsd(n(rb?.syrupusdg_revenue))} sub={`${fmtPct(n(rb?.syrupusdg_share_of_onchain_rev))} of Maple open-term platform fees`} />
          <Counter label="Loans outstanding" value={fmtUsd(n(lo?.principal_outstanding_usd))} sub={`utilization ${fmtPct(n(u?.utilization))}`} />
          <Counter label="Share of USDG on Robinhood Chain" value={fmtPct(n(ug?.maple_share_of_usdg))} sub={`USDG supply ${fmtUsd(n(ug?.usdg_supply))} · ${holderOf("USDG").toLocaleString()} holders`} />
          <Counter label="Share of capital on Robinhood Chain" value={fmtPct(n(cl?.maple_share_of_capital))} sub="onchain: ETH bridged + USDG minted" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Robinhood Earn TVL by collateral"><StackedColumns data={alloc} x="day" y="allocated_usdg" group="collateral" /></Card>
          <Card title="syrupUSDG share of Robinhood Earn"><SimpleLine data={share} x="day" ys={["maple_share_of_earn"]} /></Card>
          <Card title="Maple AUM on Robinhood Chain"><StackedColumns data={aum} x="day" y="aum_usd" group="token" /></Card>
          <Card title="syrupUSDG pool AUM vs loans outstanding"><SimpleLine data={util} x="day" ys={["total_assets", "loans_outstanding"]} fmt="usd" /></Card>
          <Card title="syrupUSDG interest, weekly: who gets it"><StackedBars data={interest} x="week" ys={["interest_to_depositors_usd", "delegate_fee_usd", "maple_fee_usd"]} /></Card>
          <Card title="syrupUSDG loans: originated (bars) vs outstanding (line), weekly"><BarsPlusLine data={loans} x="week" bar="originated_usd" line="principal_outstanding_usd" /></Card>
          <Card title="syrupUSDG utilization"><SimpleLine data={util} x="day" ys={["utilization"]} /></Card>
          <Card title="syrupUSDG exchange rate"><SimpleLine data={pool} x="day" ys={["exch_rate"]} fmt="rate" /></Card>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="mb-3 text-sm font-medium text-neutral-300">syrupUSDG: top loans by interest generated</div>
          <Table rows={top} cols={[
            { key: "loan", title: "loan", fmt: "addr" }, { key: "payments", title: "payments", fmt: "raw" },
            { key: "principal_usd", title: "principal repaid", fmt: "usd" }, { key: "interest_usd", title: "interest", fmt: "usd" },
            { key: "maple_revenue_usd", title: "maple rev", fmt: "usd" }, { key: "first_payment", title: "first", fmt: "raw" }, { key: "last_payment", title: "last", fmt: "raw" },
          ]} />
        </div>
      </section>

      {/* ---------------------------------------------------------------- SYRUP */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">SYRUP: value accrual</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="SYRUP price" value={`$${n(sp?.price_usd).toFixed(4)}`} sub={`mcap ${fmtUsd(n(sp?.mcap_usd))}`} />
          <Counter label="Circulating supply (onchain)" value={`${(n(sup?.circulating) / 1e6).toFixed(1)}M`} sub={`total ${(n(sup?.total_supply) / 1e6).toFixed(1)}M − DAO multisig ${(n(sup?.maple_held) / 1e6).toFixed(1)}M`} />
          <Counter label="Buybacks, all-time" value={fmtUsd(bbTotal)} sub={`${buybacks.length} months · through ${String(last(buybacks)?.month ?? "").slice(0, 7)}`} />
          <Counter label="MIP-021 tier, last month" value={fmtPct(n(m?.mip021_tier))} sub={`on ${fmtUsd(n(m?.total_revenue))} revenue: 10% < $1.5M · 20% < $2M · 30% above`} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="SYRUP price"><SimpleLine data={syrup} x="day" ys={["price_usd"]} fmt="rate" /></Card>
          <Card title="SYRUP buybacks by month (bars) and average price (line)"><BarsPlusLine data={buybacks} x="month" bar="amount_usd" line="avg_price" /></Card>
        </div>
        <p className="text-xs text-neutral-500">
          Buyback amounts are Maple-published. June, July and August 2026 are verified onchain: each matches a SYRUP withdrawal from Binance that ends in the same wallet (0x99f0…a9ca), within a few tokens (July exactly). Maple executes buybacks on a centralised exchange, not onchain.
        </p>
      </section>
    </main>
  );
}
