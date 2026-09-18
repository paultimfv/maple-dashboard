import { rhAum, earnAllocation, earnShare, interestWeekly, loansWeekly, shareOfRhTvl, shareOfUsdg, poolState, utilization, topLoans, earnDepositors, earnDepositSizes, bridgeFlow, syrupPrice, syrupBuybacks, revenueBridge, chainActivity, memeShare, topContracts, chainEconomics } from "@/lib/queries";
import { Counter, Card, StackedArea, SimpleArea, SimpleLine, StackedBars, BarsPlusLine, Table } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];

export default async function Page() {
  const [aum, alloc, share, interest, loans, rhTvl, usdg, pool, util, top, dep, sizes, bridge, syrup, buybacks, rev] = await Promise.all([
    rhAum(), earnAllocation(), earnShare(), interestWeekly(), loansWeekly(), shareOfRhTvl(), shareOfUsdg(), poolState(), utilization(), topLoans(),
    earnDepositors(), earnDepositSizes(), bridgeFlow(), syrupPrice(), syrupBuybacks(), revenueBridge(),
  ]);
  const [act, meme, topc, econ] = await Promise.all([chainActivity(), memeShare(), topContracts(), chainEconomics()]);
  const ac = last(act);
  const ec = last(econ);
  const lastWeekMeme = meme.filter((r) => r.week === last(meme)?.week);
  const memeTx = lastWeekMeme.find((r) => r.bucket === "launchpad");
  const sp = last(syrup);
  const rv = last(rev);
  const bbTotal = buybacks.reduce((s, r) => s + Number(r.amount_usd), 0);
  const u = last(util);
  const ug = last(usdg);

  const lastDay = last(aum)?.day;
  const aumLatest = aum.filter((r) => r.day === lastDay);
  const aumTotal = aumLatest.reduce((s, r) => s + Number(r.aum_usd), 0);
  const p = last(pool);
  const sh = last(share);
  const al = last(alloc);
  const it = last(interest);
  const lo = [...loans].reverse().find((r) => r.principal_outstanding_usd != null);
  const rt = last(rhTvl);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Maple Finance × Robinhood</h1>
        <p className="text-sm text-neutral-500">Self-hosted · data as of {String(lastDay).slice(0, 10)} · source: Ethereum + Robinhood Chain RPC, DeFiLlama</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Robinhood Chain</h2>
        <p className="text-xs text-neutral-500">Sampled: 200 blocks per UTC day with full receipts, scaled to the day&apos;s block count. Active addresses = sum of per-block unique senders (upper bound). Launchpad = tx sent directly to one of {`~130`} known launchpad contracts (community classifier); DEX-router trades of meme tokens land in &quot;other&quot; until labeled.</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="Transactions / day (est)" value={Number(ac?.txs_est ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} sub={`${Number(ac?.n_blocks ?? 0).toLocaleString()} blocks · ${String(ac?.day ?? "")}`} />
          <Counter label="Fees / day (est)" value={fmtUsd(Number(ac?.fees_usd_est ?? 0))} sub={`${Number(ac?.fees_eth_est ?? 0).toFixed(2)} ETH · base ${Number(ac?.avg_base_fee_gwei ?? 0).toFixed(3)} gwei`} />
          <Counter label="Launchpad share of txs, last week" value={fmtPct(Number(memeTx?.tx_share ?? 0))} sub={`${fmtPct(Number(memeTx?.gas_share ?? 0))} of gas`} />
          <Counter label="Sequencer margin, last week" value={fmtPct(Number(ec?.margin ?? 0))} sub={`L2 fees ${fmtUsd(Number(ec?.l2_fees_usd ?? 0))} − L1 cost ${fmtUsd(Number(ec?.l1_cost_usd ?? 0))}`} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Transactions per day (est)"><SimpleArea data={act} x="day" y="txs_est" fmt="raw" /></Card>
          <Card title="Fees per day, USD (est)"><SimpleArea data={act} x="day" y="fees_usd_est" /></Card>
          <Card title="Share of transactions: launchpad vs other, weekly"><StackedArea data={meme} x="week" y="tx_share" group="bucket" fmt="pct" /></Card>
          <Card title="Share of gas: launchpad vs other, weekly"><StackedArea data={meme} x="week" y="gas_share" group="bucket" fmt="pct" /></Card>
          <Card title="Chain economics, weekly: L2 fees vs L1 posting cost"><StackedBars data={econ} x="week" ys={["l2_fees_usd", "l1_cost_usd"]} /></Card>
          <Card title="Net sequencer revenue, weekly (est)"><StackedBars data={econ} x="week" ys={["net_usd"]} /></Card>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="mb-3 text-sm font-medium text-neutral-300">Top contracts by gas, last 30 days (sampled)</div>
          <Table rows={topc} cols={[
            { key: "to_addr", title: "contract", fmt: "addr" }, { key: "label", title: "label" }, { key: "txs", title: "txs", fmt: "raw" },
            { key: "gas_share", title: "gas share", fmt: "pct" }, { key: "fees_eth", title: "fees (ETH)", fmt: "rate" },
          ]} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Maple × Robinhood</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Counter label="syrupUSDG pool AUM" value={fmtUsd(Number(p?.total_assets ?? 0))} sub={`exch rate ${Number(p?.exch_rate ?? 1).toFixed(4)}`} />
          <Counter label="of which on Robinhood Chain" value={fmtUsd(aumTotal)} sub={`${fmtPct(aumTotal / Number(p?.total_assets ?? 1))} of pool`} />
          <Counter label="Robinhood Earn TVL" value={fmtUsd(Number(al?.earn_tvl_usdg ?? 0))} />
          <Counter label="Maple share of Robinhood Earn" value={fmtPct(Number(sh?.maple_share_of_earn ?? 0))} />
          <Counter label="Interest generated (all-time)" value={fmtUsd(Number(it?.cumulative_gross_interest_usd ?? 0))} sub={`take rate ${fmtPct(Number(it?.maple_take_rate ?? 0))}`} />
          <Counter label="Loans outstanding" value={fmtUsd(Number(lo?.principal_outstanding_usd ?? 0))} />
          <Counter label="Total originated" value={fmtUsd(Number(last(loans)?.cumulative_originated_usd ?? 0))} />
          <Counter label="Share of USDG on Robinhood Chain" value={fmtPct(Number(ug?.maple_share_of_usdg ?? 0))} sub={`USDG supply ${fmtUsd(Number(ug?.usdg_supply ?? 0))} (on-chain)`} />
          <Counter label="Share of Robinhood DeFi TVL" value={fmtPct(Number(rt?.maple_share_of_rh_tvl ?? 0))} sub={`chain TVL ${fmtUsd(Number(rt?.robinhood_chain_tvl_usd ?? 0))} (DeFiLlama)`} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Maple AUM on Robinhood Chain"><StackedArea data={aum} x="day" y="aum_usd" group="token" /></Card>
          <Card title="Robinhood Earn TVL by collateral"><StackedArea data={alloc} x="day" y="allocated_usdg" group="collateral" /></Card>
          <Card title="Maple share of Robinhood Earn"><SimpleLine data={share} x="day" ys={["maple_share_of_earn"]} /></Card>
          <Card title="Maple share of USDG on Robinhood Chain"><SimpleLine data={usdg} x="day" ys={["maple_share_of_usdg"]} /></Card>
          <Card title="Maple share of Robinhood DeFi TVL (DeFiLlama)"><SimpleLine data={rhTvl} x="day" ys={["maple_share_of_rh_tvl"]} /></Card>
          <Card title="Interest, weekly (who gets it)"><StackedBars data={interest} x="week" ys={["interest_to_depositors_usd", "delegate_fee_usd", "maple_fee_usd"]} /></Card>
          <Card title="Loans: originated (bars) vs outstanding (line), weekly"><BarsPlusLine data={loans} x="week" bar="originated_usd" line="principal_outstanding_usd" /></Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">syrupUSDG</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="Pool AUM (totalAssets)" value={fmtUsd(Number(p?.total_assets ?? 0))} />
          <Counter label="Loans outstanding" value={fmtUsd(Number(u?.loans_outstanding ?? 0))} />
          <Counter label="Utilization" value={fmtPct(Number(u?.utilization ?? 0))} />
          <Counter label="Exchange rate" value={Number(p?.exch_rate ?? 1).toFixed(4)} sub="1 syrupUSDG in USDG" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Pool AUM vs loans outstanding"><SimpleLine data={util} x="day" ys={["total_assets", "loans_outstanding"]} fmt="usd" /></Card>
          <Card title="Utilization"><SimpleLine data={util} x="day" ys={["utilization"]} /></Card>
          <Card title="Exchange rate"><SimpleLine data={pool} x="day" ys={["exch_rate"]} fmt="rate" /></Card>
          <Card title="Revenue to Maple, weekly"><StackedBars data={interest} x="week" ys={["maple_fee_usd"]} /></Card>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="mb-3 text-sm font-medium text-neutral-300">Top loans by interest generated</div>
          <Table rows={top} cols={[
            { key: "loan", title: "loan", fmt: "addr" }, { key: "payments", title: "payments", fmt: "raw" },
            { key: "principal_usd", title: "principal repaid", fmt: "usd" }, { key: "interest_usd", title: "interest", fmt: "usd" },
            { key: "maple_revenue_usd", title: "maple rev", fmt: "usd" }, { key: "first_payment", title: "first", fmt: "raw" }, { key: "last_payment", title: "last", fmt: "raw" },
          ]} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Robinhood Earn — depositors</h2>
        <p className="text-xs text-neutral-500">Steakhouse USDG vault (steakUSDG) on Robinhood Chain — the contract behind Robinhood Earn. Users = distinct share owners.</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="Earn users (all-time)" value={Number(sizes?.users ?? 0).toLocaleString()} sub={`${Number(sizes?.deposits ?? 0).toLocaleString()} deposits`} />
          <Counter label="Median deposit" value={fmtUsd(Number(sizes?.median_deposit ?? 0))} sub={`avg ${fmtUsd(Number(sizes?.avg_deposit ?? 0))} · p90 ${fmtUsd(Number(sizes?.p90_deposit ?? 0))}`} />
          <Counter label="Active users, last week" value={Number(last(dep)?.active_users ?? 0).toLocaleString()} sub={`${Number(last(dep)?.new_users ?? 0).toLocaleString()} new`} />
          <Counter label="Net flow, last week" value={fmtUsd(Number(last(dep)?.net_flow_usd ?? 0))} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Earn users per week (active vs new)"><StackedBars data={dep} x="week" ys={["new_users", "active_users"]} fmt="raw" /></Card>
          <Card title="Earn deposits vs net flow, weekly"><BarsPlusLine data={dep} x="week" bar="deposited_usd" line="net_flow_usd" /></Card>
          <Card title="syrupUSDG bridged to / from Robinhood Chain, weekly"><StackedBars data={bridge} x="week" ys={["bridged_in", "bridged_out"]} /></Card>
          <Card title="Cumulative Earn users"><SimpleArea data={dep} x="week" y="cumulative_users" fmt="raw" /></Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">SYRUP — value accrual</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="SYRUP price" value={`$${Number(sp?.price_usd ?? 0).toFixed(3)}`} sub={`mcap ${fmtUsd(Number(sp?.mcap_usd ?? 0))}`} />
          <Counter label="Buybacks (all-time, table)" value={fmtUsd(bbTotal)} sub={`${buybacks.length} months · through ${String(last(buybacks)?.month ?? "").slice(0, 7)}`} />
          <Counter label="syrupUSDG revenue, last month" value={fmtUsd(Number(rv?.syrupusdg_revenue ?? 0))} sub={`${fmtPct(Number(rv?.syrupusdg_share_of_onchain_rev ?? 0))} of Maple on-chain fees`} />
          <Counter label="MIP-021 tier (on-chain fees only)" value={fmtPct(Number(rv?.mip21_tier ?? 0))} sub="excludes OTC desk revenue — see note" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="SYRUP price (CoinGecko, trailing 1y)"><SimpleLine data={syrup} x="day" ys={["price_usd"]} fmt="rate" /></Card>
          <Card title="SYRUP buybacks by month"><BarsPlusLine data={buybacks} x="month" bar="amount_usd" line="avg_price" /></Card>
          <Card title="Maple on-chain revenue by month: syrupUSDG vs all pools"><StackedBars data={rev} x="month" ys={["syrupusdg_revenue", "onchain_revenue_all_pools"]} /></Card>
          <Card title="Implied MIP-021 buyback from on-chain fees"><StackedBars data={rev} x="month" ys={["implied_buyback_onchain_only"]} /></Card>
        </div>
        <p className="text-xs text-neutral-500">
          MIP-021 (Aug 2026, 6 months): 10% of monthly protocol revenue below $1.5M, 20% between $1.5–2M, 30% above $2M goes to SYRUP buybacks.
          On-chain fees here = open-term platform mgmt + service fees (mainnet, WETH pool excluded). Maple&apos;s OTC desk revenue (~46% of all-time revenue) is off-chain and not included, so the tier shown is a floor.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">syrupUSDC on Robinhood — launch watch</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="syrupUSDC supply on Robinhood" value={fmtUsd(Number(aumLatest.find((r) => r.token === "syrupUSDC")?.aum_usd ?? 0))} sub="0 until launch" />
        </div>
      </section>
    </main>
  );
}
