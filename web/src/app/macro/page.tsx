import { stablecoinSupplyGlobal, earnAllocation, earnShare } from "@/lib/queries";
import { Counter, Counters, Card, Section, Note, SimpleArea, SimpleLine, StackedColumns } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];

/** The outside drivers the model grows Maple with: the stablecoin market and Robinhood Earn. */
export default async function MacroPage() {
  const [stableGlobal, alloc, share] = await Promise.all([stablecoinSupplyGlobal(), earnAllocation(), earnShare()]);
  const sg = last(stableGlobal);
  const sgYearAgo = stableGlobal.find((r) => String(r.day) >= String(Number(String(sg?.day).slice(0, 4)) - 1) + String(sg?.day).slice(4));
  const al = last(alloc);
  const sh = last(share);
  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <header className="space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Model drivers · data as of {String(sg?.day ?? "").slice(0, 10)}</div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Macro</h1>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">The two outside drivers the SYRUP model grows Maple with: the stablecoin market Maple lends into, and Robinhood Earn as a distribution channel.</p>
      </header>

      <Section n="01" title="Stablecoins: the market Maple lends into" lede="Maple's deposits are dollars onchain, so the model ties core deposits to total stablecoin supply (DeFiLlama, all chains, USD-pegged).">
        <Counters cols="md:grid-cols-2">
          <Counter label="Global stablecoin supply" value={fmtUsd(Number(sg?.supply_usd ?? 0))} sub={sgYearAgo ? `+${fmtPct(Number(sg?.supply_usd) / Number(sgYearAgo.supply_usd) - 1)} year on year · DeFiLlama` : "DeFiLlama"} />
          <Counter label="Model assumption" value="$2T → $3T" sub="2028 → 2030 (Bessent, Nov 2025); adjustable on the model page" />
        </Counters>
        <Card wide title="Global stablecoin supply" sub="weekly · DeFiLlama"><SimpleArea data={stableGlobal} x="day" y="supply_usd" /></Card>
      </Section>

      <Section n="02" tone="rh" title="Robinhood Earn: the distribution channel" lede="Earn users supply USDG; borrowers post syrupUSDG (among others) as collateral. The model grows Earn TVL to a 2030 level and keeps syrupUSDG's share.">
        <Counters cols="md:grid-cols-2">
          <Counter label="Robinhood Earn TVL" value={fmtUsd(Number(al?.earn_tvl_usdg ?? 0))} sub="Steakhouse USDG vault on Robinhood Chain" />
          <Counter label="syrupUSDG share of Earn" value={fmtPct(Number(sh?.maple_share_of_earn ?? 0))} sub="USDG lent against syrupUSDG ÷ Earn TVL" />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card tone="maple" title="Robinhood Earn TVL by collateral"><StackedColumns data={alloc} x="day" y="allocated_usdg" group="collateral" /></Card>
          <Card title="syrupUSDG share of Robinhood Earn"><SimpleLine data={share} x="day" ys={["maple_share_of_earn"]} /></Card>
        </div>
        <Note>Full Robinhood Chain and Earn data: <a href="https://robinhood-earn.vercel.app" className="text-ink-2 underline underline-offset-2 hover:text-ink">Robinhood Chain × Earn dashboard ↗</a></Note>
      </Section>
    </main>
  );
}
