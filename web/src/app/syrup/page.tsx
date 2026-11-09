import { syrupPrice, syrupBuybacks, syrupSupply, ssfDaily, mapleBalanceSheet, mapleModelMonthly, modelInputs } from "@/lib/queries";
import { Panel, Table } from "@/components/charts";
import { Linked, Rail, type Metric } from "@/components/explorer";
import Model from "@/components/model";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const last = <T,>(a: T[]) => a[a.length - 1];
const n = (v: unknown) => Number(v ?? 0);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monY = (d: unknown) => `${MON[Number(String(d).slice(5, 7)) - 1] ?? ""} ${String(d).slice(0, 4)}`;

export default async function SyrupPage() {
  const [syrup, buybacks, supply, ssf, bsheet, model, inp] = await Promise.all([
    syrupPrice(), syrupBuybacks(), syrupSupply(), ssfDaily(), mapleBalanceSheet(), mapleModelMonthly(), modelInputs(),
  ]);
  const sp = last(syrup), sup = last(supply), sf = last(ssf), bal = bsheet[0], m = last(model), bb = last(buybacks);
  const bbTotal = buybacks.reduce((s, x) => s + n(x.amount_usd), 0);
  const ttm = [...model].reverse().find((x) => x.ttm_revenue != null);
  const ps = ttm ? n(sp?.mcap_usd) / n(ttm.ttm_revenue) : 0;
  const ago = (days: number) => {
    const cut = new Date(new Date(String(sp?.day)).getTime() - days * 864e5).toISOString().slice(0, 10);
    const a = n([...syrup].reverse().find((x) => String(x.day).slice(0, 10) <= cut)?.price_usd);
    return a ? n(sp?.price_usd) / a - 1 : NaN;
  };
  const day = String(sp?.day ?? "").slice(0, 10);
  const dayLong = day ? `${Number(day.slice(8, 10))} ${MON[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}` : "";

  const metrics: Metric[] = [
    { id: "price", label: "Price", value: `$${n(sp?.price_usd).toFixed(3)}`, change: ago(365),
      note: "Daily, from CoinGecko.", chart: { kind: "line", data: syrup, x: "day", ys: ["price_usd"], fmt: "rate", peak: true } },
    { id: "mcap", node: { fig: "d6", id: "circ" }, label: "Market cap", value: fmtUsd(n(sp?.mcap_usd)), change: ago(365),
      note: "Price × circulating supply, daily.", chart: { kind: "line", data: syrup, x: "day", ys: ["mcap_usd"], fmt: "usd" } },
    { id: "ps", node: { fig: "d6", id: "rev" }, label: "Price to sales", value: `${ps.toFixed(1)}×`,
      note: "Market cap ÷ Maple's revenue over the last 12 months, at each month-end.", chart: { kind: "line", data: model.filter((x) => x.ps_ttm != null), x: "month", ys: ["ps_ttm"], fmt: "mult" } },
    { id: "buybacks", node: { fig: "d6", id: "mip" }, label: `Buybacks, ${monY(bb?.month)}`, value: fmtUsd(n(bb?.amount_usd)),
      note: `SYRUP bought back each month under MIP-021, in dollars. ${fmtUsd(bbTotal)} in total.`, chart: { kind: "bars", data: buybacks, x: "month", ys: ["amount_usd"] } },
    { id: "buyback-price", node: { fig: "d6", id: "bin" }, label: "Average buyback price", value: `$${n(bb?.avg_price).toFixed(3)}`,
      note: "Dollars spent ÷ SYRUP bought, each month.", chart: { kind: "line", data: buybacks, x: "month", ys: ["avg_price"], fmt: "rate" } },
    { id: "fund", node: { fig: "d6", id: "ssf" }, label: "Held by Maple's Strategic Fund", value: `${(n(sf?.syrup_held) / 1e6).toFixed(1)}M`,
      note: "SYRUP held by the Syrup Strategic Fund, Maple-reported.", chart: { kind: "line", data: ssf, x: "day", ys: ["syrup_held"], fmt: "raw" } },
    { id: "supply", node: { fig: "d6", id: "circ" }, label: "Circulating supply", value: `${(n(sup?.circulating) / 1e6).toFixed(0)}M`,
      note: "Total supply minus what the Strategic Fund holds.", chart: { kind: "line", data: supply, x: "day", ys: ["circulating"], fmt: "raw" } },
  ];
  const sections = [{ id: "overview", label: "SYRUP" }, { id: "model", label: "2030 model" }, { id: "data", label: "Data and method" }];

  return (
    <div className="page">
      <Rail items={sections} />
      <main className="page-main">
        <section id="overview" className="blk">
          <header className="hero">
            <h1 className="hero-t">SYRUP</h1>
            <p className="hero-l">Maple&apos;s token. Each month Maple uses part of its revenue to buy SYRUP: 10% of revenue under $1.5M, 20% up to $2M, 30% above. </p>
            <p className="hero-s"><span className="live">Data to <b>{dayLong}</b></span><span>CoinGecko, Maple, Ethereum</span><span>Updated daily</span></p>
          </header>
          <Linked label="SYRUP" metrics={metrics} figs={[{ id: "d6", title: "How revenue reaches SYRUP", lede: "Every revenue line adds up to one monthly number. MIP-021 sends a tiered share of it to buybacks.", source: "maple.finance/transparency; onchain fees and buyback wallet (Ethereum)" }]} aside={
          <dl className="facts">
            <div><dt>Bought back, all time</dt><dd>{fmtUsd(bbTotal)}</dd></div>
            <div><dt>Buyback rate, last month</dt><dd>{fmtPct(n(m?.mip021_tier))}</dd></div>
            <div><dt>Maple&apos;s balance sheet</dt><dd>{fmtUsd(n(bal?.syrup_usd) + n(bal?.liquid_assets_usd))}</dd></div>
            <div><dt>Total supply</dt><dd>{(n(sup?.total_supply) / 1e6).toFixed(0)}M</dd></div>
          </dl>} />
        </section>

        <section id="model" className="blk">
          <h2 className="blk-t">2030 model</h2>
          <p className="blk-l">Revenue is the dollars Maple lends times the cut it keeps. Move the settings to see what SYRUP could be worth in 2030. Starting values update daily.</p>
          <Model inp={inp} />
        </section>

        <section id="data" className="blk blk-data">
          <h2 className="blk-t">Data and method</h2>
          <Panel title="Buybacks by month">
            <Table rows={[...buybacks].reverse()} cols={[{ key: "month", title: "month" }, { key: "amount_usd", title: "spent", fmt: "usd" }, { key: "avg_price", title: "average price", fmt: "rate" }]} />
          </Panel>
          <div className="method-b">
            <p><span className="text-ink-2">Buybacks.</span> Amounts and Strategic Fund holdings are Maple-reported. June, July and August 2026 are checked onchain: each matches a SYRUP withdrawal from Binance into the same wallet (0x99f0…a9ca). Maple buys on a centralised exchange, not onchain.</p>
            <p><span className="text-ink-2">Balance sheet.</span> {(n(bal?.syrup_amount) / 1e6).toFixed(1)}M SYRUP ({fmtUsd(n(bal?.syrup_usd))}) plus {fmtUsd(n(bal?.liquid_assets_usd))} in liquid assets.</p>
            <p><span className="text-ink-2">Model.</span> Core deposits = stablecoins × Maple&apos;s core share. syrupUSDG on Earn = Earn TVL × syrupUSDG&apos;s share of Earn. Revenue = average core deposits × core take rate + average syrupUSDG × Maple&apos;s fee (0.746%) + offchain revenue. Buybacks follow MIP-021. Market cap = revenue × P/S; price = market cap ÷ circulating supply. 2027 and 2029 stablecoins sit at the geometric midpoint of the years around them; Earn TVL grows at a constant rate to its 2030 setting.</p>
            <p><span className="text-ink-2">Starting values.</span> Stablecoins {fmtUsd(inp.stablecoins)}, Maple deposits {fmtUsd(inp.deposits)}, syrupUSDG on Robinhood Chain {fmtUsd(inp.syrupOnEarn)}, Earn TVL {fmtUsd(inp.earnTvl)}, revenue over 12 months {fmtUsd(inp.ttmRevenue)}, core take rate {fmtPct(inp.takeRateQ)} (last 3 months), circulating supply {(inp.supply / 1e6).toFixed(0)}M. As of {inp.asOf}. Not investment advice.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
