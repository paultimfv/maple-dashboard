import { earnAllocation, earnDepositors, earnDepositSizes, earnRwaShare, holders } from "@/lib/queries";
import { Counter, Counters, Card, Section, Note, SimpleArea, SimpleLine, StackedBars, StackedColumns, BarsAndLine, CategoryBars } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";
import { Exhibit } from "@/components/exhibit";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];

export default async function EarnPage() {
  const [alloc, dep, sizes, rwa, hold] = await Promise.all([earnAllocation(), earnDepositors(), earnDepositSizes(), earnRwaShare(), holders()]);
  const holderOf = (t: string) => Number(hold.find((r) => r.token === t)?.holders ?? 0);
  const al = last(alloc);
  const lastDay = last(alloc)?.day;

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <header className="space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Research dashboard · data as of {String(lastDay ?? "").slice(0, 10)}</div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Robinhood Earn</h1>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">Robinhood&apos;s onchain lending product: a normal app in front, a Steakhouse-curated Morpho vault underneath. Users, flows, and who borrows against what, read from Robinhood Chain.</p>
      </header>

      <Section n="01" tone="rh" title="Robinhood Earn: the distribution channel" lede="Steakhouse USDG vault (steakUSDG) on Robinhood Chain, the contract behind Robinhood Earn. Users = distinct share owners.">
        <div className="grid gap-4">
        <Exhibit id="d1" n={1} title="How Robinhood Earn works under the hood" lede="A Web2 front end on DeFi rails: the user taps Earn; their USDG sits in a self-custodial wallet and is lent through a Morpho vault curated by Steakhouse." source="Robinhood Earn support article; onchain, Robinhood Chain" />
        </div>
        <Track tag="Earn" title="Where the dollars go" note="users supply USDG; borrowers post collateral" accent
          flow={["Earn deposits (USDG)", "Steakhouse USDG vault", "Morpho markets: USDe, syrupUSDG, mGLO, spUSDG"]}
          foot={`Earn TVL ${fmtUsd(Number(al?.earn_tvl_usdg ?? 0))} · collateral today: ${rwa.map((r) => `${r.collateral} ${fmtPct(Number(r.share))}`).join(" · ")}. Who gets paid, and which of them have a token: see the Who gets paid tab.`} />
        <Counters cols="md:grid-cols-4">
          <Counter label="Earn users, all-time" value={Number(sizes?.users ?? 0).toLocaleString()} sub={`${Number(sizes?.deposits ?? 0).toLocaleString()} deposits · ${holderOf("steakUSDG (Earn)").toLocaleString()} current holders (Blockscout)`} />
          <Counter label="Median deposit" value={fmtUsd(Number(sizes?.median_deposit ?? 0))} sub={`avg ${fmtUsd(Number(sizes?.avg_deposit ?? 0))} · p90 ${fmtUsd(Number(sizes?.p90_deposit ?? 0))}`} />
          <Counter label="Active users, last week" value={Number(last(dep)?.active_users ?? 0).toLocaleString()} sub={`${Number(last(dep)?.new_users ?? 0).toLocaleString()} new`} />
          <Counter label="Net flow, last week" value={fmtUsd(Number(last(dep)?.net_flow_usd ?? 0))} tone={Number(last(dep)?.net_flow_usd ?? 0) >= 0 ? "up" : "down"} />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Earn users per week" sub="active, and new among them"><SimpleLine data={dep} x="week" ys={["active_users", "new_users"]} fmt="raw" /></Card>
          <Card title="Earn deposits vs net flow" sub="weekly"><BarsAndLine data={dep} x="week" bar="deposited_usd" line="net_flow_usd" /></Card>
          <Card title="Cumulative Earn users"><SimpleArea data={dep} x="week" y="cumulative_users" fmt="raw" /></Card>
          <Card wide tone="maple" title="Robinhood Earn allocation by collateral" sub="USDG lent against each collateral today"><CategoryBars data={rwa.filter((r) => Number(r.share) >= 0.001)} x="collateral" y="allocated_usdg" /></Card>
        </div>
      </Section>

      <Section n="02" tone="rh" title="The collateral: what borrowers post" lede="Earn users supply USDG. Borrowers post a yield-bearing token as collateral and borrow it. The collateral mix decides which issuers grow with Earn.">
        <Counters cols="md:grid-cols-4">
          {rwa.filter((r) => Number(r.share) >= 0.001).slice(0, 4).map((r) => (
            <Counter key={String(r.collateral)} label={`${r.collateral} share of Earn`} value={fmtPct(Number(r.share))} sub={`${fmtUsd(Number(r.allocated_usdg))} of USDG lent against it`} />
          ))}
        </Counters>
        <Card wide tone="maple" title="Robinhood Earn TVL by collateral" sub="daily, onchain"><StackedColumns data={alloc} x="day" y="allocated_usdg" group="collateral" /></Card>
        <Note>Who these collateral issuers are, how Earn pays them, and their token data: the Who gets paid tab.</Note>
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
