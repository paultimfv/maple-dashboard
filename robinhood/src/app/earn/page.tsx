import { rhAum, earnAllocation, earnShare, earnDepositors, earnDepositSizes, bridgeFlow, earnRwaShare, shareOfUsdg, capitalOnChain, holders, poolState } from "@/lib/queries";
import { Counter, Counters, Card, Section, Note, SimpleArea, SimpleLine, StackedBars, StackedColumns, BarsAndLine, CategoryBars } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];
const n = (v: unknown) => Number(v ?? 0);

export default async function EarnPage() {
  const [alloc, share, dep, sizes, bridge, rwa, hold] = await Promise.all([earnAllocation(), earnShare(), earnDepositors(), earnDepositSizes(), bridgeFlow(), earnRwaShare(), holders()]);
  const [aum, usdg, cap, pool] = await Promise.all([rhAum(), shareOfUsdg(), capitalOnChain(), poolState()]);
  const holderOf = (t: string) => Number(hold.find((r) => r.token === t)?.holders ?? 0);
  const rwaCredit = rwa.filter((r) => ["syrupUSDG", "mGLO"].includes(String(r.collateral))).reduce((a, r) => a + Number(r.share), 0);
  const sh = last(share);
  const al = last(alloc);
  const p = last(pool);
  const ug = last(usdg);
  const cl = last(cap);
  const lastDay = last(aum)?.day;
  const aumRh = aum.filter((x) => x.day === lastDay).reduce((s, x) => s + n(x.aum_usd), 0);

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <header className="space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Research dashboard · data as of {String(lastDay ?? "").slice(0, 10)}</div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Robinhood Earn</h1>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">Robinhood&apos;s onchain lending product: a normal app in front, a Steakhouse-curated Morpho vault underneath. Users, flows, and who borrows against what, read from Robinhood Chain.</p>
      </header>

      <Section n="01" tone="rh" title="Robinhood Earn: the distribution channel" lede="Steakhouse USDG vault (steakUSDG) on Robinhood Chain, the contract behind Robinhood Earn. Users = distinct share owners.">
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
          <Card tone="maple" title="syrupUSDG bridged to / from Robinhood Chain" sub="weekly"><StackedBars data={bridge} x="week" ys={["bridged_in", "bridged_out"]} /></Card>
          <Card title="Cumulative Earn users"><SimpleArea data={dep} x="week" y="cumulative_users" fmt="raw" /></Card>
          <Card wide title="Robinhood Earn allocation by collateral" sub="today · Maple's syrupUSDG highlighted"><CategoryBars data={rwa.filter((r) => Number(r.allocated_usdg) > 0)} x="collateral" y="allocated_usdg" highlight={["syrupUSDG"]} /></Card>
        </div>
      </Section>

      <Section n="02" tone="rh" title="The collateral: what borrowers post" lede="Earn users supply USDG. Borrowers post a yield-bearing token as collateral and borrow it. The collateral mix decides which issuers grow with Earn.">
        <Counters cols="md:grid-cols-3">
          <Counter label="syrupUSDG pool AUM" value={fmtUsd(n(p?.total_assets))} sub={`exch rate ${n(p?.exch_rate || 1).toFixed(4)}`} />
          <Counter label="On Robinhood Chain" value={fmtUsd(aumRh)} sub={`${fmtPct(aumRh / (n(p?.total_assets) || 1))} of pool`} />
          <Counter label="syrupUSDG share of Earn" value={fmtPct(n(sh?.maple_share_of_earn))} />
          <Counter label="Share of USDG on RH Chain" value={fmtPct(n(ug?.maple_share_of_usdg))} sub={`USDG supply ${fmtUsd(n(ug?.usdg_supply))} · ${holderOf("USDG").toLocaleString()} holders`} />
          <Counter label="Share of capital on RH Chain" value={fmtPct(n(cl?.maple_share_of_capital))} sub="onchain: ETH bridged + USDG minted" />
          <Counter label="Robinhood Earn TVL" value={fmtUsd(n(al?.earn_tvl_usdg))} />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card tone="maple" title="Robinhood Earn TVL by collateral"><StackedColumns data={alloc} x="day" y="allocated_usdg" group="collateral" /></Card>
          <Card title="syrupUSDG share of Robinhood Earn"><SimpleLine data={share} x="day" ys={["maple_share_of_earn"]} /></Card>
          <Card tone="maple" title="Maple AUM on Robinhood Chain"><StackedColumns data={aum} x="day" y="aum_usd" group="token" /></Card>
        </div>
        <Note>syrupUSDG (Maple) and USDe (Ethena) are the two largest collaterals. The full Maple picture lives on the Maple Finance dashboard.</Note>
      </Section>
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
