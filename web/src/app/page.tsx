import { syrupPrice, syrupBuybacks, mapleModelMonthly, mapleAumReported, mapleRevenueMonthly, utilization, earnShare, stablecoinSupplyGlobal } from "@/lib/queries";
import { Explorer, type Metric } from "@/components/explorer";
import { Diagrams } from "@/components/exhibit";
import { Mini } from "@/components/mini";
import { fmtUsd, fmtPct } from "@/lib/fmt";
import { modelLedger } from "@/lib/model-export";

export const dynamic = "force-dynamic";

type R = Record<string, unknown>;
const last = <T,>(a: T[]) => a[a.length - 1];
const n = (v: unknown) => Number(v ?? 0);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** change on the value a year before the latest one */
const yearAgo = (rows: R[], xk: string, k: string) => {
  const lr = [...rows].reverse().find((x) => x[k] != null); if (!lr) return NaN;
  const cut = new Date(new Date(String(lr[xk]).slice(0, 10)).getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const old = [...rows].reverse().find((x) => String(x[xk]).slice(0, 10) <= cut && x[k] != null);
  return old && n(old[k]) ? n(lr[k]) / n(old[k]) - 1 : NaN;
};

/** The front page: the numbers most people come for, and a way into every tab. */
export default async function Home() {
  const [syrup, buybacks, model, aumRep, ledger, rev, util, share, stable] = await Promise.all([
    syrupPrice(), syrupBuybacks(), mapleModelMonthly(), mapleAumReported(), modelLedger(), mapleRevenueMonthly(), utilization(), earnShare(), stablecoinSupplyGlobal(),
  ]);
  const sp = last(syrup), ar = last(aumRep), r = last(rev), u = last(util), sh = last(share), sg = last(stable), bb = last(buybacks);
  const ttm = [...model].reverse().find((x) => x.ttm_revenue != null);
  const loans = ledger.filter((x) => x.loans_total != null && String(x.month) >= "2024-01-01");
  const lg = last(loans);
  const bbTotal = buybacks.reduce((s, x) => s + n(x.amount_usd), 0);
  let run = 0;
  const bbCum = buybacks.map((x) => ({ month: x.month, total: (run += n(x.amount_usd)) }));
  const psRows = model.filter((x) => x.ps_ttm != null);
  const day = String(sp?.day ?? "").slice(0, 10);
  const asOf = day ? `${Number(day.slice(8, 10))} ${MON[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}` : "";
  const monY = (d: unknown) => `${MON[Number(String(d).slice(5, 7)) - 1] ?? ""} ${String(d).slice(0, 4)}`;

  const glance: Metric[] = [
    { id: "price", label: "SYRUP price", value: `$${n(sp?.price_usd).toFixed(3)}`, change: yearAgo(syrup, "day", "price_usd"),
      note: "Daily, from CoinGecko.", chart: { kind: "line", data: syrup, x: "day", ys: ["price_usd"], fmt: "rate", peak: true } },
    { id: "mcap", label: "SYRUP market cap", value: fmtUsd(n(sp?.mcap_usd)), change: yearAgo(syrup, "day", "mcap_usd"),
      note: "Price × circulating supply.", chart: { kind: "line", data: syrup, x: "day", ys: ["mcap_usd"], fmt: "usd" } },
    { id: "revenue", label: "Revenue, last 12 months", value: fmtUsd(n(ttm?.ttm_revenue)), change: yearAgo(model, "month", "ttm_revenue"),
      note: "All fees Maple earned over the trailing twelve months.", chart: { kind: "line", data: model.filter((x) => x.ttm_revenue != null), x: "month", ys: ["ttm_revenue"], fmt: "usd" } },
    { id: "aum", label: "Assets under management", value: fmtUsd(n(ar?.aum_usd)), change: yearAgo(aumRep, "day", "aum_usd"),
      note: "Lender deposits plus borrower collateral, as Maple reports it.", chart: { kind: "line", data: aumRep, x: "day", ys: ["aum_usd"], fmt: "usd" } },
    { id: "loans", label: "Loans outstanding", value: fmtUsd(n(lg?.loans_total)), change: yearAgo(loans, "month", "loans_total"),
      note: "Money lent out across every Maple pool, at each month-end.", chart: { kind: "line", data: loans, x: "month", ys: ["loans_total"], fmt: "usd" } },
    { id: "bought", label: "SYRUP bought back, all time", value: fmtUsd(bbTotal),
      note: "Running total of monthly buybacks under MIP-021.", chart: { kind: "line", data: bbCum, x: "month", ys: ["total"], fmt: "usd" } },
  ];

  return (
    <div className="page page-solo">
      <main className="page-main">
        <section className="blk">
          <header className="hero">
            <h1 className="hero-t">Maple Finance</h1>
            <p className="hero-s"><span className="live">Data to <b>{asOf}</b></span><span>Ethereum, Robinhood Chain, Maple, CoinGecko</span><span>Updated daily</span></p>
          </header>
          <Explorer label="Highlights" metrics={glance} />
        </section>

        <section className="blk">
          <h2 className="blk-t">Across the site</h2>
          <div className="minis">
            <Mini href="/metrics#by-month" where="Key business metrics" label={`Revenue, ${monY(r?.month)}`} value={fmtUsd(n(r?.total_revenue))} data={rev} x="month" y="total_revenue" kind="bars" />
            <Mini href="/syrup#buybacks" where="SYRUP" label={`Buybacks, ${monY(bb?.month)}`} value={fmtUsd(n(bb?.amount_usd))} data={buybacks} x="month" y="amount_usd" kind="bars" />
            <Mini href="/syrup#ps" where="SYRUP" label="Price to sales" value={`${n(last(psRows)?.ps_ttm).toFixed(1)}×`} data={psRows} x="month" y="ps_ttm" />
            <Mini href="/metrics#utilization" where="Key business metrics" label="syrupUSDG lent out" value={fmtPct(n(u?.utilization))} data={util} x="day" y="utilization" />
            <Mini href="/metrics#earn-share" where="Key business metrics" tone="rh" label="syrupUSDG share of Robinhood Earn" value={fmtPct(n(sh?.maple_share_of_earn))} data={share} x="day" y="maple_share_of_earn" />
            <Mini href="/macro#stablecoins" where="Growth drivers" label="Stablecoins, all chains" value={fmtUsd(n(sg?.supply_usd))} change={yearAgo(stable, "day", "supply_usd")} data={stable} x="day" y="supply_usd" />
          </div>
        </section>

        <section className="blk">
          <h2 className="blk-t">How revenue reaches SYRUP</h2>
          <Diagrams figs={[{ id: "d6", title: "Revenue to buybacks", source: "maple.finance/transparency; onchain fees and buyback wallet (Ethereum)" }]} />
        </section>
      </main>
    </div>
  );
}
