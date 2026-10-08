import { earnAllocation, earnShare, earnDepositors, earnDepositSizes, bridgeFlow, stablecoinSupplyGlobal, llamaFeesByBucket, llamaFinanceProtocols, llamaFinanceWeekly, stockTokens, stockTokensWeekly, stockCredit, stockCreditWeekly, earnRwaShare, bsChain, capitalOnChain, holders, stableSupply, stableSupplyLatest } from "@/lib/queries";
import { Counter, Card, StackedArea, StackedColumns, SimpleArea, SimpleLine, StackedBars, BarsAndLine, Table } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];

export default async function Page() {
  const [alloc, share, dep, sizes, bridge, stableGlobal] = await Promise.all([
    earnAllocation(), earnShare(), earnDepositors(), earnDepositSizes(), bridgeFlow(), stablecoinSupplyGlobal(),
  ]);
  const [buckets, finp, finw] = await Promise.all([llamaFeesByBucket(), llamaFinanceProtocols(), llamaFinanceWeekly()]);
  const [stocks, stocksW, scredit, screditW, rwa] = await Promise.all([stockTokens(), stockTokensWeekly(), stockCredit(), stockCreditWeekly(), earnRwaShare()]);
  const [bs, cap, hold, stables, stablesNow] = await Promise.all([bsChain(), capitalOnChain(), holders(), stableSupply(), stableSupplyLatest()]);
  const stableTotal = stablesNow.filter((r) => r.kind === "stablecoin").reduce((a, r) => a + Number(r.supply), 0);
  const ybTotal = stablesNow.filter((r) => r.kind === "yield-bearing").reduce((a, r) => a + Number(r.supply), 0);
  const bsl = last(bs);
  const cl = last(cap);
  const holderOf = (t: string) => Number(hold.find((r) => r.token === t)?.holders ?? 0);
  const stockHolders = hold.filter((r) => String(r.token).startsWith("stock:")).reduce((a, r) => a + Number(r.holders), 0);
  const holdersByAddr = new Map(hold.map((r) => [String(r.address).toLowerCase(), Number(r.holders)]));
  const stockBorrowed = scredit.reduce((a, r) => a + Number(r.net_borrowed_usdg ?? 0), 0);
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
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Macro: stablecoins, Robinhood Chain, tokenization</h1>
        <p className="text-sm text-muted">Self-hosted · data as of {String(lastDay).slice(0, 10)} · source: Ethereum + Robinhood Chain RPC; DeFiLlama where marked</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Stablecoins</h2>
        <p className="text-xs text-muted">Onchain credit scales with the dollars onchain. Global supply is the model&apos;s top-line driver (DeFiLlama, all chains, USD-pegged); Robinhood Chain supply is read from each token&apos;s totalSupply().</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Counter label="Global stablecoin supply (DeFiLlama)" value={fmtUsd(Number(sg?.supply_usd ?? 0))} sub={sgYearAgo ? `+${fmtPct(Number(sg?.supply_usd) / Number(sgYearAgo.supply_usd) - 1)} year on year` : undefined} />
          <Counter label="Stablecoins on Robinhood Chain" value={fmtUsd(stableTotal)} sub={`${fmtPct(stableTotal / Number(sg?.supply_usd || 1))} of global · ${stablesNow.filter((r) => r.kind === "stablecoin").map((r) => `${r.token} ${fmtUsd(Number(r.supply))}`).join(" · ")}`} />
          <Counter label="Yield-bearing on Robinhood Chain" value={fmtUsd(ybTotal)} sub="syrupUSDG, mGLO" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Global stablecoin supply, weekly (DeFiLlama)"><SimpleArea data={stableGlobal} x="day" y="supply_usd" /></Card>
          <Card title="Stablecoin supply on Robinhood Chain (totalSupply, daily)"><StackedColumns data={stables} x="day" y="supply" group="token" /></Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Robinhood Chain</h2>
        <p className="text-xs text-muted">Activity, fees and bridged capital are read from the chain (Blockscout stats, L1 bridge and sequencer-inbox contracts on Ethereum, ETH price). DeFiLlama is used only where marked: protocol-level TVL and app-fee categories.</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="Capital on chain (onchain)" value={fmtUsd(Number(cl?.capital_onchain_usd ?? 0))} sub={`${fmtUsd(Number(cl?.eth_bridged_usd ?? 0))} ETH bridged · ${fmtUsd(Number(cl?.usdg_native ?? 0))} USDG minted`} />
          <Counter label="DeFi TVL (DeFiLlama)" value={fmtUsd(Number(cl?.llama_tvl_usd ?? 0))} sub="protocol-sum, different definition" />
          <Counter label="Transactions / day" value={Number(bsl?.txns ?? 0).toLocaleString()} sub={`${Number(bsl?.active_accounts ?? 0).toLocaleString()} active accounts · ${Number(bsl?.new_accounts ?? 0).toLocaleString()} new`} />
          <Counter label="Sequencer fees / day" value={fmtUsd(Number(bsl?.fees_usd ?? 0))} sub={bsl?.l1_cost_usd != null ? `L1 cost ${fmtUsd(Number(bsl.l1_cost_usd))} · margin ${fmtUsd(Number(bsl.sequencer_margin_usd))}` : `${Number(bsl?.fees_eth ?? 0).toFixed(1)} ETH`} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Capital on Robinhood Chain: onchain vs DeFiLlama"><SimpleLine data={cap} x="day" ys={["capital_onchain_usd", "eth_bridged_usd", "llama_tvl_usd"]} fmt="usd" /></Card>
          <Card title="Maple share of capital on chain (onchain) vs of DeFi TVL (DeFiLlama)"><SimpleLine data={cap} x="day" ys={["maple_share_of_capital", "maple_share_of_llama_tvl"]} /></Card>
          <Card title="Transactions per day"><SimpleArea data={bs} x="day" y="txns" fmt="raw" /></Card>
          <Card title="Accounts per day: active vs new"><StackedBars data={bs} x="day" ys={["new_accounts", "active_accounts"]} fmt="raw" /></Card>
          <Card title="Sequencer fees per day (USD): L1 cost vs margin — Robinhood&apos;s take"><StackedBars data={bs} x="day" ys={["l1_cost_usd", "sequencer_margin_usd"]} /></Card>
          <Card title="New smart wallets (ERC-4337) per day"><SimpleArea data={bs} x="day" y="new_aa_wallets" fmt="raw" /></Card>
          <Card title="Fee share: speculation vs finance, weekly (DeFiLlama)"><StackedArea data={buckets} x="week" y="share" group="bucket" fmt="pct" /></Card>
          <Card title="Fees: speculation vs finance, weekly, USD (DeFiLlama)"><StackedColumns data={buckets} x="week" y="fees_usd" group="bucket" /></Card>
          <p className="text-xs text-muted md:col-span-2">Buckets by DeFiLlama category. <span className="text-ink-2">Speculation</span> = DEXs, aggregators, perps, prediction markets, launchpads, meme, Telegram bots, gamified mining, NFT marketplaces. <span className="text-ink-2">Finance</span> = lending, risk curators, RWA, yield, capital allocators, payments. <span className="text-ink-2">Other</span> (grey, ~1%) = bridges, wallets, interfaces, AI agents, indexes.</p>
          <Card title="Lending / Earn protocol fees, weekly (DeFiLlama)"><StackedColumns data={finw} x="week" y="fees_usd" group="protocol" /></Card>
        </div>
        <div className="rounded-[3px] border border-line bg-surface p-4">
          <div className="mb-3 text-sm font-medium text-ink-2">Lending / Earn protocols by fees, last 7 days (DeFiLlama)</div>
          <Table rows={finp} cols={[
            { key: "protocol", title: "protocol" }, { key: "category", title: "category" },
            { key: "fees_7d", title: "fees 7d", fmt: "usd" }, { key: "revenue_7d", title: "revenue 7d", fmt: "usd" }, { key: "fee_share", title: "share", fmt: "pct" },
          ]} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Tokenization &amp; where the credit actually sits</h2>
        <p className="text-xs text-muted">Two separate things run on the same Morpho Blue rails on Robinhood Chain. They don&apos;t touch each other today.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[3px] border border-line bg-surface p-4 text-sm">
            <div className="mb-2 text-xs uppercase tracking-wide text-ink-2">Track 1 — stock tokens (no Maple exposure)</div>
            <div className="text-ink">Robinhood stock tokens (&quot;X • Robinhood Token&quot;) → Morpho markets with a stock token as collateral → USDG borrowed</div>
            <div className="mt-2 text-xs text-muted">{stocks.length} tokens live · {scredit.reduce((a, r) => a + Number(r.markets ?? 0), 0)} markets · only {fmtUsd(stockBorrowed)} borrowed. Nobody lends against tokenized stocks at scale yet, and syrupUSDG is not involved.</div>
          </div>
          <div className="rounded-[3px] border border-line bg-surface p-4 text-sm">
            <div className="mb-2 text-xs uppercase tracking-wide text-ink-2">Track 2 — Robinhood Earn (where Maple sits)</div>
            <div className="text-ink">Earn deposits (USDG) → Steakhouse USDG vault → Morpho markets whose collateral is a yield / credit token: USDe, <span className="text-ink">syrupUSDG</span>, mGLO, spUSDG</div>
            <div className="mt-2 text-xs text-muted">Earn TVL {fmtUsd(Number(al?.earn_tvl_usdg ?? 0))} · syrupUSDG is {fmtPct(Number(sh?.maple_share_of_earn ?? 0))} of it. This is the only place Maple and Robinhood Chain meet: syrupUSDG is collateral that Earn lends USDG against, not a tokenized stock and not a stock-collateral lender.</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="Stock tokens live" value={stocks.length.toLocaleString()} sub={`${stockHolders.toLocaleString()} holders across ${hold.filter((r) => String(r.token).startsWith("stock:")).length} tokens (Blockscout)`} />
          <Counter label="Shares outstanding (all tokens)" value={Number(last(stocksW)?.cumulative_shares ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
          <Counter label="USDG borrowed vs tokenized stocks" value={fmtUsd(stockBorrowed)} sub={`${scredit.reduce((a, r) => a + Number(r.borrowers ?? 0), 0)} borrowers · ${scredit.reduce((a, r) => a + Number(r.markets ?? 0), 0)} markets`} />
          <Counter label="Earn allocated to RWA credit (Maple + Midas)" value={fmtPct(rwaCredit)} sub={rwa.map((r) => `${r.collateral} ${fmtPct(Number(r.share))}`).join(" · ")} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Stock token shares minted vs burned, weekly"><StackedBars data={stocksW} x="week" ys={["minted", "burned"]} fmt="raw" /></Card>
          <Card title="Cumulative stock token shares outstanding"><SimpleArea data={stocksW} x="week" y="cumulative_shares" fmt="raw" /></Card>
          <Card title="USDG borrowed on Morpho, by collateral type (outstanding, weekly)"><StackedColumns data={screditW} x="week" y="borrowed_outstanding_usdg" group="bucket" /></Card>
          <Card title="Robinhood Earn allocation by collateral (today)"><StackedBars data={rwa} x="collateral" ys={["allocated_usdg"]} /></Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[3px] border border-line bg-surface p-4">
            <div className="mb-3 text-sm font-medium text-ink-2">Largest stock tokens by shares outstanding</div>
            <Table rows={stocks.slice(0, 15).map((r) => ({ ...r, holders: holdersByAddr.get(String(r.address ?? "").toLowerCase()) ?? null }))} cols={[{ key: "symbol", title: "ticker" }, { key: "shares_outstanding", title: "shares", fmt: "raw" }, { key: "holders", title: "holders", fmt: "raw" }, { key: "minted", title: "minted", fmt: "raw" }, { key: "burned", title: "burned", fmt: "raw" }, { key: "first_mint", title: "first mint" }]} />
          </div>
          <div className="rounded-[3px] border border-line bg-surface p-4">
            <div className="mb-3 text-sm font-medium text-ink-2">USDG borrowed against tokenized stocks, by collateral</div>
            <Table rows={scredit} cols={[{ key: "collateral", title: "collateral" }, { key: "net_borrowed_usdg", title: "outstanding", fmt: "usd" }, { key: "gross_borrowed_usdg", title: "gross borrowed", fmt: "usd" }, { key: "borrowers", title: "borrowers", fmt: "raw" }, { key: "markets", title: "markets", fmt: "raw" }]} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Robinhood Earn: the distribution channel</h2>
        <p className="text-xs text-muted">Steakhouse USDG vault (steakUSDG) on Robinhood Chain — the contract behind Robinhood Earn. Users = distinct share owners.</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Counter label="Earn users (all-time)" value={Number(sizes?.users ?? 0).toLocaleString()} sub={`${Number(sizes?.deposits ?? 0).toLocaleString()} deposits · ${holderOf("steakUSDG (Earn)").toLocaleString()} current holders (Blockscout)`} />
          <Counter label="Median deposit" value={fmtUsd(Number(sizes?.median_deposit ?? 0))} sub={`avg ${fmtUsd(Number(sizes?.avg_deposit ?? 0))} · p90 ${fmtUsd(Number(sizes?.p90_deposit ?? 0))}`} />
          <Counter label="Active users, last week" value={Number(last(dep)?.active_users ?? 0).toLocaleString()} sub={`${Number(last(dep)?.new_users ?? 0).toLocaleString()} new`} />
          <Counter label="Net flow, last week" value={fmtUsd(Number(last(dep)?.net_flow_usd ?? 0))} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Earn users per week (active vs new)"><StackedBars data={dep} x="week" ys={["new_users", "active_users"]} fmt="raw" /></Card>
          <Card title="Earn deposits vs net flow, weekly"><BarsAndLine data={dep} x="week" bar="deposited_usd" line="net_flow_usd" /></Card>
          <Card title="syrupUSDG bridged to / from Robinhood Chain, weekly"><StackedBars data={bridge} x="week" ys={["bridged_in", "bridged_out"]} /></Card>
          <Card title="Cumulative Earn users"><SimpleArea data={dep} x="week" y="cumulative_users" fmt="raw" /></Card>
        </div>
      </section>

      <p className="text-xs text-muted">Maple Finance, syrupUSDG and SYRUP live on the <a href="/maple" className="underline">Maple Finance + SYRUP</a> page.</p>
    </main>
  );
}
