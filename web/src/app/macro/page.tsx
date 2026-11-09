import { stablecoinSupplyGlobal, earnAllocation, earnShare } from "@/lib/queries";
import { Explorer, type Metric } from "@/components/explorer";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];
const n = (v: unknown) => Number(v ?? 0);

/** The two things outside Maple that the SYRUP model grows it with. */
export default async function DriversPage() {
  const [stable, alloc, share] = await Promise.all([stablecoinSupplyGlobal(), earnAllocation(), earnShare()]);
  const sg = last(stable), al = last(alloc), sh = last(share);
  const cut = `${Number(String(sg?.day).slice(0, 4)) - 1}${String(sg?.day).slice(4, 10)}`;
  const sgAgo = stable.find((r) => String(r.day).slice(0, 10) >= cut);

  const metrics: Metric[] = [
    { id: "stablecoins", label: "Stablecoins, all chains", value: fmtUsd(n(sg?.supply_usd)), change: sgAgo ? n(sg?.supply_usd) / n(sgAgo.supply_usd) - 1 : undefined,
      note: "Total supply of dollar stablecoins, weekly, from DeFiLlama. Maple's deposits grow with it.", chart: { kind: "line", data: stable, x: "day", ys: ["supply_usd"], fmt: "usd" } },
    { id: "earn", label: "Robinhood Earn", value: fmtUsd(n(al?.earn_tvl_usdg)), tone: "rh",
      note: "USDG in Robinhood Earn, by the collateral it is lent against.", chart: { kind: "columns", data: alloc, x: "day", y: "allocated_usdg", group: "collateral" } },
    { id: "earn-share", label: "syrupUSDG share of Earn", value: fmtPct(n(sh?.maple_share_of_earn)), tone: "rh",
      note: "USDG lent against syrupUSDG ÷ all of Robinhood Earn.", chart: { kind: "line", data: share, x: "day", ys: ["maple_share_of_earn"] } },
  ];

  return (
    <div className="page page-solo">
      <main className="page-main">
        <section className="blk">
          <header className="hero">
            <h1 className="hero-t">Growth drivers</h1>
            <p className="hero-l">The SYRUP model grows Maple with two things: the stablecoin market it lends into, and Robinhood Earn. </p>
            <p className="hero-s"><span className="live">Data to <b>{String(sg?.day ?? "").slice(0, 10)}</b></span><span>DeFiLlama, Robinhood Chain</span><span>Updated daily</span></p>
          </header>
          <Explorer label="Growth drivers" metrics={metrics} aside={
          <dl className="facts">
            <div><dt>Model assumption, stablecoins</dt><dd>$2T in 2028, $3T in 2030</dd></div>
            <div><dt>Where it comes from</dt><dd className="!text-[14px] !font-normal">Bessent, Nov 2025. Change it on the <a className="underline" href="/syrup#model">SYRUP page</a>.</dd></div>
          </dl>} />
        </section>
      </main>
    </div>
  );
}
