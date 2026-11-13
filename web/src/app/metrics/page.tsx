import { rhAum, earnAllocation, earnShare, interestWeekly, loansWeekly, shareOfUsdg, poolState, utilization, topLoans, syrupPrice, syrupBuybacks, revenueBridge, capitalOnChain, holders, mapleRevenueMonthly, mapleModelMonthly, mapleAumByPool, mapleAumLatest, syrupSupply, mapleAumReported, poolsSnapshot, mapleLenders, mapleBorrowers, ssfDaily, mapleBalanceSheet, mapleKpis, poolTable, lenderYield, collateralCover, lenderFlows, loanBook, syrupHolders, treasuryDaily } from "@/lib/queries";
import { Panel, Table } from "@/components/charts";
import { Explorer, Linked, Rail, type Metric } from "@/components/explorer";
import { fmtUsd, fmtPct } from "@/lib/fmt";
import { modelLedger, aggregate } from "@/lib/model-export";

export const revalidate = 21600; // data updates daily; cache 6h so each view does not query Neon

const last = <T,>(a: T[]) => a[a.length - 1];
const n = (v: unknown) => Number(v ?? 0);

export default async function BusinessPage() {
  const [rev, model, aumPools, aumNow, ledger, supply, aumRep, snap] = await Promise.all([
    mapleRevenueMonthly(), mapleModelMonthly(), mapleAumByPool(), mapleAumLatest(), modelLedger(), syrupSupply(), mapleAumReported(), poolsSnapshot(),
  ]);
  const years = aggregate(ledger, "year").map((p) => ({ year: p.period, ...p.values }));
  const lg = [...ledger].reverse().find((x) => x.loans_total != null);
  const loansHist = ledger.filter((x) => x.loans_total != null && String(x.month) >= "2024-01-01");
  const ar = last(aumRep);
  const [lenders, borrowers, ssf, bsheet, kpi] = await Promise.all([mapleLenders(), mapleBorrowers(), ssfDaily(), mapleBalanceSheet(), mapleKpis()]);
  const mk = kpi[0];
  const [pools, ly, cover, flows, book, tokenHolders, tre] = await Promise.all([poolTable(), lenderYield(), collateralCover(), lenderFlows(), loanBook(), syrupHolders(), treasuryDaily()]);
  const POOLS = ["syrupUSDC", "syrupUSDT", "syrupUSDG"];
  /* long rows (day, pool, value) to one row per day with a column per pool */
  const wide = (rows: Record<string, unknown>[], k: string) => {
    const m = new Map<string, Record<string, unknown>>();
    for (const r of rows) { const d = String(r.day).slice(0, 10); const o = m.get(d) ?? { day: d }; o[String(r.pool)] = r[k]; m.set(d, o); }
    return [...m.values()];
  };
  const yieldW = wide(ly, "yield"), coverW = wide(cover, "coverage");
  const bookUsd = book.filter((x) => x.asset !== "WETH");
  const bookTot = bookUsd.reduce((s, x) => s + n(x.principal), 0);
  const bookRate = bookUsd.reduce((s, x) => s + n(x.principal) * n(x.rate), 0) / (bookTot || 1);
  const syrupPoolsCover = (() => { const t = cover.filter((x) => String(x.day) === String(last(cover)?.day)); const c = t.reduce((s, x) => s + n(x.collateral_usd), 0), l = t.reduce((s, x) => s + n(x.collateral_usd) / (n(x.coverage) || 1), 0); return l ? c / l : 0; })();
  const kinds = (token: string) => {
    const m = new Map<string, number>();
    for (const h of tokenHolders.filter((x) => x.token === token)) m.set(String(h.kind), (m.get(String(h.kind)) ?? 0) + n(h.balance));
    const tot = [...m.values()].reduce((a, b) => a + b, 0);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([kind, balance]) => ({ kind, balance, share: balance / tot }));
  };
  const usdcAt = kinds("syrupUSDC"), usdtAt = kinds("syrupUSDT");
  const quarters = aggregate(ledger, "quarter", "2025-01-01").map((p) => ({ quarter: p.period, ...p.values,
    kept: p.values.gross_interest != null && p.values.interest_to_lenders != null ? Number(p.values.gross_interest) - Number(p.values.interest_to_lenders) : null }));
  const tl = last(tre);
  const ttmL = ledger.filter((x) => !x.partial_month && x.total_revenue != null).slice(-12);
  const ttmGross = ttmL.reduce((s, x) => s + n(x.gross_interest), 0), ttmRev = ttmL.reduce((s, x) => s + n(x.total_revenue), 0);
  const ttmAssets = ttmL.reduce((s, x) => s + n(x.pool_assets), 0) / (ttmL.length || 1);
  const sf = last(ssf);
  const bal = bsheet[0];
  const ln = last(lenders);
  const bw = last(borrowers);
  const yoy = <T extends Record<string, unknown>>(rows: T[], k: string) => {
    const a = rows.slice(-12).reduce((s, x) => s + n(x[k]), 0), b = rows.slice(-24, -12).reduce((s, x) => s + n(x[k]), 0);
    return b ? a / b - 1 : 0;
  };
  const [aum, alloc, share, interest, loans, usdg, pool, util, top, syrup, buybacks, bridgeRev, cap, hold] = await Promise.all([
    rhAum(), earnAllocation(), earnShare(), interestWeekly(), loansWeekly(), shareOfUsdg(), poolState(), utilization(), topLoans(),
    syrupPrice(), syrupBuybacks(), revenueBridge(), capitalOnChain(), holders(),
  ]);

  const m = last(model);
  const r = last(rev);
  const sp = last(syrup);
  const sup = last(supply);
    const ttm = [...model].reverse().find((x) => x.ttm_revenue != null);
  const psNow = ttm ? n(sp?.mcap_usd) / n(ttm.ttm_revenue) : 0;
  const bbTotal = buybacks.reduce((s, x) => s + n(x.amount_usd), 0);
  const holderOf = (t: string) => n(hold.find((x) => x.token === t)?.holders);

  const lastDay = last(aum)?.day;
  const aumRh = aum.filter((x) => x.day === lastDay).reduce((s, x) => s + n(x.aum_usd), 0);
  const p = last(pool);
  const sh = last(share);
  const al = last(alloc);
  const it = last(interest);
  const lo = [...loans].reverse().find((x) => x.principal_outstanding_usd != null);
  const u = last(util);
  const ug = last(usdg);
  const cl = last(cap);
  const rb = last(bridgeRev);

  const priceAgo = (days: number) => {
    const cut = new Date(new Date(String(sp?.day)).getTime() - days * 864e5).toISOString().slice(0, 10);
    return n([...syrup].reverse().find((x) => String(x.day).slice(0, 10) <= cut)?.price_usd);
  };
  const chg = (days: number) => { const a = priceAgo(days); return a ? n(sp?.price_usd) / a - 1 : 0; };
  const [c7, c30, c365] = [chg(7), chg(30), chg(365)];

  const lyoy = yoy(lenders, "new_lenders");
  const iyoy = yoy(borrowers, "interest_paid_usd");
  const signed = (v: number) => `${v >= 0 ? "+" : ""}${fmtPct(v)}`;

  /* ---- findings: every chart is headed by what it shows, computed from the same rows it draws */
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mon = (d: unknown) => MON[Number(String(d).slice(5, 7)) - 1] ?? "";
  const monY = (d: unknown) => `${mon(d)} ${String(d).slice(0, 4)}`;
  type R = Record<string, unknown>;
  const col = (rows: R[], k: string) => rows.map((x) => x[k]).filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
  const peakRow = (rows: R[], k: string) => rows.filter((x) => x[k] != null).reduce<R | undefined>((a, b) => (!a || n(b[k]) > n(a[k]) ? b : a), undefined);
  const yearAgo = (rows: R[], xk: string, k: string) => {
    const lr = [...rows].reverse().find((x) => x[k] != null); if (!lr) return NaN;
    const cut = new Date(new Date(String(lr[xk]).slice(0, 10)).getTime() - 365 * 864e5).toISOString().slice(0, 10);
    const old = [...rows].reverse().find((x) => String(x[xk]).slice(0, 10) <= cut && x[k] != null);
    return old && n(old[k]) ? n(lr[k]) / n(old[k]) - 1 : NaN;
  };
  const times = (g: number) => (g >= 0.95 ? `${(g + 1).toFixed(1)}× a year ago` : `${g >= 0 ? "up" : "down"} ${Math.abs(g * 100).toFixed(0)}% on a year ago`);

  const revPk = peakRow(rev, "total_revenue");
  const tier = n(r?.total_revenue) >= 2e6 ? "30%" : n(r?.total_revenue) >= 1.5e6 ? "20%" : "10%";
  const psRows = model.filter((x) => x.ps_ttm != null);
  const psPk = peakRow(psRows, "ps_ttm");
  const psMin = Math.min(...col(psRows, "ps_ttm"));
  const aumG = yearAgo(aumRep, "day", "aum_usd");
  const poolDay = aumPools.reduce((m, x) => (String(x.day) > m ? String(x.day) : m), "");
  const poolNow = aumPools.filter((x) => String(x.day) === poolDay);
  const poolTop = poolNow.reduce<R | undefined>((a, b) => (!a || n(b.aum_usd) > n(a.aum_usd) ? b : a), undefined);
  const poolTot = poolNow.reduce((t, x) => t + n(x.aum_usd), 0);
  const loansG = yearAgo(loansHist, "month", "loans_total");
  const yldAvg = col(model, "revenue_yield_on_aum").reduce((a, b) => a + b, 0) / Math.max(1, col(model, "revenue_yield_on_aum").length);
  const intAll = interest.reduce((t, x) => t + n(x.interest_to_depositors_usd) + n(x.delegate_fee_usd) + n(x.maple_fee_usd), 0);
  const intLend = interest.reduce((t, x) => t + n(x.interest_to_depositors_usd), 0);
  const orig4 = loans.slice(-4).reduce((t, x) => t + n(x.originated_usd), 0);
  const bbLast = last(buybacks);
  const lo52 = (() => { const cut = new Date(new Date(String(sp?.day)).getTime() - 365 * 864e5).toISOString().slice(0, 10); return syrup.filter((x) => String(x.day).slice(0, 10) >= cut).map((x) => n(x.price_usd)); })();
  const [p52lo, p52hi] = [Math.min(...lo52), Math.max(...lo52)];
  const p52pos = p52hi > p52lo ? ((n(sp?.price_usd) - p52lo) / (p52hi - p52lo)) * 100 : 50;
  const tail = <T,>(a: T[], k = 24) => a.slice(-k);

  const asOf = String(ar?.day ?? "").slice(0, 10);
  const asOfLong = asOf ? `${Number(asOf.slice(8, 10))} ${mon(asOf).slice(0, 3)} ${asOf.slice(0, 4)}` : "";
  const take = ledger.filter((x) => !x.partial_month && x.loans_total && x.onchain_revenue != null && String(x.month) >= "2024-07-01")
    .map((x) => ({ month: x.month, take_rate: (n(x.onchain_revenue) * 12) / n(x.loans_total),
      share_of_interest: x.gross_interest ? (n(x.gross_interest) - n(x.interest_to_lenders)) / n(x.gross_interest) : null }));
  const tk = last(take);
  const revenue: Metric[] = [
    { id: "treasury", node: { fig: "d6", id: "rev" }, label: "Maple treasury", value: fmtUsd(n(tl?.syrup_usd) + n(tl?.liquid_assets_usd)),
      note: "Maple's own balance: SYRUP and cash (stablecoins and ETH), daily.", chart: { kind: "bars", data: tre, x: "day", ys: ["liquid_assets_usd", "syrup_usd"] } },
    { id: "by-month", node: { fig: "d6", id: "rev" }, label: `Revenue, ${monY(r?.month)}`, value: fmtUsd(n(r?.total_revenue)),
      note: "By source. Shading shows the share that goes to SYRUP buybacks: 10% under $1.5M, 20% up to $2M, 30% above.",
      chart: { kind: "tiers", data: rev, x: "month", ys: ["syrup_revenue", "pool_revenue", "offchain_revenue"], bands: [{ from: 1_500_000, to: 2_000_000, label: "20% to buybacks" }, { from: 2_000_000, to: 2_800_000, label: "30% to buybacks" }] } },
    { id: "take", node: { fig: "d6", id: "rev" }, label: "Take rate", value: fmtPct(n(tk?.take_rate)),
      note: "Maple's cut of the interest on its loans: onchain fees × 12 ÷ loans outstanding at month end.", chart: { kind: "line", data: take, x: "month", ys: ["take_rate"] } },
    { id: "interest", node: { fig: "d6", id: "s1" }, label: `Interest paid, ${monY(bw?.month)}`, value: fmtUsd(n(bw?.interest_paid_usd)), change: iyoy,
      note: "Interest borrowers paid on open-term loans. Change compares the last 12 months with the 12 before.", chart: { kind: "bars", data: borrowers, x: "month", ys: ["interest_paid_usd"] } },
  ];
  const lending: Metric[] = [
    { id: "lender-yield", node: { fig: "d4", id: "p" }, label: "Lender yield, syrupUSDC", value: fmtPct(n(pools.find((x) => x.pool === "syrupUSDC")?.lender_yield)),
      note: "What lenders earn: each pool token's share-price growth over the last 30 days, annualised.", chart: { kind: "line", data: yieldW, x: "day", ys: POOLS } },
    { id: "borrow-rate", node: { fig: "d4", id: "ln" }, label: "Borrower rate, open loans", value: fmtPct(bookRate),
      note: `What borrowers pay today: each open loan's contract rate, weighted by size. ${book.length} open loans.`, chart: { kind: "bars", data: pools.filter((x) => x.borrow_rate != null).map((x) => ({ pool: x.pool, borrow_rate: x.borrow_rate, lender_yield: x.lender_yield })), x: "pool", ys: ["borrow_rate", "lender_yield"], fmt: "pct" } },
    { id: "cover", node: { fig: "d4", id: "ln" }, label: "Collateral cover", value: `${(syrupPoolsCover * 100).toFixed(0)}%`,
      note: "Borrower collateral ÷ loans in the syrup pools, daily, from Maple's API.", chart: { kind: "line", data: coverW, x: "day", ys: POOLS, fmt: "pct" } },
    { id: "flows", node: { fig: "d4", id: "p" }, label: `Lender net flow, ${monY(last(flows)?.month)}`, value: fmtUsd(n(last(flows)?.net)),
      note: "Deposits into the syrup pools against withdrawals out, by month (pool Deposit and Withdraw events).", chart: { kind: "bars", data: flows, x: "month", ys: ["deposited", "withdrawn"] } },
    { id: "aum-split", node: { fig: "d4", id: "p" }, label: "Lender deposits", value: fmtUsd(n(ar?.deposits_usd)),
      note: "Assets under management split into lender deposits and borrower collateral.", chart: { kind: "bars", data: aumRep, x: "day", ys: ["deposits_usd", "collateral_usd"] } },
    { id: "by-pool", node: { fig: "d4", id: "p" }, label: "Deposits by pool", value: fmtUsd(poolTot),
      note: "Each pool's deposits at month-end, read from the pool contracts.", chart: { kind: "columns", data: aumPools, x: "day", y: "aum_usd", group: "pool" } },
    { id: "loans-pool", node: { fig: "d4", id: "ln" }, label: "Loans by pool", value: fmtUsd(n(lg?.loans_total)),
      note: "Loans outstanding at month-end, by pool.", chart: { kind: "bars", data: loansHist, x: "month", ys: ["loans_syrupusdc", "loans_syrupusdt", "loans_syrupusdg", "loans_other"] } },
    { id: "utilization", node: { fig: "d4", id: "pm" }, label: "Share of deposits lent out", value: fmtPct(n(lg?.utilization)),
      note: "Loans outstanding ÷ deposits, at month-end.", chart: { kind: "line", data: loansHist, x: "month", ys: ["utilization"] } },
  ];
  const people: Metric[] = [
    { id: "new-lenders", label: `New lenders, ${monY(ln?.month)}`, value: n(ln?.new_lenders).toLocaleString(), change: lyoy,
      note: "First-time and returning lenders each month. Change compares the last 12 months of new lenders with the 12 before.",
      chart: { kind: "bars", data: lenders.map((x) => ({ ...x, returning_lenders: n(x.active_lenders) - n(x.new_lenders) })), x: "month", ys: ["new_lenders", "returning_lenders"], fmt: "raw" } },
    { id: "borrowers", label: `Borrowers paying, ${monY(bw?.month)}`, value: n(bw?.active_borrowers).toLocaleString(),
      note: "Borrowers that made a payment each month, new and existing.",
      chart: { kind: "bars", data: borrowers.map((x) => ({ ...x, existing_borrowers: n(x.active_borrowers) - n(x.new_borrowers) })), x: "month", ys: ["new_borrowers", "existing_borrowers"], fmt: "raw" } },
    { id: "all-borrowers", label: "Borrowers, all time", value: n(bw?.cumulative_borrowers).toLocaleString(),
      note: "Borrowers that have ever paid interest to a Maple pool.", chart: { kind: "line", data: borrowers, x: "month", ys: ["cumulative_borrowers"], fmt: "raw" } },
  ];
  const robinhood: Metric[] = [
    { id: "usdg-pool", node: { fig: "d5", id: "p" }, label: "syrupUSDG pool", value: fmtUsd(n(p?.total_assets)),
      note: "The Maple pool for USDG, and how much of it is lent out.", chart: { kind: "line", data: util, x: "day", ys: ["total_assets", "loans_outstanding"], fmt: "usd" } },
    { id: "earn-share", node: { fig: "d5", id: "m" }, label: "Share of Robinhood Earn", value: fmtPct(n(sh?.maple_share_of_earn)), tone: "rh",
      note: "syrupUSDG as a share of the collateral behind Robinhood Earn.", chart: { kind: "line", data: share, x: "day", ys: ["maple_share_of_earn"] } },
    { id: "usdg-interest", node: { fig: "d5", id: "h" }, label: "Interest, all time", value: fmtUsd(n(it?.cumulative_gross_interest_usd)),
      note: "Weekly interest on syrupUSDG loans, split between lenders, the pool delegate and Maple.", chart: { kind: "bars", data: interest, x: "week", ys: ["interest_to_depositors_usd", "delegate_fee_usd", "maple_fee_usd"] } },
    { id: "usdg-new", node: { fig: "d5", id: "l" }, label: "New loans, last 4 weeks", value: fmtUsd(orig4),
      note: "syrupUSDG loans made each week.", chart: { kind: "bars", data: loans, x: "week", ys: ["originated_usd"] } },
    { id: "usdg-rate", node: { fig: "d5", id: "h" }, label: "syrupUSDG exchange rate", value: n(p?.exch_rate || 1).toFixed(4),
      note: "USDG paid out per syrupUSDG. It rises as interest builds up.", chart: { kind: "line", data: pool, x: "day", ys: ["exch_rate"], fmt: "rate" } },
  ];
  const sections = [
    { id: "revenue-sec", label: "Revenue" }, { id: "lending-sec", label: "Lending" },
    { id: "pools-sec", label: "Pools and loans" }, { id: "people-sec", label: "Lenders and borrowers" }, { id: "robinhood-sec", label: "Robinhood" }, { id: "data", label: "Data and method" },
  ];

  return (
    <div className="page">
      <Rail items={sections} />
      <main className="page-main">
        <header className="hero">
            <h1 className="hero-t">Key business metrics</h1>
            <p className="hero-l">Revenue, lending, lenders and borrowers, and the Robinhood pool. Pick a metric to open its chart.</p>
            <p className="hero-s"><span className="live">Data to <b>{asOfLong}</b></span><span>Ethereum and Robinhood Chain</span><span>Updated daily</span></p>
        </header>

        <section id="revenue-sec" className="blk">
          <h2 className="blk-t">Revenue</h2>
          <Linked label="Revenue" metrics={revenue} figs={[{ id: "d6", title: "Where revenue comes from", lede: "Four sources add up to one monthly number. MIP-021 sends a tiered share of it to SYRUP buybacks.", source: "maple.finance/transparency; onchain fees (Ethereum)" }]} aside={
            <dl className="facts">
              <div><dt>Interest borrowers paid, 12 months</dt><dd>{fmtUsd(n(mk?.gross_revenue_ttm))}</dd></div>
              <div><dt>Maple&apos;s cut of that interest</dt><dd>{fmtPct(n(mk?.protocol_revenue_ttm) / (n(mk?.gross_revenue_ttm) || 1))}</dd></div>
              <div><dt>Net interest margin</dt><dd>{fmtPct(n(mk?.nim))}</dd></div>
            </dl>} />
        </section>

        <section id="lending-sec" className="blk">
          <h2 className="blk-t">Lending</h2>
          <Linked label="Lending" metrics={lending} figs={[{ id: "d4", title: "How a Maple pool is built", lede: "Every pool repeats the same set of contracts. Fees go to the treasury and the pool delegate inside each loan payment.", source: "Maple docs, smart contract architecture; Maple address registry" }]} />
        </section>

        <section id="pools-sec" className="blk">
          <h2 className="blk-t">Pools and loans</h2>
          <Panel title="Pools" sub="Deposits and lender yield from the pool contracts; loans from the loan managers; borrower rate from each open loan; cover from Maple's API.">
            <Table rows={pools} cols={[
              { key: "pool", title: "pool" }, { key: "deposits", title: "deposits", fmt: "usd" }, { key: "deposits_30d", title: "30d", fmt: "pct" },
              { key: "loans", title: "loans", fmt: "usd" }, { key: "loans_30d", title: "30d", fmt: "pct" }, { key: "utilization", title: "lent out", fmt: "pct" },
              { key: "lender_yield", title: "lender yield", fmt: "pct" }, { key: "borrow_rate", title: "borrower rate", fmt: "pct" },
              { key: "loans_open", title: "open loans", fmt: "raw" }, { key: "coverage", title: "collateral cover", fmt: "pct" },
            ]} />
          </Panel>
          <dl className="facts">
            <div><dt>Open loans</dt><dd>{book.length}</dd></div>
            <div><dt>Loan book</dt><dd>{fmtUsd(bookTot)}</dd></div>
            <div><dt>Average borrower rate</dt><dd>{fmtPct(bookRate)}</dd></div>
            <div><dt>Largest loan</dt><dd>{fmtPct(n(bookUsd[0]?.principal) / (bookTot || 1))}</dd></div>
          </dl>
          <Panel title="Open loans" sub={`Read from each loan contract, ${String(book[0] ? new Date().toISOString().slice(0, 10) : "")}. Borrowers are wallet addresses.`}>
            <Table rows={book.slice(0, 25)} cols={[
              { key: "borrower", title: "borrower", fmt: "addr" }, { key: "pool", title: "pool" }, { key: "asset", title: "asset" },
              { key: "principal", title: "principal", fmt: "usd" }, { key: "rate", title: "rate", fmt: "pct" }, { key: "date_funded", title: "funded" },
            ]} />
          </Panel>
          <Panel title="Where lenders' syrup tokens sit" sub="Top 50 holders of syrupUSDC and syrupUSDT on Ethereum, by type. Bridge = sent to other chains over CCIP.">
            <Table rows={usdcAt.map((x) => ({ ...x, usdt: usdtAt.find((y) => y.kind === x.kind)?.share }))} cols={[
              { key: "kind", title: "held by" }, { key: "balance", title: "syrupUSDC", fmt: "usd" }, { key: "share", title: "share", fmt: "pct" }, { key: "usdt", title: "syrupUSDT share", fmt: "pct" },
            ]} />
          </Panel>
        </section>

        <section id="people-sec" className="blk">
          <h2 className="blk-t">Lenders and borrowers</h2>
          <Explorer label="Lenders and borrowers" metrics={people} />
        </section>

        <section id="robinhood-sec" className="blk">
          <h2 className="blk-t">Robinhood</h2>
          <p className="blk-l">syrupUSDG is Maple&apos;s pool for USDG. Most of it is used as collateral in Robinhood Earn on Robinhood Chain.</p>
          <Linked label="Robinhood" metrics={robinhood} figs={[
            { id: "d5", title: "Maple and Robinhood Chain", lede: "syrupUSDG sits on Robinhood Chain as Earn collateral. The loans and the fees are on Ethereum.", source: "onchain, Robinhood Chain and Ethereum; Chainlink CCIP directory; maple-docs #157" },
            { id: "d3", title: "Where Earn's yield comes from", lede: "Earn users are paid by borrowers. A syrupUSDG borrower earns Maple's rate on the collateral and pays Earn's rate on the USDG.", source: "syrupUSDG loan manager (onchain); FalconX research" },
          ]} />
        </section>

        <section id="data" className="blk blk-data">
          <h2 className="blk-t">Data and method</h2>
          <Panel title="Pools today" sub={`Maple API, ${String(snap[0]?.day ?? "").slice(0, 10)}. TVL = deposits + borrower collateral.`}>
            <Table rows={snap} cols={[
              { key: "pool_name", title: "pool" }, { key: "tvl", title: "TVL", fmt: "usd" }, { key: "share_of_protocol_tvl", title: "share", fmt: "pct" },
              { key: "deposits_usd", title: "deposits", fmt: "usd" }, { key: "collateral_usd", title: "collateral", fmt: "usd" },
              { key: "loans_outstanding_usd", title: "loans out", fmt: "usd" }, { key: "utilization", title: "utilization", fmt: "pct" },
            ]} />
          </Panel>
          <Panel title="By quarter" sub="Income from the loan contracts (complete months); balances at quarter-end.">
            <Table rows={quarters} cols={[
              { key: "quarter", title: "quarter" }, { key: "gross_interest", title: "interest earned", fmt: "usd" }, { key: "interest_to_lenders", title: "paid to lenders", fmt: "usd" },
              { key: "kept", title: "kept by Maple", fmt: "usd" }, { key: "offchain_revenue", title: "offchain", fmt: "usd" }, { key: "total_revenue", title: "total revenue", fmt: "usd" },
              { key: "loans_total", title: "loans", fmt: "usd" }, { key: "deposits_total", title: "deposits", fmt: "usd" }, { key: "buybacks_actual", title: "buybacks", fmt: "usd" },
            ]} />
          </Panel>
          <Panel title="By year" sub="Revenue and buybacks are complete months. Balances are year-end, or latest for this year.">
            <Table rows={years} cols={[
              { key: "year", title: "year" }, { key: "syrup_revenue", title: "syrupUSD rev", fmt: "usd" }, { key: "pool_revenue", title: "pool rev", fmt: "usd" },
              { key: "offchain_revenue", title: "offchain rev", fmt: "usd" }, { key: "total_revenue", title: "total revenue", fmt: "usd" },
              { key: "loans_total", title: "loans", fmt: "usd" }, { key: "deposits_total", title: "deposits", fmt: "usd" }, { key: "take_rate", title: "take rate", fmt: "pct" },
              { key: "buybacks_actual", title: "buybacks", fmt: "usd" }, { key: "syrup_fdv", title: "FDV", fmt: "usd" }, { key: "ps_fdv", title: "P/S (FDV)", fmt: "mult" },
            ]} />
          </Panel>
          <Panel title="syrupUSDG loans by interest paid">
            <Table rows={top} cols={[
              { key: "loan", title: "loan", fmt: "addr" }, { key: "payments", title: "payments", fmt: "raw" },
              { key: "principal_usd", title: "principal repaid", fmt: "usd" }, { key: "interest_usd", title: "interest", fmt: "usd" },
              { key: "maple_revenue_usd", title: "Maple revenue", fmt: "usd" }, { key: "first_payment", title: "first" }, { key: "last_payment", title: "last" },
            ]} />
          </Panel>
          <div className="method-b">
            <p><span className="text-ink-2">Spreadsheet.</span> Every line of the SYRUP model is at <a className="underline" href="/api/model">/api/model</a> (by year), <a className="underline" href="/api/model?period=quarter">by quarter</a> or <a className="underline" href="/api/model?period=month">by month</a>. In Google Sheets: <code>=IMPORTDATA(&quot;https://maple.paultimofeev.com/api/model&quot;)</code>.</p>
            <p><span className="text-ink-2">Sources.</span> Pool, loan, lender and borrower numbers are read from contracts on Ethereum and Robinhood Chain (239-contract registry). Total revenue, assets under management, collateral and buybacks are Maple-reported. Price is CoinGecko.</p>
            <p><span className="text-ink-2">Revenue.</span> syrupUSD = fees from the syrupUSDC, syrupUSDT and syrupUSDG loan managers and their Aave/Sky strategies. Other pools = fees from every other Maple pool. Both onchain: open-term <code>ClaimedFundsDistributed</code>, fixed-term <code>ManagementFeesPaid</code> / <code>ServiceFeesPaid</code> / <code>OriginationFeesPaid</code>, strategy <code>StrategyFeesCollected</code>; WETH pools excluded. They match DeFiLlama&apos;s Maple onchain revenue within 0.3% a month. Offchain = Maple&apos;s reported total minus onchain fees. In Sep–Oct 2026 onchain fees were above Maple&apos;s total, so offchain shows as a gap for those months.</p>
            <p><span className="text-ink-2">Loans.</span> <code>principalOut()</code> of every USD loan manager at each month-end.</p>
            <p><span className="text-ink-2">Lenders and borrowers.</span> Lenders = distinct share recipients of ERC-4626 <code>Deposit</code> on every USD pool. Borrowers = <code>loan.borrower()</code> for every loan that made a payment.</p>
            <p><span className="text-ink-2">Margins.</span> Interest paid, Maple&apos;s cut and net interest margin are Maple-reported. From onchain open-term loans alone: interest {fmtUsd(ttmGross)}, cut {fmtPct(ttmRev / (ttmGross || 1))}, revenue ÷ average pool assets {fmtPct(ttmRev / (ttmAssets || 1))}.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
