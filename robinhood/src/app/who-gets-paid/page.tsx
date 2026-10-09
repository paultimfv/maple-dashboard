import { earnRwaShare, earnAllocation } from "@/lib/queries";
import { protocolStats, stableSupply, tokens, type ProtocolStats, type TokenStats } from "@/lib/llama";
import { Counter, Counters, Card, Section, Note, CategoryBars } from "@/components/charts";
import { fmtUsd, fmtPct } from "@/lib/fmt";

export const revalidate = 3600;

const last = <T,>(a: T[]) => a[a.length - 1];

type Entity = {
  name: string; layer: string; role: string; token: string; gecko?: string; llama?: string;
  paid: string; collateral?: string; direct: "yes" | "indirect" | "no";
};

/* Everyone in the Robinhood Earn stack, top (the app) to bottom (the collateral borrowers post). */
const STACK: Entity[] = [
  { name: "Robinhood", layer: "App", role: "Distributes Earn to its customers and owns the relationship", token: "HOOD (stock)", direct: "indirect",
    paid: "Not disclosed. Earn keeps customer dollars in the Robinhood app" },
  { name: "Paxos", layer: "Dollar", role: "Issues USDG, the dollar Earn users deposit", token: "None", direct: "no",
    paid: "Earns on the reserves behind every USDG in circulation" },
  { name: "Steakhouse Financial", layer: "Curator", role: "Runs the vault: picks collateral, sets risk limits and allocation", token: "None", llama: "steakhouse-financial", direct: "no",
    paid: "Curator fees on the vaults it manages" },
  { name: "Morpho", layer: "Lending rails", role: "The lending markets the vault supplies USDG into", token: "MORPHO", gecko: "morpho", llama: "morpho", direct: "no",
    paid: "Fee switch is off, so lending activity does not reach the token" },
  { name: "Arbitrum", layer: "Chain stack", role: "Robinhood Chain is an Arbitrum chain settling to Ethereum", token: "ARB", gecko: "arbitrum", direct: "indirect",
    paid: "10% of Robinhood Chain's net revenue (gas), not Earn itself" },
  { name: "Ethena", layer: "Collateral", role: "Issues USDe, which borrowers post to borrow Earn's USDG", token: "ENA", gecko: "ethena", llama: "ethena", collateral: "USDe", direct: "indirect",
    paid: "Earn creates demand for USDe as collateral; Ethena earns on the assets backing USDe" },
  { name: "Maple", layer: "Collateral", role: "Issues syrupUSDG, which borrowers post to borrow Earn's USDG", token: "SYRUP", gecko: "syrup", llama: "maple", collateral: "syrupUSDG", direct: "indirect",
    paid: "Borrowers mint syrupUSDG to post it; Maple takes a fee on the institutional loans behind it" },
  { name: "Midas", layer: "Collateral", role: "Issues mGLO, a tokenized fund borrowers post as collateral", token: "None tracked", llama: "midas-rwa", collateral: "mGLO", direct: "no",
    paid: "Earn creates demand for mGLO as collateral" },
  { name: "Spark", layer: "Collateral", role: "Issues spUSDG, a savings token borrowers post as collateral", token: "SPK", gecko: "spark-2", llama: "spark", collateral: "spUSDG", direct: "indirect",
    paid: "Earn creates demand for spUSDG as collateral" },
];

const USDG_ID = 286, USDE_ID = 146;   // DefiLlama stablecoin ids

const usd = (v: number | null | undefined) => (v == null ? "—" : fmtUsd(v));
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`);
const mult = (v: number | null) => (v == null || !isFinite(v) ? "—" : `${v.toFixed(1)}x`);

export default async function WhoGetsPaid() {
  const [rwa, alloc, usdg, usde, tok, ...stats] = await Promise.all([
    earnRwaShare(), earnAllocation(), stableSupply(USDG_ID), stableSupply(USDE_ID),
    tokens(STACK.filter((e) => e.gecko).map((e) => e.gecko!)),
    ...STACK.map((e) => (e.llama ? protocolStats(e.llama) : Promise.resolve<ProtocolStats>({ fees30d: null, revenue30d: null, tvl: null }))),
  ]);
  const share = (c?: string) => (c ? Number(rwa.find((r) => r.collateral === c)?.share ?? 0) : null);
  const earnTvl = Number(last(alloc)?.earn_tvl_usdg ?? 0);
  const rows = STACK.map((e, i) => ({ e, s: stats[i] as ProtocolStats, t: e.gecko ? (tok as Record<string, TokenStats>)[e.gecko] : undefined, earn: share(e.collateral) }));
  const withToken = rows.filter((r) => r.t);
  const held = rwa.filter((r) => Number(r.share) >= 0.001);
  const top2 = [...held].sort((a, b) => Number(b.share) - Number(a.share)).slice(0, 2);

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <header className="space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Research dashboard · protocol data refreshed hourly</div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Who gets paid</h1>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">
          Everyone in the Robinhood Earn stack: what they do, how Earn pays them, and whether there is a token to own.
          Earn&apos;s collateral mix is read onchain; protocol fees, revenue and TVL come from DeFiLlama; prices from CoinGecko.
        </p>
      </header>

      <Section n="01" tone="rh" title="The stack" lede="From the app the customer sees down to the collateral borrowers post. Most of the stack has no token; where there is one, Earn usually pays it indirectly.">
        <div className="overflow-x-auto rounded-[3px] border border-line bg-surface">
          <table className="w-full min-w-[860px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line-strong text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                <th className="px-4 py-2 font-normal">Layer</th><th className="py-2 pr-4 font-normal">Who</th><th className="py-2 pr-4 font-normal">Role in Earn</th>
                <th className="py-2 pr-4 font-normal">Token</th><th className="py-2 pr-4 text-right font-normal">Share of Earn</th><th className="py-2 pr-4 font-normal">How Earn pays them</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, earn }) => (
                <tr key={e.name} className="border-t border-line align-top hover:bg-wash">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">{e.layer}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 font-medium text-ink">{e.name}</td>
                  <td className="py-2.5 pr-4 text-ink-2">{e.role}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-ink">{e.token}</td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-ink">{earn == null ? "" : `${e.collateral} ${fmtPct(earn)}`}</td>
                  <td className="py-2.5 pr-4 text-ink-2">
                    <span className={`mr-1.5 inline-block rounded-[2px] px-1.5 py-px font-mono text-[10px] uppercase tracking-wider ${e.direct === "no" ? "bg-wash text-muted" : "bg-rh/25 text-ink"}`}>
                      {e.direct === "no" ? "No token link" : "Indirect"}
                    </span>
                    {e.paid}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n="02" tone="rh" title="The collateral side" lede="Earn users supply USDG. Borrowers post a yield-bearing token to borrow it, so Earn's growth shows up as demand for these tokens.">
        <Counters cols="md:grid-cols-4">
          <Counter label="Robinhood Earn TVL" value={usd(earnTvl)} sub="Steakhouse USDG vault, onchain" />
          <Counter label="USDG supply, all chains" value={usd(usdg.now)} sub={usdg.yearAgo ? `${pct((usdg.now! / usdg.yearAgo - 1) * 100)} year on year · DeFiLlama` : "DeFiLlama"} />
          <Counter label="USDe supply, all chains" value={usd(usde.now)} sub={usde.yearAgo ? `${pct((usde.now! / usde.yearAgo - 1) * 100)} year on year · DeFiLlama` : "DeFiLlama"} />
          <Counter label="Two largest collaterals" value={fmtPct(top2.reduce((a, r) => a + Number(r.share), 0))} sub={`${top2.map((r) => `${r.collateral} ${fmtPct(Number(r.share))}`).join(" + ")} of Earn`} />
        </Counters>
        <Card wide tone="maple" title="Robinhood Earn allocation by collateral" sub="USDG lent against each collateral today · onchain">
          <CategoryBars data={held} x="collateral" y="allocated_usdg" />
        </Card>
      </Section>

      <Section n="03" tone="rh" title="By the numbers" lede="The players with a token, side by side on the same date. Fees are what users pay the protocol; revenue is what the protocol keeps, as DeFiLlama defines it for each.">
        <div className="overflow-x-auto rounded-[3px] border border-line bg-surface">
          <table className="w-full min-w-[860px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line-strong font-mono text-[10.5px] uppercase tracking-wider text-muted">
                <th className="px-4 py-2 text-left font-normal">Who</th><th className="py-2 pr-4 text-left font-normal">Token</th>
                <th className="py-2 pr-4 text-right font-normal">Price</th><th className="py-2 pr-4 text-right font-normal">1y</th>
                <th className="py-2 pr-4 text-right font-normal">Market cap</th><th className="py-2 pr-4 text-right font-normal">FDV</th>
                <th className="py-2 pr-4 text-right font-normal">Fees 30d</th><th className="py-2 pr-4 text-right font-normal">Revenue 30d</th>
                <th className="py-2 pr-4 text-right font-normal">Mcap ÷ ann. revenue</th><th className="py-2 pr-4 text-right font-normal">TVL</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {withToken.map(({ e, s, t }) => (
                <tr key={e.name} className="border-t border-line hover:bg-wash">
                  <td className="px-4 py-2 font-sans font-medium text-ink">{e.name}</td>
                  <td className="py-2 pr-4 text-ink">{e.token}</td>
                  <td className="py-2 pr-4 text-right text-ink-2">{t ? `$${t.price < 1 ? t.price.toFixed(4) : t.price.toFixed(2)}` : "—"}</td>
                  <td className={`py-2 pr-4 text-right ${t?.chg1y == null ? "text-muted" : t.chg1y >= 0 ? "text-up" : "text-down"}`}>{pct(t?.chg1y)}</td>
                  <td className="py-2 pr-4 text-right text-ink-2">{usd(t?.mcap)}</td>
                  <td className="py-2 pr-4 text-right text-ink-2">{usd(t?.fdv)}</td>
                  <td className="py-2 pr-4 text-right text-ink-2">{usd(s.fees30d)}</td>
                  <td className="py-2 pr-4 text-right text-ink-2">{usd(s.revenue30d)}</td>
                  <td className="py-2 pr-4 text-right text-ink">{!t || !s.revenue30d ? "—" : s.fees30d && s.revenue30d < 0.01 * s.fees30d ? "n.m." : mult(t.mcap / (s.revenue30d * 12))}</td>
                  <td className="py-2 pr-4 text-right text-ink-2">{usd(s.tvl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          Revenue definitions differ by protocol, so read the revenue and multiple columns as a rough guide, not a like-for-like comparison. “n.m.” = not meaningful: DeFiLlama counts less than 1% of the protocol’s fees as revenue (Ethena).
          Morpho shows no revenue because its fee switch is off. Arbitrum&apos;s fees aren&apos;t shown: DeFiLlama tracks Arbitrum One, not Robinhood Chain.
          HOOD is a stock and isn&apos;t shown. Prices: CoinGecko. Fees, revenue, TVL: DeFiLlama.
        </Note>
      </Section>
    </main>
  );
}
