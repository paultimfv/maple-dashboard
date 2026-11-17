import { syrupPrice, syrupBuybacks, syrupSupply, ssfDaily, mapleBalanceSheet, mapleModelMonthly, syrupHolders, syrupStaked, syrupMarkets, syrupVenues, syrupMarketHistory, MAJOR } from "@/lib/queries";
import { Panel, Table } from "@/components/charts";
import { Explorer, Linked, Rail, type Metric } from "@/components/explorer";
import Model from "@/components/model";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const revalidate = 21600; // data updates daily; cache 6h so each view does not query Neon

const last = <T,>(a: T[]) => a[a.length - 1];
const n = (v: unknown) => Number(v ?? 0);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monY = (d: unknown) => `${MON[Number(String(d).slice(5, 7)) - 1] ?? ""} ${String(d).slice(0, 4)}`;

export default async function SyrupPage() {
  const [syrup, buybacks, supply, ssf, bsheet, model] = await Promise.all([
    syrupPrice(), syrupBuybacks(), syrupSupply(), ssfDaily(), mapleBalanceSheet(), mapleModelMonthly(),
  ]);
  const [holders, staked, mkts, venues] = await Promise.all([syrupHolders(), syrupStaked(), syrupMarkets(), syrupVenues()]);
  const mk = last(mkts);
  const [oiH, pvH, dexH] = await Promise.all([syrupMarketHistory("oi_usd"), syrupMarketHistory("perp_volume_usd"), syrupMarketHistory("dex_liquidity_usd")]);
  const lastDay = (rows: Record<string, unknown>[]) => { const d = String(last(rows)?.day ?? ""); return rows.filter((x) => String(x.day) === d); };
  const sumLast = (rows: Record<string, unknown>[]) => lastDay(rows).reduce((t, x) => t + n(x.value), 0);
  const perpOf = (src: string, k: "oi_usd" | "volume_usd") => venues.filter((x) => x.kind === "perp" && String(x.venue).startsWith(src)).reduce((t, x) => t + n(x[k]), 0);
  const oiCover = (perpOf("Binance", "oi_usd") + perpOf("OKX", "oi_usd")) / n(mk?.open_interest_usd || 1);
  const pvCover = ["Binance", "OKX", "Hyperliquid", "Bitget"].reduce((t, v) => t + perpOf(v, "volume_usd"), 0) / n(mk?.perp_volume_usd || 1);
  const st = last(staked);
  const top = holders.filter((x) => x.token === "SYRUP");
  const byKind = (() => { const m = new Map<string, number>(); for (const h of top) m.set(String(h.kind), (m.get(String(h.kind)) ?? 0) + n(h.balance));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([kind, balance]) => ({ kind, balance, share: balance / n(st?.total_supply || 1) })); })();
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
  const vol30 = syrup.slice(-30).reduce((t, x) => t + n(x.volume_usd), 0) / Math.max(1, syrup.slice(-30).length);
  /* open interest, depth and DEX liquidity have no free history, so the pipeline snapshots them daily from 16 Nov 2026.
     Until there are two weeks of snapshots, each chart shows today's split by venue instead of a time series. */
  const hist = mkts.length >= 14;
  const short = (v: unknown) => String(v).replace(/\s*\((Futures|Derivatives)\)|\s+Futures$|\s+Exchange$/g, "").replace(/-ethereum$/, "").replace(/_/g, " ");
  const topN = (rows: Record<string, unknown>[], keys: string[], k = 8) => {
    const s = [...rows].sort((a, b) => n(b[keys[0]]) - n(a[keys[0]]));
    const head = s.slice(0, k).map((r) => ({ venue: short(r.kind === "pool" ? r.pairs : r.venue), ...Object.fromEntries(keys.map((x) => [x, n(r[x])])) }));
    const rest = s.slice(k); if (rest.length) head.push({ venue: `${rest.length} others`, ...Object.fromEntries(keys.map((x) => [x, rest.reduce((t, r) => t + n(r[x]), 0)])) });
    return head;
  };
  const spot = venues.filter((x) => x.kind === "spot" && MAJOR.includes(String(x.venue)));
  const market: Metric[] = [
    { id: "volume", label: "Spot volume, 24h", value: fmtUsd(n(sp?.volume_usd)), change: (() => { const a = syrup.slice(-395, -335); const v = a.reduce((t, x) => t + n(x.volume_usd), 0) / Math.max(1, a.length); return v ? vol30 / v - 1 : NaN; })(),
      note: `Spot trading across all exchanges, daily, from CoinGecko. 30-day average ${fmtUsd(vol30)}. Change compares 30-day averages a year apart.`, chart: { kind: "bars", data: syrup, x: "day", ys: ["volume_usd"] } },
    { id: "oi", label: "Open interest, perpetuals", value: fmtUsd(n(mk?.open_interest_usd)),
      note: `All venues CoinGecko tracks, today. The chart is Binance and OKX, the two venues that publish open interest history for free (${fmtPct(oiCover)} of today's total); Bybit, Hyperliquid and the rest only from 16 Nov 2026.`,
      chart: { kind: "columns", data: oiH, x: "day", y: "value", group: "source" } },
    { id: "perp-volume", label: "Perpetuals volume, 24h", value: fmtUsd(n(mk?.perp_volume_usd)),
      note: `All venues CoinGecko tracks, today. The chart is daily volume on Binance, OKX, Bitget and Hyperliquid (${fmtPct(pvCover)} of today's total), from each venue's public candles.`,
      chart: { kind: "columns", data: pvH, x: "day", y: "value", group: "source" } },
    { id: "depth", label: "Order book depth, ±2%", value: `${fmtUsd(n(mk?.depth_up_usd))} / ${fmtUsd(n(mk?.depth_down_usd))}`,
      note: `Dollars it takes to move the price 2% up / 2% down, summed over the spot books on major exchanges.${hist ? " Daily." : " By exchange today. No free source keeps order book history, so the daily series starts 16 Nov 2026."}`,
      chart: hist ? { kind: "line", data: mkts, x: "day", ys: ["depth_up_usd", "depth_down_usd"], fmt: "usd" } : { kind: "bars", data: topN(spot, ["depth_down_usd", "depth_up_usd"]), x: "venue", ys: ["depth_up_usd", "depth_down_usd"] } },
    { id: "dex", label: "DEX liquidity", value: fmtUsd(sumLast(dexH)),
      note: "Assets in the DEX pools that hold SYRUP (Uniswap on Ethereum and Base, Aerodrome), daily, from DefiLlama.",
      chart: { kind: "columns", data: dexH, x: "day", y: "value", group: "source" } },
  ];
  const sections = [{ id: "overview", label: "SYRUP" }, { id: "markets", label: "Markets" }, { id: "holders", label: "Holders" }, { id: "model", label: "2030 model" }, { id: "data", label: "Data and method" }];

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

        <section id="markets" className="blk">
          <h2 className="blk-t">Markets</h2>
          <Explorer label="Markets" metrics={market} aside={
            <dl className="facts">
              <div><dt>Spot + perp volume ÷ market cap</dt><dd>{fmtPct((n(sp?.volume_usd) + n(mk?.perp_volume_usd)) / n(sp?.mcap_usd || 1))}</dd></div>
              <div><dt>Open interest ÷ market cap</dt><dd>{fmtPct(n(mk?.open_interest_usd) / n(sp?.mcap_usd || 1))}</dd></div>
              <div><dt>Perpetuals ÷ spot volume</dt><dd>{(n(mk?.perp_volume_usd) / n(mk?.spot_volume_usd || 1)).toFixed(1)}×</dd></div>
            </dl>} />
          <Panel title="Where SYRUP trades" sub="Today, largest 24h volume first. Spot books, perpetual futures and DEX pools.">
            <Table rows={venues.slice(0, 20).map((x) => ({ ...x, kind: x.kind === "perp" ? "perpetual" : x.kind === "pool" ? "DEX pool" : "spot" }))} cols={[
              { key: "venue", title: "venue" }, { key: "kind", title: "market" }, { key: "volume_usd", title: "24h volume", fmt: "usd" },
              { key: "depth_up_usd", title: "+2% depth", fmt: "usd" }, { key: "depth_down_usd", title: "−2% depth", fmt: "usd" }, { key: "spread", title: "spread", fmt: "pct" },
              { key: "oi_usd", title: "open interest", fmt: "usd" }, { key: "liquidity_usd", title: "liquidity", fmt: "usd" },
            ]} />
          </Panel>
        </section>

        <section id="holders" className="blk">
          <h2 className="blk-t">Holders</h2>
          <dl className="facts">
            <div><dt>Staked (stSYRUP)</dt><dd>{(n(st?.staked) / 1e6).toFixed(1)}M</dd></div>
            <div><dt>Share staked</dt><dd>{fmtPct(n(st?.staked) / n(st?.total_supply || 1))}</dd></div>
            <div><dt>On exchanges (top 50)</dt><dd>{fmtPct(n(byKind.find((x) => x.kind === "exchange")?.balance) / n(st?.total_supply || 1))}</dd></div>
            <div><dt>Top 10 holders</dt><dd>{fmtPct(top.slice(0, 10).reduce((s, x) => s + n(x.balance), 0) / n(st?.total_supply || 1))}</dd></div>
          </dl>
          <Panel title="SYRUP by holder type" sub="Top 50 holders on Ethereum, typed from public address names. Share of total supply.">
            <Table rows={byKind.map((x) => ({ ...x, balance: Math.round(x.balance).toLocaleString() }))} cols={[{ key: "kind", title: "held by" }, { key: "balance", title: "SYRUP" }, { key: "share", title: "share", fmt: "pct" }]} />
          </Panel>
          <Panel title="Top holders" sub="Ethereum, today.">
            <Table rows={top.slice(0, 20).map((x) => ({ ...x, balance: Math.round(n(x.balance)).toLocaleString(), share: n(x.balance) / n(st?.total_supply || 1) }))} cols={[
              { key: "address", title: "address", fmt: "addr" }, { key: "name", title: "name" }, { key: "kind", title: "type" },
              { key: "balance", title: "SYRUP" }, { key: "share", title: "share", fmt: "pct" },
            ]} />
          </Panel>
        </section>

        <section id="model" className="blk">
          <h2 className="blk-t">2030 model</h2>
          <p className="blk-l">Stablecoins grow, Maple keeps its share of yield-bearing ones, lends almost all of it, and keeps a cut of the interest. Move the settings to see what SYRUP could be worth in 2030.</p>
          <Model />
        </section>

        <section id="data" className="blk blk-data">
          <h2 className="blk-t">Data and method</h2>
          <Panel title="Buybacks by month">
            <Table rows={[...buybacks].reverse()} cols={[{ key: "month", title: "month" }, { key: "amount_usd", title: "spent", fmt: "usd" }, { key: "avg_price", title: "average price", fmt: "rate" }]} />
          </Panel>
          <div className="method-b">
            <p><span className="text-ink-2">Buybacks.</span> Amounts and Strategic Fund holdings are Maple-reported. June, July and August 2026 are checked onchain: each matches a SYRUP withdrawal from Binance into the same wallet (0x99f0…a9ca). Maple buys on a centralised exchange, not onchain.</p>
            <p><span className="text-ink-2">Markets.</span> Spot volume history is CoinGecko&apos;s daily total. Today&apos;s open interest, perpetuals volume and order book depth are CoinGecko (tickers and derivatives). History: Binance open interest and volume from Binance&apos;s public data archive (data.binance.vision), OKX from its open interest and candle APIs, Hyperliquid and Bitget from their candles, DEX liquidity from DefiLlama. Order book depth has no free history; it is kept daily from 16 Nov 2026. Headline depth counts major exchanges only; several small venues report books deeper than their whole day&apos;s volume.</p>
            <p><span className="text-ink-2">Balance sheet.</span> {(n(bal?.syrup_amount) / 1e6).toFixed(1)}M SYRUP ({fmtUsd(n(bal?.syrup_usd))}) plus {fmtUsd(n(bal?.liquid_assets_usd))} in liquid assets.</p>
            <p><span className="text-ink-2">Model.</span> Stablecoin supply → yield-bearing stablecoins (share of supply) → syrupUSD (Maple&apos;s share of those) → loan book (1.26× syrupUSD, as in 2026) → loans (× utilization) → revenue (average loans over the year × take rate) → buybacks (MIP-021) → FDV (revenue × P/S) → price (FDV ÷ circulating supply). Actuals run to 31 Oct 2026; the 2026 take rate is annualised. Stablecoins compound at a constant rate to the 2030 setting. Not investment advice.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
