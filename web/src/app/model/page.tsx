import { modelInputs } from "@/lib/queries";
import Model from "@/components/model";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function ModelPage() {
  const inp = await modelInputs();
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <header className="sec-h">
        <h1 className="sec-t page-t">SYRUP model</h1>
        <div>
          <p className="sec-l">Maple&apos;s revenue is the dollars it lends times the cut it keeps. This model grows the dollars with the stablecoin market and Robinhood Earn,
          applies Maple&apos;s measured take rates, and prices SYRUP at a revenue multiple. Starting values are measured by the pipeline and refresh daily
          (as of {inp.asOf}). Move the sliders to test your own view.</p>
          <p className="mt-3 text-[12px] text-muted">Interactive model, inputs as of {inp.asOf}</p>
        </div>
      </header>

      <Model inp={inp} />

      <section className="grid max-w-4xl gap-2 border-t-2 border-ink pt-4 text-[12.5px] leading-relaxed text-ink-2">
        <div className="text-[14px] font-semibold text-ink">How it works</div>
        <p>Core deposits = stablecoins × Maple&apos;s core share. syrupUSDG on Earn = Earn TVL × syrupUSDG&apos;s share of Earn. Revenue = average core deposits × core take rate + average syrupUSDG × Maple&apos;s fee (0.746%: lenders earn 4.95%, Maple keeps 13.1% of interest) + offchain revenue. Buybacks follow MIP-021 (10% of monthly revenue under $1.5M, 20% to $2M, 30% above). Market cap = revenue × P/S; price = market cap ÷ circulating supply.</p>
        <p>
          Today&apos;s inputs: stablecoins {fmtUsd(inp.stablecoins)} · Maple deposits {fmtUsd(inp.deposits)} (onchain, latest month-end) · syrupUSDG on Robinhood Chain {fmtUsd(inp.syrupOnEarn)} ·
          Earn TVL {fmtUsd(inp.earnTvl)} · trailing-12m revenue {fmtUsd(inp.ttmRevenue)} ({fmtUsd(inp.ttmOnchain)} onchain + {fmtUsd(inp.ttmOffchain)} offchain) ·
          core take rate {fmtPct(inp.takeRateQ)} (last 3 months) · market cap {fmtUsd(inp.mcap)} · circulating supply {(inp.supply / 1e6).toFixed(0)}M.
        </p>
        <p>2027 and 2029 stablecoins sit at the geometric midpoint of the years around them. Earn TVL grows at the constant rate that reaches the 2030 setting. Not investment advice.</p>
      </section>
    </main>
  );
}
