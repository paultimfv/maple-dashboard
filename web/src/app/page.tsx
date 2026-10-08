import { earnAllocation, earnShare, earnDepositors, earnDepositSizes, bridgeFlow, stablecoinSupplyGlobal, llamaFeesByBucket, llamaFinanceProtocols, llamaFinanceWeekly, earnRwaShare, bsChain, capitalOnChain, holders, stableSupply, stableSupplyLatest } from "@/lib/queries";
import Link from "next/link";
import { Counter, Counters, Card, Panel, Section, Note, StackedArea, StackedAreas, StackedColumns, SimpleArea, SimpleLine, StackedBars, BarsAndLine, CategoryBars, Table } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];

export default async function Page() {
  const [alloc, share, dep, sizes, bridge, stableGlobal] = await Promise.all([
    earnAllocation(), earnShare(), earnDepositors(), earnDepositSizes(), bridgeFlow(), stablecoinSupplyGlobal(),
  ]);
  const [buckets, finp, finw] = await Promise.all([llamaFeesByBucket(), llamaFinanceProtocols(), llamaFinanceWeekly()]);
  const rwa = await earnRwaShare();
  const [bs, cap, hold, stables, stablesNow] = await Promise.all([bsChain(), capitalOnChain(), holders(), stableSupply(), stableSupplyLatest()]);
  const stableTotal = stablesNow.filter((r) => r.kind === "stablecoin").reduce((a, r) => a + Number(r.supply), 0);
  const ybTotal = stablesNow.filter((r) => r.kind === "yield-bearing").reduce((a, r) => a + Number(r.supply), 0);
  const bsl = last(bs);
  const cl = last(cap);
  const holderOf = (t: string) => Number(hold.find((r) => r.token === t)?.holders ?? 0);
  const rwaCredit = rwa.filter((r) => ["syrupUSDG", "mGLO"].includes(String(r.collateral))).reduce((a, r) => a + Number(r.share), 0);
  const sh = last(share);
  const al = last(alloc);
  const sg = last(stableGlobal);
  const sgYearAgo = stableGlobal.find((r) => String(r.day) >= String(Number(String(sg?.day).slice(0, 4)) - 1) + String(sg?.day).slice(4));
  const lastDay = last(bs)?.day;
  const lastWk = last(buckets)?.week;
  const spec = buckets.find((r) => r.week === lastWk && r.bucket === "speculation");
  const fin = buckets.find((r) => r.week === lastWk && r.bucket === "finance");


  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <header className="space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Research dashboard · data as of {String(lastDay).slice(0, 10)}</div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Macro: stablecoins, Robinhood Chain, Robinhood Earn</h1>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">Self-hosted. Read from Ethereum and Robinhood Chain RPC; DeFiLlama where marked.</p>
      </header>

      <Section n="01" tone="rh" title="Stablecoins" lede="Onchain credit scales with the dollars onchain. Global supply is the model's top-line driver (DeFiLlama, all chains, USD-pegged); Robinhood Chain supply is read from each token's totalSupply().">
        <Counters cols="md:grid-cols-3">
          <Counter label="Global stablecoin supply" value={fmtUsd(Number(sg?.supply_usd ?? 0))} sub={sgYearAgo ? `+${fmtPct(Number(sg?.supply_usd) / Number(sgYearAgo.supply_usd) - 1)} year on year · DeFiLlama` : "DeFiLlama"} />
          <Counter label="Stablecoins on Robinhood Chain" value={fmtUsd(stableTotal)} sub={`${fmtPct(stableTotal / Number(sg?.supply_usd || 1))} of global · ${stablesNow.filter((r) => r.kind === "stablecoin").map((r) => `${r.token} ${fmtUsd(Number(r.supply))}`).join(" · ")}`} />
          <Counter label="Yield-bearing on Robinhood Chain" value={fmtUsd(ybTotal)} sub="syrupUSDG, mGLO" />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Global stablecoin supply" sub="weekly · DeFiLlama"><SimpleArea data={stableGlobal} x="day" y="supply_usd" /></Card>
          <Card title="Stablecoin supply on Robinhood Chain" sub="totalSupply, daily"><StackedColumns data={stables} x="day" y="supply" group="token" /></Card>
        </div>
      </Section>

      <Section n="02" tone="rh" title="Robinhood Chain" lede="Activity, fees and bridged capital are read from the chain (Blockscout stats, L1 bridge and sequencer-inbox contracts on Ethereum, ETH price). DeFiLlama is used only where marked: protocol-level TVL and app-fee categories.">
        <Counters cols="md:grid-cols-4">
          <Counter label="Capital on chain" value={fmtUsd(Number(cl?.capital_onchain_usd ?? 0))} sub={`${fmtUsd(Number(cl?.eth_bridged_usd ?? 0))} ETH bridged · ${fmtUsd(Number(cl?.usdg_native ?? 0))} USDG minted`} />
          <Counter label="DeFi TVL (DeFiLlama)" value={fmtUsd(Number(cl?.llama_tvl_usd ?? 0))} sub="protocol-sum, different definition" />
          <Counter label="Transactions / day" value={Number(bsl?.txns ?? 0).toLocaleString()} sub={`${Number(bsl?.active_accounts ?? 0).toLocaleString()} active accounts · ${Number(bsl?.new_accounts ?? 0).toLocaleString()} new`} />
          <Counter label="Sequencer fees / day" value={fmtUsd(Number(bsl?.fees_usd ?? 0))} sub={bsl?.l1_cost_usd != null ? `L1 cost ${fmtUsd(Number(bsl.l1_cost_usd))} · margin ${fmtUsd(Number(bsl.sequencer_margin_usd))}` : `${Number(bsl?.fees_eth ?? 0).toFixed(1)} ETH`} />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Capital on Robinhood Chain" sub="onchain: USDG minted + ETH bridged from Ethereum"><StackedAreas data={cap} x="day" ys={["usdg_native", "eth_bridged_usd"]} /></Card>
          <Card tone="maple" title="Maple share of capital on chain" sub="syrupUSDG on Robinhood Chain ÷ onchain capital · from when capital passed $50M"><SimpleLine data={cap.filter((r) => Number(r.capital_onchain_usd) >= 50e6)} x="day" ys={["maple_share_of_capital"]} /></Card>
          <Card title="Transactions per day"><SimpleArea data={bs} x="day" y="txns" fmt="raw" /></Card>
          <Card title="Accounts per day" sub="active, and new among them · Aug 11–12 spike is a one-off wave of new accounts"><SimpleLine data={bs} x="day" ys={["active_accounts", "new_accounts"]} fmt="raw" /></Card>
          <Card title="Gas fees per day" sub="paid to the sequencer, USD · early-September spike is real (1,400–3,300 ETH/day)"><SimpleArea data={bs} x="day" y="fees_usd" /></Card>
          <Card title="New smart wallets per day" sub="ERC-4337"><SimpleArea data={bs} x="day" y="new_aa_wallets" fmt="raw" /></Card>
          <Card title="Fee share: speculation vs finance" sub="weekly · DeFiLlama"><StackedArea data={buckets} x="week" y="share" group="bucket" fmt="pct" /></Card>
          <Card title="Fees: speculation vs finance" sub="weekly, USD · DeFiLlama"><StackedColumns data={buckets} x="week" y="fees_usd" group="bucket" /></Card>
        </div>
        <Note>Buckets by DeFiLlama category. <span className="text-ink-2">Speculation</span> = DEXs, aggregators, perps, prediction markets, launchpads, meme, Telegram bots, gamified mining, NFT marketplaces. <span className="text-ink-2">Finance</span> = lending, risk curators, RWA, yield, capital allocators, payments. <span className="text-ink-2">Other</span> (grey, ~1%) = bridges, wallets, interfaces, AI agents, indexes.</Note>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Lending / Earn protocol fees" sub="weekly · DeFiLlama"><StackedColumns data={finw} x="week" y="fees_usd" group="protocol" /></Card>
          <Panel title="Lending / Earn protocols by fees" sub="last 7 days · DeFiLlama">
            <Table rows={finp} cols={[
              { key: "protocol", title: "protocol" }, { key: "category", title: "category" },
              { key: "fees_7d", title: "fees 7d", fmt: "usd" }, { key: "revenue_7d", title: "revenue 7d", fmt: "usd" }, { key: "fee_share", title: "share", fmt: "pct" },
            ]} />
          </Panel>
        </div>
      </Section>

      <Section n="03" tone="rh" title="Robinhood Earn: the distribution channel" lede="Steakhouse USDG vault (steakUSDG) on Robinhood Chain, the contract behind Robinhood Earn. Users = distinct share owners.">
        <Track tag="Earn" title="Where Maple sits" note="syrupUSDG is collateral Earn lends against" accent
          flow={["Earn deposits (USDG)", "Steakhouse USDG vault", "Morpho markets: USDe, syrupUSDG, mGLO, spUSDG"]}
          foot={`Earn TVL ${fmtUsd(Number(al?.earn_tvl_usdg ?? 0))} · syrupUSDG is ${fmtPct(Number(sh?.maple_share_of_earn ?? 0))} of it, ${fmtPct(rwaCredit)} sits in RWA credit (Maple + Midas). This is the only place Maple and Robinhood Chain meet.`} />
        <Counters cols="md:grid-cols-4">
          <Counter label="Earn users, all-time" value={Number(sizes?.users ?? 0).toLocaleString()} sub={`${Number(sizes?.deposits ?? 0).toLocaleString()} deposits · ${holderOf("steakUSDG (Earn)").toLocaleString()} current holders (Blockscout)`} />
          <Counter label="Median deposit" value={fmtUsd(Number(sizes?.median_deposit ?? 0))} sub={`avg ${fmtUsd(Number(sizes?.avg_deposit ?? 0))} · p90 ${fmtUsd(Number(sizes?.p90_deposit ?? 0))}`} />
          <Counter label="Active users, last week" value={Number(last(dep)?.active_users ?? 0).toLocaleString()} sub={`${Number(last(dep)?.new_users ?? 0).toLocaleString()} new`} />
          <Counter label="Net flow, last week" value={fmtUsd(Number(last(dep)?.net_flow_usd ?? 0))} tone={Number(last(dep)?.net_flow_usd ?? 0) >= 0 ? "up" : "down"} />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Earn users per week" sub="active, and new among them"><SimpleLine data={dep} x="week" ys={["active_users", "new_users"]} fmt="raw" /></Card>
          <Card title="Earn deposits vs net flow" sub="weekly"><BarsAndLine data={dep} x="week" bar="deposited_usd" line="net_flow_usd" /></Card>
          <Card title="syrupUSDG bridged to / from Robinhood Chain" sub="weekly"><StackedBars data={bridge} x="week" ys={["bridged_in", "bridged_out"]} /></Card>
          <Card title="Cumulative Earn users"><SimpleArea data={dep} x="week" y="cumulative_users" fmt="raw" /></Card>
          <Card wide title="Robinhood Earn allocation by collateral" sub="today · Maple's syrupUSDG highlighted"><CategoryBars data={rwa.filter((r) => Number(r.allocated_usdg) > 0)} x="collateral" y="allocated_usdg" highlight={["syrupUSDG"]} /></Card>
        </div>
      </Section>

      <Note>Maple Finance, syrupUSDG and SYRUP live on the <Link href="/maple" className="text-ink-2 underline underline-offset-2 hover:text-ink">Maple Finance + SYRUP</Link> page.</Note>
    </main>
  );
}

function Track({ tag, title, note, flow, foot, accent }: { tag: string; title: string; note: string; flow: string[]; foot: string; accent?: boolean }) {
  return (
    <div className={`rounded-[3px] border bg-surface p-4 ${accent ? "border-rh-ink" : "border-line"}`}>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-[10.5px] uppercase tracking-wider ${accent ? "text-rh-ink" : "text-muted"}`}>{tag}</span>
        <span className="text-[13px] font-medium text-ink">{title}</span>
        <span className="text-[11.5px] text-muted">· {note}</span>
      </div>
      <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
        {flow.map((f, i) => (
          <li key={f} className="flex items-center gap-1.5">
            {i > 0 && <span className="font-mono text-muted">→</span>}
            <span className="rounded-[3px] border border-line bg-wash px-2 py-1 text-ink">{f}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11.5px] leading-relaxed text-muted">{foot}</p>
    </div>
  );
}
