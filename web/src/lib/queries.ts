// Ported from the-main-vault/DATA/dune_sql/rh/*.sql (DuneSQL -> Postgres)
import { q } from "./db";

const OTLM_SYRUPUSDG = "0x7be9a1fa4cd69f7a077692d4afa52bd09531920a";
const WETH_OTLM = "0xe3aac29001c769fafcef0df072ca396e310ed13b";
const EARN_VAULT = "0x44abc1d6ccff2696d98890b92e2157af242179c2";
const MARKET_SYRUPUSDG = "0x919a9b6b94dae7c86620eaf7a08e597aae8a4c3a9e9c7671771fbaf62b6b61c7";

// pg returns numerics as strings and dates as Date objects — normalise to number / "YYYY-MM-DD"
const num = (r: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(r).map(([k, v]) => [
      k,
      v instanceof Date ? v.toISOString().slice(0, 10)
      : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v)
      : v,
    ]),
  );

// 8760998 — syrup tokens circulating on Robinhood × exch_rate
export async function rhAum() {
  const rows = await q(`
    WITH supply AS (
      SELECT block_time::date AS day, token,
             SUM(CASE WHEN from_addr = '0x0000000000000000000000000000000000000000' THEN amount ELSE -amount END) AS net
      FROM rh_transfers WHERE token LIKE 'syrup%' GROUP BY 1, 2
    ),
    s AS (
      SELECT day, token,
             SUM(net) OVER (PARTITION BY token ORDER BY day) AS rh_supply
      FROM supply
    )
    SELECT s.day, s.token, s.rh_supply,
           COALESCE(p.exch_rate, 1) AS exch_rate,
           s.rh_supply * COALESCE(p.exch_rate, 1) AS aum_usd
    FROM s
    LEFT JOIN LATERAL (
      SELECT exch_rate FROM pool_state WHERE pool = s.token AND day <= s.day ORDER BY day DESC LIMIT 1
    ) p ON true
    ORDER BY s.day, s.token`);
  return rows.map(num);
}

// 8761939 — Earn vault allocation by collateral
export async function earnAllocation() {
  const rows = await q(`
    WITH daily AS (
      SELECT f.block_time::date AS day, COALESCE(m.collateral, left(m.collateral_token, 10)) AS collateral,
             SUM(CASE WHEN f.kind = 'supply' THEN f.assets ELSE -f.assets END) AS net
      FROM morpho_flows f JOIN morpho_markets m ON m.market_id = f.market_id
      WHERE f.on_behalf = $1
      GROUP BY 1, 2
    ),
    cumulative AS (
      SELECT day, collateral, GREATEST(SUM(net) OVER (PARTITION BY collateral ORDER BY day), 0) AS allocated_usdg FROM daily
    )
    SELECT day, collateral, allocated_usdg, SUM(allocated_usdg) OVER (PARTITION BY day) AS earn_tvl_usdg
    FROM cumulative ORDER BY day, allocated_usdg DESC`, [EARN_VAULT]);
  return rows.map(num);
}

// 8762071 — Maple share of Earn
export async function earnShare() {
  const rows = await q(`
    WITH daily AS (
      SELECT block_time::date AS day, market_id,
             SUM(CASE WHEN kind = 'supply' THEN assets ELSE -assets END) AS net
      FROM morpho_flows WHERE on_behalf = $1 GROUP BY 1, 2
    ),
    cumulative AS (
      SELECT day, market_id, GREATEST(SUM(net) OVER (PARTITION BY market_id ORDER BY day), 0) AS allocated_usdg FROM daily
    ),
    days AS (SELECT DISTINCT day FROM cumulative WHERE day >= '2026-07-02'),
    latest AS (
      SELECT d.day, c.market_id, c.allocated_usdg
      FROM days d JOIN LATERAL (
        SELECT DISTINCT ON (market_id) market_id, allocated_usdg FROM cumulative
        WHERE day <= d.day ORDER BY market_id, day DESC
      ) c ON true
    )
    SELECT day,
           SUM(CASE WHEN market_id = $2 THEN allocated_usdg END) AS maple_usdg,
           SUM(allocated_usdg) AS earn_tvl_usdg,
           SUM(CASE WHEN market_id = $2 THEN allocated_usdg END) / NULLIF(SUM(allocated_usdg), 0) AS maple_share_of_earn
    FROM latest GROUP BY day ORDER BY day`, [EARN_VAULT, MARKET_SYRUPUSDG]);
  return rows.map(num);
}

// 8761148 — interest / revenue weekly
export async function interestWeekly() {
  const rows = await q(`
    WITH w AS (
      SELECT date_trunc('week', block_time)::date AS week,
             SUM(net_interest) AS interest_to_depositors_usd,
             SUM(delegate_mgmt_fee + delegate_service_fee) AS delegate_fee_usd,
             SUM(platform_mgmt_fee + platform_service_fee) AS maple_fee_usd,
             SUM(net_interest + delegate_mgmt_fee + delegate_service_fee + platform_mgmt_fee + platform_service_fee) AS gross_interest_usd
      FROM claimed_funds WHERE otlm = $1 GROUP BY 1
    )
    SELECT week, interest_to_depositors_usd, delegate_fee_usd, maple_fee_usd, gross_interest_usd,
           maple_fee_usd / NULLIF(gross_interest_usd, 0) AS maple_take_rate,
           SUM(gross_interest_usd) OVER (ORDER BY week) AS cumulative_gross_interest_usd
    FROM w ORDER BY week`, [OTLM_SYRUPUSDG]);
  return rows.map(num);
}

// 8761208 — loans weekly
export async function loansWeekly() {
  const rows = await q(`
    WITH o AS (
      SELECT date_trunc('week', block_time)::date AS week,
             COUNT(*) AS loans_originated, COUNT(DISTINCT borrower) AS borrowers,
             SUM(principal) AS originated_usd, AVG(rate) AS avg_rate
      FROM loan_events WHERE kind = 'initialized' AND otlm = $1 GROUP BY 1
    ),
    x AS (
      SELECT DISTINCT ON (date_trunc('week', block_time)) date_trunc('week', block_time)::date AS week, principal_out AS principal_outstanding_usd
      FROM loan_events WHERE kind = 'principal_out' AND otlm = $1
      ORDER BY date_trunc('week', block_time), block_time DESC
    )
    SELECT COALESCE(o.week, x.week) AS week,
           COALESCE(o.loans_originated, 0) AS loans_originated,
           COALESCE(o.borrowers, 0) AS borrowers,
           COALESCE(o.originated_usd, 0) AS originated_usd,
           o.avg_rate, x.principal_outstanding_usd,
           SUM(COALESCE(o.originated_usd, 0)) OVER (ORDER BY COALESCE(o.week, x.week)) AS cumulative_originated_usd
    FROM o FULL OUTER JOIN x ON x.week = o.week
    ORDER BY 1`, [OTLM_SYRUPUSDG]);
  return rows.map(num);
}

// 8761205 — Maple share of Robinhood DeFi TVL (DeFiLlama)
export async function shareOfRhTvl() {
  const rows = await q(`
    WITH supply AS (
      SELECT block_time::date AS day,
             SUM(CASE WHEN from_addr = '0x0000000000000000000000000000000000000000' THEN amount ELSE -amount END) AS net
      FROM rh_transfers WHERE token = 'syrupUSDG' GROUP BY 1
    ),
    days AS (SELECT day FROM chain_tvl),
    maple AS (
      SELECT d.day,
             (SELECT SUM(net) FROM supply WHERE day <= d.day) * COALESCE(p.exch_rate, 1) AS maple_on_rh_usd
      FROM days d
      LEFT JOIN LATERAL (SELECT exch_rate FROM pool_state WHERE pool='syrupUSDG' AND day <= d.day ORDER BY day DESC LIMIT 1) p ON true
    )
    SELECT c.day, c.tvl_usd AS robinhood_chain_tvl_usd, m.maple_on_rh_usd,
           m.maple_on_rh_usd / NULLIF(c.tvl_usd, 0) AS maple_share_of_rh_tvl
    FROM chain_tvl c JOIN maple m ON m.day = c.day
    WHERE c.tvl_usd >= m.maple_on_rh_usd
    ORDER BY c.day`);
  return rows.map(num);
}

// pool state (syrupUSDG summary)
export async function poolState() {
  const rows = await q(`SELECT day, total_assets, total_supply, exch_rate FROM pool_state WHERE pool='syrupUSDG' ORDER BY day`);
  return rows.map(num);
}

// Maple share of USDG supply on Robinhood Chain (self-defined denominator: net-minted USDG)
export async function shareOfUsdg() {
  const rows = await q(`
    WITH s AS (
      SELECT block_time::date AS day, token,
             SUM(CASE WHEN from_addr = '0x0000000000000000000000000000000000000000' THEN amount ELSE -amount END) AS net
      FROM rh_transfers WHERE token IN ('USDG', 'syrupUSDG') GROUP BY 1, 2
    ),
    days AS (SELECT DISTINCT day FROM s WHERE day >= '2026-06-05'),
    c AS (
      SELECT d.day,
             (SELECT COALESCE(SUM(net), 0) FROM s WHERE token = 'USDG' AND day <= d.day) AS usdg_supply,
             (SELECT COALESCE(SUM(net), 0) FROM s WHERE token = 'syrupUSDG' AND day <= d.day) AS syrup_supply
      FROM days d
    )
    SELECT c.day, c.usdg_supply, c.syrup_supply * COALESCE(p.exch_rate, 1) AS maple_on_rh_usd,
           c.syrup_supply * COALESCE(p.exch_rate, 1) / NULLIF(c.usdg_supply, 0) AS maple_share_of_usdg
    FROM c
    LEFT JOIN LATERAL (SELECT exch_rate FROM pool_state WHERE pool = 'syrupUSDG' AND day <= c.day ORDER BY day DESC LIMIT 1) p ON true
    ORDER BY c.day`);
  return rows.map(num);
}

// syrupUSDG utilization: loans outstanding (PrincipalOutUpdated, forward-filled) / totalAssets, daily
export async function utilization() {
  const rows = await q(`
    SELECT p.day, p.total_assets, l.principal_out AS loans_outstanding,
           l.principal_out / NULLIF(p.total_assets, 0) AS utilization
    FROM pool_state p
    LEFT JOIN LATERAL (
      SELECT principal_out FROM loan_events WHERE kind = 'principal_out' AND otlm = $1 AND block_time::date <= p.day
      ORDER BY block_time DESC LIMIT 1
    ) l ON true
    WHERE p.pool = 'syrupUSDG' ORDER BY p.day`, [OTLM_SYRUPUSDG]);
  return rows.map(num);
}

// 8714671 — top loans by interest generated
export async function topLoans() {
  const rows = await q(`
    SELECT loan, COUNT(*) AS payments, SUM(principal) AS principal_usd,
           SUM(net_interest + delegate_mgmt_fee + delegate_service_fee + platform_mgmt_fee + platform_service_fee) AS interest_usd,
           SUM(platform_mgmt_fee + platform_service_fee) AS maple_revenue_usd,
           MIN(block_time)::date AS first_payment, MAX(block_time)::date AS last_payment
    FROM claimed_funds WHERE otlm = $1
    GROUP BY loan ORDER BY interest_usd DESC LIMIT 15`, [OTLM_SYRUPUSDG]);
  return rows.map(num);
}
