import { rhAum, earnAllocation, earnShare, interestWeekly, loansWeekly, shareOfUsdg, poolState, utilization, topLoans, syrupPrice, syrupBuybacks, revenueBridge, capitalOnChain, holders, mapleRevenueMonthly, mapleModelMonthly, mapleAumByPool, mapleAumLatest, syrupSupply, mapleAumReported, poolsSnapshot, mapleLenders, mapleBorrowers, ssfDaily, mapleBalanceSheet, mapleKpis } from "@/lib/queries";
import { Counter, Counters, Card, Panel, Section, Note, Method, StackedColumns, SimpleLine, StackedBars, Table, StackedBarsWithLines } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";
import { Exhibit } from "@/components/exhibit";
import { modelLedger, aggregate } from "@/lib/model-export";

export const dynamic = "force-dynamic";

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
  const yld = [...model].reverse().find((x) => x.revenue_yield_on_aum != null);
  const yldAvg = col(model, "revenue_yield_on_aum").reduce((a, b) => a + b, 0) / Math.max(1, col(model, "revenue_yield_on_aum").length);
  const intAll = interest.reduce((t, x) => t + n(x.interest_to_depositors_usd) + n(x.delegate_fee_usd) + n(x.maple_fee_usd), 0);
  const intLend = interest.reduce((t, x) => t + n(x.interest_to_depositors_usd), 0);
  const orig4 = loans.slice(-4).reduce((t, x) => t + n(x.originated_usd), 0);
  const bbLast = last(buybacks);
  const lo52 = (() => { const cut = new Date(new Date(String(sp?.day)).getTime() - 365 * 864e5).toISOString().slice(0, 10); return syrup.filter((x) => String(x.day).slice(0, 10) >= cut).map((x) => n(x.price_usd)); })();
  const [p52lo, p52hi] = [Math.min(...lo52), Math.max(...lo52)];
  const p52pos = p52hi > p52lo ? ((n(sp?.price_usd) - p52lo) / (p52hi - p52lo)) * 100 : 50;
  const tail = <T,>(a: T[], k = 24) => a.slice(-k);

  return (
    <main className="mx-auto max-w-6xl space-y-20 px-4 pb-10 pt-12">
      <header className="grid items-end gap-x-10 gap-y-6 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-ink">SYRUP <span className="font-normal text-muted">Maple Finance token</span></h1>
          <div className="mt-3 text-[clamp(64px,9vw,112px)] font-extrabold leading-[0.85] tracking-[-0.055em] text-ink">${n(sp?.price_usd).toFixed(3)}</div>
          <dl className="mt-6 grid grid-cols-3 border-t-2 border-ink">
            {([["7 days", c7], ["30 days", c30], ["1 year", c365]] as const).map(([l, v]) => (
              <div key={l} className="border-r border-line pr-3 pt-2.5 last:border-r-0 [&:not(:first-child)]:pl-3">
                <dt className="text-[12px] text-ink-2">{l}</dt>
                <dd className={`mt-1 text-[20px] font-bold tracking-tight ${v >= 0 ? "text-up" : "text-down"}`}>{signed(v)}</dd>
              </div>
            ))}
          </dl>
          <div className="range" role="img" aria-label={`52-week range ${p52lo.toFixed(3)} to ${p52hi.toFixed(3)} dollars`}>
            <div className="range-l"><span>52-week low <b className="num">${p52lo.toFixed(3)}</b></span><span>high <b className="num">${p52hi.toFixed(3)}</b></span></div>
            <div className="range-t"><i style={{ left: `${Math.max(0, Math.min(100, p52pos))}%` }} /></div>
          </div>
          <p className="mt-5 text-[13px] leading-relaxed text-ink-2">
            Market cap <b className="num font-semibold text-ink">{fmtUsd(n(sp?.mcap_usd))}</b>, <b className="num font-semibold text-ink">{psNow.toFixed(1)}×</b> trailing revenue. Price from CoinGecko, {String(sp?.day ?? "").slice(0, 10)}.
          </p>
        </div>
        <div className="h-[300px] md:h-[380px]"><SimpleLine data={syrup} x="day" ys={["price_usd"]} fmt="rate" peak /></div>
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted md:col-span-2">
          Every other Maple number below is rebuilt from contract events and state on Ethereum and Robinhood Chain (239-contract registry), except Maple&apos;s reported revenue total, AUM, collateral and buybacks, which Maple publishes. Data as of {String(ar?.day ?? "").slice(0, 10)}.
        </p>
      </header>

      {/* ---------------------------------------------------------------- the business */}
      <Section n="01" title="The business" lede={<>Maple earned <b>{fmtUsd(n(ttm?.ttm_revenue))}</b> in the last twelve months on <b>{fmtUsd(n(ar?.aum_usd))}</b> of assets. The market pays <b>{psNow.toFixed(1)}×</b> that revenue for SYRUP.</>}>
        <Counters cols="md:grid-cols-4">
          <Counter label="Revenue, TTM" value={fmtUsd(n(ttm?.ttm_revenue))} spark={tail(col(model, "ttm_revenue"))} delta={yearAgo(model, "month", "ttm_revenue")} sub={`through ${String(ttm?.month ?? "").slice(0, 7)}`} />
          <Counter label="Revenue, last month" value={fmtUsd(n(r?.total_revenue))} spark={tail(col(rev, "total_revenue"))} sub={`${String(r?.month ?? "").slice(0, 7)} · syrupUSD ${fmtUsd(n(r?.syrup_revenue))} · pools ${fmtUsd(n(r?.pool_revenue))} · offchain ${r?.offchain_revenue == null ? "n/s" : fmtUsd(n(r?.offchain_revenue))}`} />
          <Counter label="Loans outstanding" value={fmtUsd(n(lg?.loans_total))} spark={tail(col(loansHist, "loans_total"))} delta={loansG} sub={`${fmtPct(n(lg?.utilization))} of ${fmtUsd(n(lg?.deposits_total))} deposits · principalOut, all loan managers`} />
          <Counter label="AUM" value={fmtUsd(n(ar?.aum_usd))} spark={col(aumRep, "aum_usd").filter((_, i, a) => (a.length - 1 - i) % 4 === 0).slice(-40)} delta={aumG} sub={`${fmtUsd(n(ar?.deposits_usd))} deposits + ${fmtUsd(n(ar?.collateral_usd))} collateral`} />
        </Counters>
        <Counters cols="md:grid-cols-3">
          <Counter label="Gross revenue, TTM (Maple)" value={fmtUsd(n(mk?.gross_revenue_ttm))} sub={`all interest borrowers pay · onchain open-term: ${fmtUsd(ttmGross)}`} />
          <Counter label="Maple's cut of interest" value={fmtPct(n(mk?.protocol_revenue_ttm) / (n(mk?.gross_revenue_ttm) || 1))} sub={`protocol revenue ${fmtUsd(n(mk?.protocol_revenue_ttm))} ÷ gross, TTM · ours ${fmtPct(ttmRev / (ttmGross || 1))} of onchain`} />
          <Counter label="Net interest margin (Maple)" value={fmtPct(n(mk?.nim))} sub={`spread as % of total assets · ours ${fmtPct(ttmRev / (ttmAssets || 1))} (TTM revenue ÷ avg pool assets)`} />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card wide tall title={`${monY(r?.month)} revenue was ${fmtUsd(n(r?.total_revenue))}, which sends ${tier} of it to SYRUP buybacks${n(r?.total_revenue) < 1.5e6 && n(r?.total_revenue) > 1.4e6 ? ", just short of the 20% tier" : n(r?.total_revenue) < 2e6 && n(r?.total_revenue) > 1.9e6 ? ", just short of the 30% tier" : ""}. The record is ${fmtUsd(n(revPk?.total_revenue))}, in ${monY(revPk?.month)}.`} sub="Revenue by month and source. Shaded bands are the MIP-021 buyback tiers: 10% of revenue below $1.5M, 20% up to $2M, 30% above.">
            <StackedBarsWithLines data={rev} x="month" ys={["syrup_revenue", "pool_revenue", "offchain_revenue"]} lines={[]}
              bands={[{ from: 1_500_000, to: 2_000_000, label: "20% to buybacks" }, { from: 2_000_000, to: 2_800_000, label: "30% to buybacks" }]} />
          </Card>
          <Card title={psNow <= psMin * 1.03 ? `At ${psNow.toFixed(1)}× sales, SYRUP is the cheapest it has been` : `SYRUP trades at ${psNow.toFixed(1)}× sales, down from ${n(psPk?.ps_ttm).toFixed(0)}× in ${monY(psPk?.month)}`} sub="Price to sales: market cap ÷ trailing-12-month revenue, month-end"><SimpleLine data={psRows} x="month" ys={["ps_ttm"]} fmt="mult" /></Card>
          <Card title={`Assets under management are ${fmtUsd(n(ar?.aum_usd))}, ${times(aumG)}`} sub="AUM = lender deposits + borrower collateral, weekly, Maple-reported"><StackedBars data={aumRep} x="day" ys={["deposits_usd", "collateral_usd"]} /></Card>
          <Card title={`${String(poolTop?.pool ?? "")} holds ${fmtPct(poolTot ? n(poolTop?.aum_usd) / poolTot : 0)} of lender deposits`} sub="Lender deposits by pool, month-end totalAssets from the contracts"><StackedColumns data={aumPools} x="day" y="aum_usd" group="pool" /></Card>
          <Card title={`${fmtUsd(n(lg?.loans_total))} is out on loan, ${times(loansG)}`} sub="Loans outstanding by pool, month-end principalOut of every loan manager"><StackedBars data={loansHist} x="month" ys={["loans_syrupusdc", "loans_syrupusdt", "loans_syrupusdg", "loans_other"]} /></Card>
          <Card title={`${fmtPct(n(lg?.utilization))} of deposits are lent out`} sub="Utilization: loans outstanding ÷ deposits, month-end"><SimpleLine data={loansHist} x="month" ys={["utilization"]} /></Card>
          <Card title={`Maple earns ${fmtPct(n(yld?.revenue_yield_on_aum))} a year on the assets it manages, against a ${fmtPct(yldAvg)} average`} sub="Revenue yield on AUM, annualised"><SimpleLine data={model.filter((x) => x.revenue_yield_on_aum != null)} x="month" ys={["revenue_yield_on_aum"]} /></Card>
        </div>
        <Panel title="Pools today" sub={`Maple API, ${String(snap[0]?.day ?? "").slice(0, 10)} · TVL = deposits + borrower collateral`}>
          <Table rows={snap} cols={[
            { key: "pool_name", title: "pool" }, { key: "tvl", title: "TVL (AUM)", fmt: "usd" }, { key: "share_of_protocol_tvl", title: "share", fmt: "pct" },
            { key: "deposits_usd", title: "deposits", fmt: "usd" }, { key: "collateral_usd", title: "collateral", fmt: "usd" },
            { key: "loans_outstanding_usd", title: "loans out", fmt: "usd" }, { key: "utilization", title: "utilization", fmt: "pct" },
          ]} />
        </Panel>
        <Panel title="By year" sub="the model's history columns · revenue and buybacks are complete months; balances are year-end (latest for this year)">
          <Table rows={years} cols={[
            { key: "year", title: "year" }, { key: "syrup_revenue", title: "syrupUSD rev", fmt: "usd" }, { key: "pool_revenue", title: "pool rev", fmt: "usd" },
            { key: "offchain_revenue", title: "offchain rev", fmt: "usd" }, { key: "total_revenue", title: "total revenue", fmt: "usd" },
            { key: "loans_total", title: "loans", fmt: "usd" }, { key: "deposits_total", title: "deposits", fmt: "usd" }, { key: "take_rate", title: "take rate", fmt: "pct" },
            { key: "buybacks_actual", title: "buybacks", fmt: "usd" }, { key: "syrup_fdv", title: "FDV", fmt: "usd" }, { key: "ps_fdv", title: "P/S (FDV)", fmt: "mult" },
          ]} />
        </Panel>
        <Note>
          <span className="text-ink-2">Into a spreadsheet:</span> every line of the SYRUP model (markets, balances by pool, revenue split, buybacks, valuation) is at{" "}
          <a className="underline" href="/api/model">/api/model</a> (by year), <a className="underline" href="/api/model?period=quarter">by quarter</a> or{" "}
          <a className="underline" href="/api/model?period=month">by month</a>. In Google Sheets: <code>=IMPORTDATA(&quot;https://maple.paultimofeev.com/api/model&quot;)</code>.
        </Note>
        <Method>
          <span className="text-ink-2">syrupUSD revenue</span> = fees from the syrupUSDC, syrupUSDT and syrupUSDG loan managers and their Aave/Sky strategies.{" "}
          <span className="text-ink-2">Other pools</span> = fees from every other Maple pool (Maple Institutional, High Yield, AQRU and the rest). Both are onchain: open-term <code>ClaimedFundsDistributed</code> (platform + delegate fees), fixed-term <code>ManagementFeesPaid</code> / <code>ServiceFeesPaid</code> / <code>OriginationFeesPaid</code>, strategy <code>StrategyFeesCollected</code>; WETH pools excluded. They reconcile to DeFiLlama&apos;s Maple onchain revenue within 0.3% a month.{" "}
          <span className="text-ink-2">Offchain</span> = Maple-reported monthly revenue (transparency page) − onchain fees: Maple Direct / institutional lending. Total revenue is always Maple&apos;s reported number. In Sep–Oct 2026 onchain fees came in above Maple&apos;s total, so offchain can&apos;t be separated for those months and shows as a gap, not $0.{" "}
          <span className="text-ink-2">Loans outstanding</span> = <code>principalOut()</code> of every USD loan manager at each month-end.
        </Method>
              <Exhibit id="d4" n={4} title="Maple Finance smart contract map" lede="242 contracts, one pattern repeated per pool. Fees go to the treasury and pool delegate inside every loan payment." source="Maple docs, smart contract architecture; Maple address registry" />
      </Section>

      {/* ---------------------------------------------------------------- lenders + borrowers */}
      <Section n="02" title="Lenders and borrowers" lede={<><b>{n(ln?.cumulative_lenders).toLocaleString()}</b> wallets have lent to Maple and <b>{n(bw?.cumulative_borrowers).toLocaleString()}</b> borrowers have paid interest. New lenders over the last year are <b>{signed(lyoy)}</b> on the year before.</>}>
        <Counters cols="md:grid-cols-4">
          <Counter label="Unique lenders, all-time" value={n(ln?.cumulative_lenders).toLocaleString()} spark={tail(col(lenders, "cumulative_lenders"))} sub={`${n(ln?.new_lenders).toLocaleString()} new in ${String(ln?.month ?? "").slice(0, 7)}`} />
          <Counter label="New lenders, 12m vs prior" value={signed(lyoy)} spark={tail(col(lenders, "new_lenders"))} tone={lyoy >= 0 ? "up" : "down"} sub="pool Deposit events, all USD pools" />
          <Counter label="Unique borrowers, all-time" value={n(bw?.cumulative_borrowers).toLocaleString()} spark={tail(col(borrowers, "cumulative_borrowers"))} sub={`${n(bw?.active_borrowers)} paying in ${String(bw?.month ?? "").slice(0, 7)} · ${n(bw?.active_loans)} loans`} />
          <Counter label="Interest paid, 12m vs prior" value={signed(iyoy)} spark={tail(col(borrowers, "interest_paid_usd"))} tone={iyoy >= 0 ? "up" : "down"} sub="gross interest on open-term loans" />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={`${n(ln?.new_lenders).toLocaleString()} new lenders joined in ${monY(ln?.month)}`} sub="Lenders per month, new vs returning"><StackedBars data={lenders.map((x) => ({ ...x, returning_lenders: n(x.active_lenders) - n(x.new_lenders) }))} x="month" ys={["new_lenders", "returning_lenders"]} fmt="raw" /></Card>
          <Card title={`${n(ln?.cumulative_lenders).toLocaleString()} lenders since launch`} sub="Cumulative unique lenders"><SimpleLine data={lenders} x="month" ys={["cumulative_lenders"]} fmt="raw" /></Card>
          <Card title={`${n(bw?.active_borrowers)} borrowers paid interest in ${monY(bw?.month)}`} sub="Borrowers paying per month, new vs existing"><StackedBars data={borrowers.map((x) => ({ ...x, existing_borrowers: n(x.active_borrowers) - n(x.new_borrowers) }))} x="month" ys={["new_borrowers", "existing_borrowers"]} fmt="raw" /></Card>
          <Card title={`Borrowers paid ${fmtUsd(n(bw?.interest_paid_usd))} of interest in ${monY(bw?.month)}`} sub="Interest paid by borrowers per month, open-term loans"><StackedBars data={borrowers} x="month" ys={["interest_paid_usd"]} /></Card>
        </div>
        <Method>Lenders = distinct share recipients of ERC-4626 <code>Deposit</code> on every USD Maple pool. Borrowers = <code>loan.borrower()</code> for every loan that made a payment (<code>ClaimedFundsDistributed</code>, fixed-term fee events). Rebuilt from contracts; replaces the Dune versions.</Method>
      </Section>

      {/* ---------------------------------------------------------------- Robinhood channel */}
      <Section n="03" title="The Robinhood channel" lede="syrupUSDG is the Maple pool built for USDG. Most of it sits on Robinhood Chain as collateral in Robinhood Earn; the loans and the fees live on Ethereum.">
        <Exhibit id="d5" n={5} title="Maple × Robinhood Chain value accrual" lede="syrupUSDG sits on Robinhood Chain as Earn collateral; the loans and the fees live on Ethereum." source="onchain, Robinhood Chain and Ethereum; Chainlink CCIP directory; maple-docs #157" />
        <Exhibit id="d3" n={3} title="Value flow in Robinhood Earn" lede="Earn users are paid by borrowers. A syrupUSDG borrower earns Maple's rate on the collateral and pays Earn's rate on the USDG." source="syrupUSDG loan manager (onchain); FalconX research" />
        <Counters cols="md:grid-cols-3">
          <Counter label="syrupUSDG pool AUM" value={fmtUsd(n(p?.total_assets))} spark={col(util, "total_assets").filter((_, i, a) => (a.length - 1 - i) % 3 === 0).slice(-40)} sub={`exch rate ${n(p?.exch_rate || 1).toFixed(4)}`} />
          <Counter label="On Robinhood Chain" value={fmtUsd(aumRh)} sub={`${fmtPct(aumRh / (n(p?.total_assets) || 1))} of pool`} />
          <Counter label="syrupUSDG share of Earn" value={fmtPct(n(sh?.maple_share_of_earn))} spark={col(share, "maple_share_of_earn").filter((_, i, a) => (a.length - 1 - i) % 3 === 0).slice(-40)} />
          <Counter label="Interest generated, all-time" value={fmtUsd(n(it?.cumulative_gross_interest_usd))} sub={`Maple take rate ${fmtPct(n(it?.maple_take_rate))}`} />
          <Counter label="syrupUSDG revenue, last month" value={fmtUsd(n(rb?.syrupusdg_revenue))} sub={`${fmtPct(n(rb?.syrupusdg_share_of_onchain_rev))} of Maple open-term platform fees`} />
          <Counter label="Loans outstanding" value={fmtUsd(n(lo?.principal_outstanding_usd))} sub={`utilization ${fmtPct(n(u?.utilization))}`} />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card tone="rh" title={`syrupUSDG is ${fmtPct(n(sh?.maple_share_of_earn))} of what backs Robinhood Earn`} sub="syrupUSDG share of Robinhood Earn collateral, daily"><SimpleLine data={share} x="day" ys={["maple_share_of_earn"]} /></Card>
          <Card tone="maple" title={`${fmtUsd(n(u?.loans_outstanding))} of the ${fmtUsd(n(u?.total_assets))} pool is out on loan`} sub="syrupUSDG pool AUM vs loans outstanding"><SimpleLine data={util} x="day" ys={["total_assets", "loans_outstanding"]} fmt="usd" /></Card>
          <Card tone="maple" title={`Lenders keep ${fmtPct(intAll ? intLend / intAll : 0)} of the interest; the pool delegate and Maple split the rest`} sub="syrupUSDG interest by recipient, weekly"><StackedBars data={interest} x="week" ys={["interest_to_depositors_usd", "delegate_fee_usd", "maple_fee_usd"]} /></Card>
          <Card tone="maple" title={`Utilization is ${fmtPct(n(u?.utilization))}`} sub="syrupUSDG loans ÷ pool assets, daily"><SimpleLine data={util} x="day" ys={["utilization"]} /></Card>
          <Card tone="maple" title={`${fmtUsd(orig4)} of new loans in the last four weeks`} sub="syrupUSDG loans originated, weekly"><StackedBars data={loans} x="week" ys={["originated_usd"]} /></Card>
          <Card tone="maple" title={`${fmtUsd(n(lo?.principal_outstanding_usd))} outstanding`} sub="syrupUSDG loans outstanding, weekly"><SimpleLine data={loans.filter((x) => x.principal_outstanding_usd != null)} x="week" ys={["principal_outstanding_usd"]} fmt="usd" /></Card>
          <Card wide tone="maple" title={`One syrupUSDG now redeems for ${n(p?.exch_rate || 1).toFixed(4)} USDG`} sub="syrupUSDG exchange rate: the yield, accrued into the share price"><SimpleLine data={pool} x="day" ys={["exch_rate"]} fmt="rate" /></Card>
        </div>
        <Panel title="syrupUSDG: top loans by interest generated">
          <Table rows={top} cols={[
            { key: "loan", title: "loan", fmt: "addr" }, { key: "payments", title: "payments", fmt: "raw" },
            { key: "principal_usd", title: "principal repaid", fmt: "usd" }, { key: "interest_usd", title: "interest", fmt: "usd" },
            { key: "maple_revenue_usd", title: "maple rev", fmt: "usd" }, { key: "first_payment", title: "first" }, { key: "last_payment", title: "last" },
          ]} />
        </Panel>
      </Section>

      {/* ---------------------------------------------------------------- SYRUP */}
      <Section n="04" title="SYRUP value accrual" lede={<>Maple has bought back <b>{fmtUsd(bbTotal)}</b> of SYRUP over {buybacks.length} months, most recently at <b>${n(bbLast?.avg_price).toFixed(3)}</b> a token. SYRUP trades at <b>${n(sp?.price_usd).toFixed(3)}</b> today.</>}>
        <Exhibit id="d6" n={6} title="SYRUP value flow" lede="Every revenue line rolls into one monthly number; MIP-021 sends a tiered share of it to buybacks." source="maple.finance/transparency; onchain fees and buyback wallet (Ethereum)" />
        <Counters cols="md:grid-cols-3">
          <Counter label="Circulating supply" value={`${(n(sup?.circulating) / 1e6).toFixed(1)}M`} sub={`total ${(n(sup?.total_supply) / 1e6).toFixed(1)}M (contract) − SSF ${(n(sup?.ssf_held) / 1e6).toFixed(1)}M (Maple)`} />
          <Counter label="Buybacks, all-time" value={fmtUsd(bbTotal)} sub={`${buybacks.length} months · through ${String(last(buybacks)?.month ?? "").slice(0, 7)}`} />
          <Counter label="Buyback rate, last month" value={fmtPct(n(m?.mip021_tier))} sub={`MIP-021 on ${fmtUsd(n(m?.total_revenue))} revenue: 10% < $1.5M · 20% to $2M · 30% above`} />
        </Counters>
        <Counters cols="md:grid-cols-3">
          <Counter label="Syrup Strategic Fund" value={`${(n(sf?.syrup_held) / 1e6).toFixed(1)}M SYRUP`} sub={`+ ${fmtUsd(n(sf?.liquid_assets_usd))} liquid assets · ${String(sf?.day ?? "").slice(0, 10)}`} />
          <Counter label="Maple balance sheet" value={fmtUsd(n(bal?.syrup_usd) + n(bal?.liquid_assets_usd))} sub={`${(n(bal?.syrup_amount) / 1e6).toFixed(1)}M SYRUP (${fmtUsd(n(bal?.syrup_usd))}) + ${fmtUsd(n(bal?.liquid_assets_usd))} liquid`} />
          <Counter label="SSF SYRUP, change since Aug 2025" value={`${((n(sf?.syrup_held) - n(ssf[0]?.syrup_held)) / 1e6).toFixed(1)}M`} sub="vs SYRUP bought back over the same period" />
        </Counters>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={`Maple’s Strategic Fund holds ${(n(sf?.syrup_held) / 1e6).toFixed(1)}M SYRUP`} sub="Syrup Strategic Fund: SYRUP held, Maple-reported"><SimpleLine data={ssf} x="day" ys={["syrup_held"]} fmt="raw" /></Card>
          <Card title={`${fmtUsd(n(bbLast?.amount_usd))} spent on buybacks in ${monY(bbLast?.month)}`} sub="SYRUP buybacks by month, USD spent"><StackedBars data={buybacks} x="month" ys={["amount_usd"]} /></Card>
          <Card wide title={`The last buyback paid $${n(bbLast?.avg_price).toFixed(3)} a token`} sub="Average buyback price, USD per SYRUP"><SimpleLine data={buybacks} x="month" ys={["avg_price"]} fmt="rate" /></Card>
        </div>
        <Method>
          Buyback amounts and SSF holdings are Maple-reported (transparency page). June, July and August 2026 are verified onchain: each matches a SYRUP withdrawal from Binance that ends in the same wallet (0x99f0…a9ca), within a few tokens (July exactly). Maple executes buybacks on a centralised exchange, not onchain.
        </Method>
      </Section>
    </main>
  );
}
