import { rhAum, earnAllocation, earnShare, interestWeekly, loansWeekly, shareOfUsdg, poolState, utilization, topLoans, syrupPrice, syrupBuybacks, revenueBridge, capitalOnChain, holders, mapleRevenueMonthly, mapleModelMonthly, mapleAumByPool, mapleAumLatest, annualInputs, syrupSupply, mapleAumReported, poolsSnapshot, mapleLenders, mapleBorrowers, ssfDaily, mapleBalanceSheet } from "@/lib/queries";
import { Counter, Counters, Card, Panel, Section, Note, StackedColumns, SimpleLine, StackedBars, Table, StackedBarsWithLines } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];
const n = (v: unknown) => Number(v ?? 0);

export default async function MaplePage() {
  const [rev, model, aumPools, aumNow, annual, supply, aumRep, snap] = await Promise.all([
    mapleRevenueMonthly(), mapleModelMonthly(), mapleAumByPool(), mapleAumLatest(), annualInputs(), syrupSupply(), mapleAumReported(), poolsSnapshot(),
  ]);
  const ar = last(aumRep);
  const [lenders, borrowers, ssf, bsheet] = await Promise.all([mapleLenders(), mapleBorrowers(), ssfDaily(), mapleBalanceSheet()]);
  const sf = last(ssf);
  const bal = bsheet[0];
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

  const lyoy = yoy(lenders, "new_lenders");
  const iyoy = yoy(borrowers, "interest_paid_usd");
  const signed = (v: number) => `${v >= 0 ? "+" : ""}${fmtPct(v)}`;

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <header className="space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
          Research dashboard · data as of {String(ar?.day ?? "").slice(0, 10)}
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Maple Finance + SYRUP</h1>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">
          Every Maple number on this page is rebuilt from contract events and state on Ethereum and Robinhood Chain (239-contract registry), except OTC desk revenue (published by Maple) and SYRUP price (CoinGecko).
        </p>
      </header>

      {/* ---------------------------------------------------------------- the business */}
      <Section n="01" title="The business: revenue, AUM, multiple">
        <Counters>
          <Counter label="Revenue, TTM" value={fmtUsd(n(ttm?.ttm_revenue))} sub={`through ${String(ttm?.month ?? "").slice(0, 7)}`} />
          <Counter label="Revenue, last month" value={fmtUsd(n(r?.total_revenue))} sub={`${String(r?.month ?? "").slice(0, 7)} · ${fmtUsd(n(r?.onchain_revenue))} onchain`} />
          <Counter label="AUM" value={fmtUsd(n(ar?.aum_usd))} sub={`${fmtUsd(n(ar?.deposits_usd))} deposits + ${fmtUsd(n(ar?.collateral_usd))} collateral`} />
          <Counter label="Revenue yield on AUM" value={fmtPct(n(m?.revenue_yield_on_aum))} sub="last month × 12 ÷ month-end AUM" />
          <Counter label="SYRUP market cap" value={fmtUsd(n(sp?.mcap_usd))} sub={`$${n(sp?.price_usd).toFixed(4)} (CoinGecko)`} />
          <Counter label="P/S, TTM" value={`${psNow.toFixed(1)}x`} sub="market cap ÷ TTM revenue" />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card wide tall title="Revenue by month and source" sub="vs MIP-021 buyback tiers ($1.5M → 20%, $2M → 30%)">
            <StackedBarsWithLines data={rev} x="month" ys={["open_term_loans", "fixed_term_loans", "strategies", "otc_offchain"]}
              lines={[{ y: 1_500_000, label: "20% tier" }, { y: 2_000_000, label: "30% tier" }]} />
          </Card>
          <Card title="P/S on trailing-12m revenue" sub="SYRUP market cap ÷ TTM revenue, month-end"><SimpleLine data={model.filter((x) => x.ps_ttm != null)} x="month" ys={["ps_ttm"]} fmt="mult" /></Card>
          <Card title="AUM = lender deposits + borrower collateral" sub="weekly, Maple-reported since 2023"><StackedBars data={aumRep} x="day" ys={["deposits_usd", "collateral_usd"]} /></Card>
          <Card title="Lender deposits by pool" sub="month-end pool totalAssets, live from contracts"><StackedColumns data={aumPools} x="day" y="aum_usd" group="pool" /></Card>
          <Card title="Revenue yield on AUM" sub="annualised"><SimpleLine data={model.filter((x) => x.revenue_yield_on_aum != null)} x="month" ys={["revenue_yield_on_aum"]} /></Card>
        </div>
        <Panel title="Pools today" sub={`Maple API, ${String(snap[0]?.day ?? "").slice(0, 10)} · TVL = deposits + borrower collateral`}>
          <Table rows={snap} cols={[
            { key: "pool_name", title: "pool" }, { key: "tvl", title: "TVL (AUM)", fmt: "usd" }, { key: "share_of_protocol_tvl", title: "share", fmt: "pct" },
            { key: "deposits_usd", title: "deposits", fmt: "usd" }, { key: "collateral_usd", title: "collateral", fmt: "usd" },
            { key: "loans_outstanding_usd", title: "loans out", fmt: "usd" }, { key: "utilization", title: "utilization", fmt: "pct" },
          ]} />
        </Panel>
        <Panel title="By year" sub="the model's history columns">
          <Table rows={annual} cols={[
            { key: "year", title: "year" }, { key: "months", title: "months", fmt: "raw" },
            { key: "onchain_revenue", title: "onchain rev", fmt: "usd" }, { key: "offchain_revenue", title: "OTC / offchain", fmt: "usd" },
            { key: "total_revenue", title: "total revenue", fmt: "usd" }, { key: "aum_year_end", title: "AUM (yr-end)", fmt: "usd" },
            { key: "mcap_year_end", title: "mcap (yr-end)", fmt: "usd" }, { key: "ps", title: "P/S", fmt: "mult" }, { key: "buybacks", title: "buybacks", fmt: "usd" },
          ]} />
        </Panel>
        <Note>
          <span className="text-ink-2">Onchain revenue</span> = open-term <code>ClaimedFundsDistributed</code> (platform + delegate fees) + fixed-term <code>ManagementFeesPaid</code> / <code>ServiceFeesPaid</code> / <code>OriginationFeesPaid</code> + strategy <code>StrategyFeesCollected</code>. WETH pools excluded.
          {" "}<span className="text-ink-2">OTC / offchain</span> = Maple-reported monthly revenue (transparency page) − our onchain fees. It reconciles to Maple&apos;s published OTC desk revenue within ~$60k in most months.
        </Note>
      </Section>

      {/* ---------------------------------------------------------------- lenders + borrowers */}
      <Section n="02" title="Lenders and borrowers">
        <Counters cols="md:grid-cols-4">
          <Counter label="Unique lenders, all-time" value={n(ln?.cumulative_lenders).toLocaleString()} sub={`${n(ln?.new_lenders).toLocaleString()} new in ${String(ln?.month ?? "").slice(0, 7)}`} />
          <Counter label="New lenders, 12m vs prior" value={signed(lyoy)} tone={lyoy >= 0 ? "up" : "down"} sub="pool Deposit events, all USD pools" />
          <Counter label="Unique borrowers, all-time" value={n(bw?.cumulative_borrowers).toLocaleString()} sub={`${n(bw?.active_borrowers)} paying in ${String(bw?.month ?? "").slice(0, 7)} · ${n(bw?.active_loans)} loans`} />
          <Counter label="Interest paid, 12m vs prior" value={signed(iyoy)} tone={iyoy >= 0 ? "up" : "down"} sub="gross interest on open-term loans" />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Lenders per month" sub="new vs returning"><StackedBars data={lenders.map((x) => ({ ...x, returning_lenders: n(x.active_lenders) - n(x.new_lenders) }))} x="month" ys={["new_lenders", "returning_lenders"]} fmt="raw" /></Card>
          <Card title="Cumulative unique lenders"><SimpleLine data={lenders} x="month" ys={["cumulative_lenders"]} fmt="raw" /></Card>
          <Card title="Borrowers paying per month" sub="new vs existing"><StackedBars data={borrowers.map((x) => ({ ...x, existing_borrowers: n(x.active_borrowers) - n(x.new_borrowers) }))} x="month" ys={["new_borrowers", "existing_borrowers"]} fmt="raw" /></Card>
          <Card title="Interest paid by borrowers per month"><StackedBars data={borrowers} x="month" ys={["interest_paid_usd"]} /></Card>
        </div>
        <Note>Lenders = distinct share recipients of ERC-4626 <code>Deposit</code> on every USD Maple pool. Borrowers = <code>loan.borrower()</code> for every loan that made a payment (<code>ClaimedFundsDistributed</code>, fixed-term fee events). Rebuilt from contracts; replaces the Dune versions.</Note>
      </Section>

      {/* ---------------------------------------------------------------- Robinhood channel */}
      <Section n="03" title="syrupUSDG × Robinhood Earn">
        <Counters cols="md:grid-cols-3">
          <Counter label="syrupUSDG pool AUM" value={fmtUsd(n(p?.total_assets))} sub={`exch rate ${n(p?.exch_rate || 1).toFixed(4)}`} />
          <Counter label="On Robinhood Chain" value={fmtUsd(aumRh)} sub={`${fmtPct(aumRh / (n(p?.total_assets) || 1))} of pool`} />
          <Counter label="Robinhood Earn TVL" value={fmtUsd(n(al?.earn_tvl_usdg))} />
          <Counter label="syrupUSDG share of Earn" value={fmtPct(n(sh?.maple_share_of_earn))} />
          <Counter label="Interest generated, all-time" value={fmtUsd(n(it?.cumulative_gross_interest_usd))} sub={`Maple take rate ${fmtPct(n(it?.maple_take_rate))}`} />
          <Counter label="syrupUSDG revenue, last month" value={fmtUsd(n(rb?.syrupusdg_revenue))} sub={`${fmtPct(n(rb?.syrupusdg_share_of_onchain_rev))} of Maple open-term platform fees`} />
          <Counter label="Loans outstanding" value={fmtUsd(n(lo?.principal_outstanding_usd))} sub={`utilization ${fmtPct(n(u?.utilization))}`} />
          <Counter label="Share of USDG on RH Chain" value={fmtPct(n(ug?.maple_share_of_usdg))} sub={`USDG supply ${fmtUsd(n(ug?.usdg_supply))} · ${holderOf("USDG").toLocaleString()} holders`} />
          <Counter label="Share of capital on RH Chain" value={fmtPct(n(cl?.maple_share_of_capital))} sub="onchain: ETH bridged + USDG minted" />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Robinhood Earn TVL by collateral"><StackedColumns data={alloc} x="day" y="allocated_usdg" group="collateral" /></Card>
          <Card title="syrupUSDG share of Robinhood Earn"><SimpleLine data={share} x="day" ys={["maple_share_of_earn"]} /></Card>
          <Card title="Maple AUM on Robinhood Chain"><StackedColumns data={aum} x="day" y="aum_usd" group="token" /></Card>
          <Card title="syrupUSDG pool AUM vs loans outstanding"><SimpleLine data={util} x="day" ys={["total_assets", "loans_outstanding"]} fmt="usd" /></Card>
          <Card title="syrupUSDG interest, weekly" sub="who gets it"><StackedBars data={interest} x="week" ys={["interest_to_depositors_usd", "delegate_fee_usd", "maple_fee_usd"]} /></Card>
          <Card title="syrupUSDG utilization"><SimpleLine data={util} x="day" ys={["utilization"]} /></Card>
          <Card title="syrupUSDG loans originated, weekly"><StackedBars data={loans} x="week" ys={["originated_usd"]} /></Card>
          <Card title="syrupUSDG loans outstanding"><SimpleLine data={loans.filter((x) => x.principal_outstanding_usd != null)} x="week" ys={["principal_outstanding_usd"]} fmt="usd" /></Card>
          <Card wide title="syrupUSDG exchange rate"><SimpleLine data={pool} x="day" ys={["exch_rate"]} fmt="rate" /></Card>
        </div>
        <Panel title="syrupUSDG: top loans by interest generated">
          <Table rows={top} cols={[
            { key: "loan", title: "loan", fmt: "addr" }, { key: "payments", title: "payments", fmt: "raw" },
            { key: "principal_usd", title: "principal repaid", fmt: "usd" }, { key: "interest_usd", title: "interest", fmt: "usd" },
            { key: "maple_revenue_usd", title: "maple rev", fmt: "usd" }, { key: "first_payment", title: "first" }, { key: "last_payment", title: "last" },
          ]} />
        </Panel>
      </Section>

      {/* ---------------------------------------------------------------- SYRUP */}
      <Section n="04" title="SYRUP: value accrual">
        <Counters cols="md:grid-cols-4">
          <Counter label="SYRUP price" value={`$${n(sp?.price_usd).toFixed(4)}`} sub={`mcap ${fmtUsd(n(sp?.mcap_usd))}`} />
          <Counter label="Circulating supply" value={`${(n(sup?.circulating) / 1e6).toFixed(1)}M`} sub={`total ${(n(sup?.total_supply) / 1e6).toFixed(1)}M (contract) − SSF ${(n(sup?.ssf_held) / 1e6).toFixed(1)}M (Maple)`} />
          <Counter label="Buybacks, all-time" value={fmtUsd(bbTotal)} sub={`${buybacks.length} months · through ${String(last(buybacks)?.month ?? "").slice(0, 7)}`} />
          <Counter label="MIP-021 tier, last month" value={fmtPct(n(m?.mip021_tier))} sub={`on ${fmtUsd(n(m?.total_revenue))} revenue: 10% < $1.5M · 20% < $2M · 30% above`} />
        </Counters>
        <Counters cols="md:grid-cols-3">
          <Counter label="Syrup Strategic Fund" value={`${(n(sf?.syrup_held) / 1e6).toFixed(1)}M SYRUP`} sub={`+ ${fmtUsd(n(sf?.liquid_assets_usd))} liquid assets · ${String(sf?.day ?? "").slice(0, 10)}`} />
          <Counter label="Maple balance sheet" value={fmtUsd(n(bal?.syrup_usd) + n(bal?.liquid_assets_usd))} sub={`${(n(bal?.syrup_amount) / 1e6).toFixed(1)}M SYRUP (${fmtUsd(n(bal?.syrup_usd))}) + ${fmtUsd(n(bal?.liquid_assets_usd))} liquid`} />
          <Counter label="SSF SYRUP, change since Aug 2025" value={`${((n(sf?.syrup_held) - n(ssf[0]?.syrup_held)) / 1e6).toFixed(1)}M`} sub="vs SYRUP bought back over the same period" />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="SYRUP price"><SimpleLine data={syrup} x="day" ys={["price_usd"]} fmt="rate" /></Card>
          <Card title="Syrup Strategic Fund: SYRUP held" sub="Maple-reported"><SimpleLine data={ssf} x="day" ys={["syrup_held"]} fmt="raw" /></Card>
          <Card title="SYRUP buybacks by month" sub="USD spent"><StackedBars data={buybacks} x="month" ys={["amount_usd"]} /></Card>
          <Card title="Average buyback price" sub="USD per SYRUP"><SimpleLine data={buybacks} x="month" ys={["avg_price"]} fmt="rate" /></Card>
        </div>
        <Note>
          Buyback amounts and SSF holdings are Maple-reported (transparency page). June, July and August 2026 are verified onchain: each matches a SYRUP withdrawal from Binance that ends in the same wallet (0x99f0…a9ca), within a few tokens (July exactly). Maple executes buybacks on a centralised exchange, not onchain.
        </Note>
      </Section>
    </main>
  );
}
