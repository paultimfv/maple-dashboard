/* Public protocol + token data for the "Who gets paid" page. DefiLlama (fees, revenue, TVL, stablecoin supply)
   and CoinGecko (price, market cap, FDV), cached for an hour. Any source that fails returns null, never throws. */

const H = { "User-Agent": "robinhood-earn-dashboard" };

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: H, next: { revalidate: 3600 } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export type ProtocolStats = { fees30d: number | null; revenue30d: number | null; tvl: number | null };

export async function protocolStats(slug: string): Promise<ProtocolStats> {
  type S = { total30d?: number | null };
  const [f, r, t] = await Promise.all([
    json<S>(`https://api.llama.fi/summary/fees/${slug}?dataType=dailyFees`),
    json<S>(`https://api.llama.fi/summary/fees/${slug}?dataType=dailyRevenue`),
    json<number>(`https://api.llama.fi/tvl/${slug}`),
  ]);
  return { fees30d: f?.total30d ?? null, revenue30d: r?.total30d ?? null, tvl: typeof t === "number" ? t : null };
}

/** circulating supply of a DefiLlama-tracked stablecoin, now and one year ago */
export async function stableSupply(id: number): Promise<{ now: number | null; yearAgo: number | null }> {
  type P = { tokens?: { date: number; circulating: { peggedUSD: number } }[] };
  const d = await json<P>(`https://stablecoins.llama.fi/stablecoin/${id}`);
  const pts = d?.tokens ?? [];
  if (!pts.length) return { now: null, yearAgo: null };
  const last = pts[pts.length - 1];
  const target = last.date - 365 * 86400;
  const ago = pts.reduce((a, p) => (Math.abs(p.date - target) < Math.abs(a.date - target) ? p : a), pts[0]);
  return { now: last.circulating.peggedUSD, yearAgo: ago.date <= target + 7 * 86400 ? ago.circulating.peggedUSD : null };
}

export type TokenStats = { price: number; mcap: number; fdv: number | null; chg1y: number | null };

export async function tokens(ids: string[]): Promise<Record<string, TokenStats>> {
  type M = { id: string; current_price: number; market_cap: number; fully_diluted_valuation: number | null; price_change_percentage_1y_in_currency?: number | null };
  const d = await json<M[]>(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}&price_change_percentage=1y`);
  const out: Record<string, TokenStats> = {};
  for (const m of d ?? []) out[m.id] = { price: m.current_price, mcap: m.market_cap, fdv: m.fully_diluted_valuation, chg1y: m.price_change_percentage_1y_in_currency ?? null };
  return out;
}
