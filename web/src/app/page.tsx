import { rhAum, earnAllocation, earnShare, interestWeekly, loansWeekly, shareOfRhTvl, shareOfUsdg, poolState, utilization, topLoans } from "@/lib/queries";
import { Counter, Card, StackedArea, SimpleArea, SimpleLine, StackedBars, BarsPlusLine, Table } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];

export default async function Page() {
  const [aum, alloc, share, interest, loans, rhTvl, usdg, pool, util, top] = await Promise.all([
    rhAum(), earnAllocation(), earnShare(), interestWeekly(), loansWeekly(), shareOfRhTvl(), shareOfUsdg(), poolState(), utilization(), topLoans(),
  ]);
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
        <h2 className="text-lg font-medium">Macro</h2>
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
        <h2 className="text-lg font-medium">syrupUSDC on Robinhood — launch watch</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="syrupUSDC supply on Robinhood" value={fmtUsd(Number(aumLatest.find((r) => r.token === "syrupUSDC")?.aum_usd ?? 0))} sub="0 until launch" />
        </div>
      </section>
    </main>
  );
}
