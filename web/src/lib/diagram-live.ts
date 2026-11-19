// Live text for the flow diagrams. exhibits.ts holds the layout; this fills in the numbers that move, per box.
import { q } from "@/lib/db";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** latest complete month's Maple-reported revenue, its MIP-021 tier and the buyback paid for it, trailing-12 revenue; syrupUSDG pool today */
export async function diagramLive() {
  const [r] = await q(`WITH m AS (SELECT month, revenue_usd FROM maple_reported_revenue WHERE month < date_trunc('month', now()) ORDER BY month DESC LIMIT 12)
    SELECT (SELECT month FROM m ORDER BY month DESC LIMIT 1) AS month, (SELECT revenue_usd FROM m ORDER BY month DESC LIMIT 1) AS revenue,
      (SELECT sum(revenue_usd) FROM m) AS ttm, (SELECT amount_usd FROM syrup_buybacks b WHERE b.month = (SELECT max(month) FROM m)) AS buyback,
      (SELECT total_assets FROM pool_state WHERE pool = 'syrupUSDG' ORDER BY day DESC LIMIT 1) AS usdg_pool`);
  const month = r.month instanceof Date ? r.month.toISOString() : String(r.month);
  const mo = `${MON[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  const rev = Number(r.revenue), tier = rev >= 2e6 ? "30%" : rev >= 1.5e6 ? "20%" : "10%";
  const paid = r.buyback != null ? `, $${Math.round(Number(r.buyback)).toLocaleString("en-US")} paid` : " (not yet paid)";
  return {
    d6: {
      rev: [`${mo}: $${(rev / 1e6).toFixed(2)}M (Maple-reported)`, `Trailing 12 months: $${(Number(r.ttm) / 1e6).toFixed(1)}M`],
      mip: ["10% under $1.5M · 20% to $2M · 30% above", `${mo} revenue → ${tier} tier${paid}`],
    },
    d5: { p: [`$${(Number(r.usdg_pool) / 1e6).toFixed(1)}M total · 0x87b6…cd7a`] },
  };
}
