import { stablecoinSupplyGlobal, earnAllocation, earnShare, yieldBearing, ethLending, llamaLending, cgYieldBearing, mapleBookDaily } from "@/lib/queries";
import { Explorer, type Metric } from "@/components/explorer";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const revalidate = 21600; // data updates daily; cache 6h so each view does not query Neon

type R = Record<string, unknown>;
const last = <T,>(a: T[]) => a[a.length - 1];
const n = (v: unknown) => Number(v ?? 0);
const day = (r: R) => String(r.day).slice(0, 10);
/** value a year before the last row, as a fraction change */
const yoy = (rows: R[], k: string) => {
  const lr = last(rows); if (!lr) return undefined;
  const cut = `${Number(day(lr).slice(0, 4)) - 1}${day(lr).slice(4)}`;
  const a = rows.find((r) => day(r) >= cut);
  return a && n(a[k]) ? n(lr[k]) / n(a[k]) - 1 : undefined;
};
/** long rows (day, name, value) summed per day */
const totals = (rows: R[], k: string): R[] => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(day(r), (m.get(day(r)) ?? 0) + n(r[k]));
  return [...m.entries()].sort().map(([d, v]) => ({ day: d, [k]: v }));
};
/** keep the `top` biggest names on the last day; fold the rest into "Other" */
const topN = (rows: R[], name: string, k: string, top: number) => {
  const ld = day(last(rows) ?? {});
  const keep = new Set(rows.filter((r) => day(r) === ld).sort((a, b) => n(b[k]) - n(a[k])).slice(0, top).map((r) => String(r[name])));
  const m = new Map<string, R>();
  for (const r of rows) {
    const g = keep.has(String(r[name])) ? String(r[name]) : "Other", key = `${day(r)}|${g}`;
    const o = m.get(key) ?? { day: day(r), group: g, [k]: 0 }; o[k] = n(o[k]) + n(r[k]); m.set(key, o);
  }
  return [...m.values()];
};

/** What Maple grows with: stablecoins, the yield-bearing kind, onchain lending, Robinhood Earn. */
export default async function DriversPage() {
  const [stable, alloc, share, yb, eth, llama, cg, book] = await Promise.all([stablecoinSupplyGlobal(), earnAllocation(), earnShare(), yieldBearing(), ethLending(), llamaLending(), cgYieldBearing(), mapleBookDaily()]);
  const sg = last(stable), al = last(alloc), sh = last(share);
  const ybT = totals(yb, "value_usd"), ethT = totals(eth, "borrowed");
  const allSup = totals(llama, "supplied_usd"), allBor = totals(llama, "borrowed_usd");
  const allLend: R[] = allSup.map((r, i) => ({ ...r, borrowed_usd: allBor[i]?.borrowed_usd }));
  const mapleShare = ethT.map((t) => ({ day: t.day, maple_share: n(eth.find((r) => day(r) === t.day && r.name === "Maple")?.borrowed) / (n(t.borrowed) || 1) }));
  /* Maple's book on or before a day */
  const bookAt = (d: string) => { let b: R | undefined; for (const r of book) { if (day(r) <= d) b = r; else break; } return b; };
  const cgT = totals(cg, "mcap_usd");
  const MAPLE_YB = new Set(["syrupusdc", "syrupusdt", "syrup-usdg"]);
  const ybMaple = cgT.map((t) => ({ day: t.day, maple_share: cg.filter((r) => day(r) === t.day && MAPLE_YB.has(String(r.coin))).reduce((a, r) => a + n(r.mcap_usd), 0) / (n(t.mcap_usd) || 1) }));
  const stableAt = new Map(stable.map((r) => [day(r), n(r.supply_usd)]));
  const ybOfStable = cgT.filter((t) => stableAt.has(String(t.day))).map((t) => ({ day: t.day, yield_bearing_share: n(t.mcap_usd) / stableAt.get(String(t.day))! }));
  const llamaHasMaple = llama.some((r) => /maple/i.test(String(r.protocol)));
  /* Maple's loan book (deposits) ÷ active onchain loans (top-25 lending protocols, plus Maple's loans when DefiLlama doesn't list Maple) */
  const mapleOfAll = allBor.map((t) => { const b = bookAt(String(t.day)); return { day: t.day, maple_share: n(b?.deposits) / ((n(t.borrowed_usd) + (llamaHasMaple ? 0 : n(b?.loans))) || 1) }; });
  const utilRows = [...new Set(eth.map(day))].map((d) => {
    const o: R = { day: d };
    for (const r of eth.filter((x) => day(x) === d && x.name !== "Maple")) o[String(r.name)] = n(r.borrowed) / (n(r.supplied) || 1);
    const b = bookAt(d); if (b && n(b.deposits)) o.Maple = n(b.loans) / n(b.deposits);
    return o;
  });
  const ul = last(utilRows) ?? {};
  const lastDay = [day(last(eth) ?? {}), day(sg ?? {})].sort().pop();

  const metrics: Metric[] = [
    { id: "stablecoins", label: "Stablecoins, all chains", value: fmtUsd(n(sg?.supply_usd)), change: yoy(stable, "supply_usd"),
      note: "Total supply of dollar stablecoins, weekly, from DefiLlama. Maple's deposits grow with it.", chart: { kind: "line", data: stable, x: "day", ys: ["supply_usd"], fmt: "usd" } },
    { id: "yield-bearing", label: "Yield-bearing stablecoins, top 15", value: fmtUsd(n(last(cgT)?.mcap_usd)), change: yoy(cgT, "mcap_usd"),
      note: "Market cap of the 15 largest in CoinGecko's yield-bearing stablecoins category, all chains, daily. The figure the SYRUP model uses.", chart: { kind: "columns", data: topN(cg, "symbol", "mcap_usd", 8), x: "day", y: "mcap_usd", group: "group" } },
    { id: "yb-share", label: "Yield-bearing share of all stablecoins", value: fmtPct(n(last(ybOfStable)?.yield_bearing_share)),
      note: "Top-15 yield-bearing market cap ÷ all dollar stablecoins, weekly.", chart: { kind: "line", data: ybOfStable, x: "day", ys: ["yield_bearing_share"] } },
    { id: "maple-yb", label: "Maple's share of yield-bearing", value: fmtPct(n(last(ybMaple)?.maple_share)),
      note: "syrupUSDC + syrupUSDT + syrupUSDG ÷ the top-15 yield-bearing stablecoins, daily (CoinGecko market caps).", chart: { kind: "line", data: ybMaple, x: "day", ys: ["maple_share"] } },
    { id: "yield-bearing-eth", label: "Yield-bearing on Ethereum, from the contracts", value: fmtUsd(n(last(ybT)?.value_usd)), change: yoy(ybT, "value_usd"),
      note: "Stablecoins that pay their holder, read from each token contract weekly: sUSDS, sUSDe, sDAI, syrupUSDC, syrupUSDT, BUIDL, sfrxUSD, scrvUSD.", chart: { kind: "columns", data: yb, x: "day", y: "value_usd", group: "name" } },
    { id: "lending", label: "Onchain lending, all chains", value: fmtUsd(n(last(allLend)?.supplied_usd)), change: yoy(allSup, "supplied_usd"),
      note: "Supplied to and borrowed from the 25 largest lending protocols, weekly, from DefiLlama.", chart: { kind: "line", data: allLend, x: "day", ys: ["supplied_usd", "borrowed_usd"], fmt: "usd" } },
    { id: "loans", label: "Active onchain loans, all chains", value: fmtUsd(n(last(allBor)?.borrowed_usd)), change: yoy(allBor, "borrowed_usd"),
      note: "Borrowed from the 25 largest lending protocols, by protocol, weekly, from DefiLlama.", chart: { kind: "columns", data: topN(llama, "protocol", "borrowed_usd", 6), x: "day", y: "borrowed_usd", group: "group" } },
    { id: "maple-loans-share", label: "Maple's share of active onchain loans", value: fmtPct(n(last(mapleOfAll)?.maple_share)),
      note: "Maple's loan book (total deposits) ÷ all active loans at the 25 largest lending protocols (DefiLlama) plus Maple, weekly. The share the SYRUP model uses.", chart: { kind: "line", data: mapleOfAll, x: "day", ys: ["maple_share"] } },
    { id: "utilization", label: "Utilization, Maple vs Aave, Spark, Compound", value: fmtPct(n(ul.Maple)),
      note: `Share of deposits lent out, weekly. Maple from its pools; Aave, Spark and Compound for their USDC, USDT and DAI markets on Ethereum, from their contracts. Today: Aave ${fmtPct(n(ul.Aave))}, Spark ${fmtPct(n(ul.Spark))}, Compound ${fmtPct(n(ul.Compound))}.`,
      chart: { kind: "line", data: utilRows, x: "day", ys: ["Maple", "Aave", "Spark", "Compound"] } },
    { id: "eth-loans", label: "Stablecoin loans on Ethereum", value: fmtUsd(n(last(ethT)?.borrowed)), change: yoy(ethT, "borrowed"),
      note: "USDC, USDT and DAI lent out by Aave, Spark and Compound (read from their contracts) and Maple's loans outstanding, weekly.", chart: { kind: "columns", data: eth, x: "day", y: "borrowed", group: "name" } },
    { id: "maple-share", label: "Maple's share of those loans", value: fmtPct(n(last(mapleShare)?.maple_share)),
      note: "Maple's loans ÷ all stablecoin loans on Ethereum above.", chart: { kind: "line", data: mapleShare, x: "day", ys: ["maple_share"] } },
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
            <p className="hero-s"><span className="live">Data to <b>{lastDay}</b></span><span>Ethereum, DefiLlama, Robinhood Chain</span><span>Updated daily</span></p>
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
