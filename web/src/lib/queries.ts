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

// ---- Earn depositors (Steakhouse USDG vault, ERC-4626) ----
export async function earnDepositors() {
  const rows = await q(`
    WITH w AS (
      SELECT date_trunc('week', block_time)::date AS week, owner,
             SUM(CASE WHEN kind = 'deposit' THEN assets ELSE -assets END) AS net,
             SUM(CASE WHEN kind = 'deposit' THEN assets END) AS deposited
      FROM earn_flows GROUP BY 1, 2
    ),
    first_seen AS (SELECT owner, MIN(week) AS cohort FROM w GROUP BY owner)
    SELECT w.week,
           COUNT(DISTINCT w.owner) AS active_users,
           COUNT(DISTINCT CASE WHEN f.cohort = w.week THEN w.owner END) AS new_users,
           SUM(w.deposited) AS deposited_usd,
           SUM(w.net) AS net_flow_usd,
           SUM(COUNT(DISTINCT CASE WHEN f.cohort = w.week THEN w.owner END)) OVER (ORDER BY w.week) AS cumulative_users
    FROM w JOIN first_seen f ON f.owner = w.owner
    GROUP BY w.week ORDER BY w.week`);
  return rows.map(num);
}

export async function earnDepositSizes() {
  const rows = await q(`
    SELECT COUNT(*) AS deposits, COUNT(DISTINCT owner) AS users,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY assets) AS median_deposit,
           AVG(assets) AS avg_deposit,
           percentile_cont(0.9) WITHIN GROUP (ORDER BY assets) AS p90_deposit
    FROM earn_flows WHERE kind = 'deposit'`);
  return rows.map(num)[0];
}

// ---- syrupUSDG bridge flow Ethereum <-> Robinhood (CCIP pool mints/burns), weekly ----
export async function bridgeFlow() {
  const rows = await q(`
    SELECT date_trunc('week', block_time)::date AS week,
           SUM(CASE WHEN from_addr = '0x0000000000000000000000000000000000000000' THEN amount END) AS bridged_in,
           SUM(CASE WHEN to_addr   = '0x0000000000000000000000000000000000000000' THEN amount END) AS bridged_out,
           SUM(CASE WHEN from_addr = '0x0000000000000000000000000000000000000000' THEN amount ELSE -amount END) AS net
    FROM rh_transfers WHERE token = 'syrupUSDG' GROUP BY 1 ORDER BY 1`);
  return rows.map(num);
}

// ---- SYRUP ----
export async function syrupPrice() {
  const rows = await q(`SELECT day, price_usd, mcap_usd, volume_usd FROM syrup_price ORDER BY day`);
  return rows.map(num);
}
export async function syrupBuybacks() {
  const rows = await q(`SELECT month, amount_usd, syrup_bought, avg_price FROM syrup_buybacks ORDER BY month`);
  return rows.map(num);
}

// ---- Revenue bridge: syrupUSDG monthly Maple revenue -> MIP-021 tier -> implied buyback ----
// MIP-021: 10% of monthly revenue < $1.5M, 20% $1.5–2M, 30% > $2M (on that month's total protocol revenue).
// Protocol-wide revenue needs all pools; here we show syrupUSDG's contribution and the share of Maple's on-chain fees it represents.
export async function revenueBridge() {
  const rows = await q(`
    WITH m AS (
      SELECT date_trunc('month', block_time)::date AS month,
             SUM(CASE WHEN otlm = $1 THEN platform_mgmt_fee + platform_service_fee END) AS syrupusdg_revenue,
             SUM(platform_mgmt_fee + platform_service_fee) AS onchain_revenue_all_pools,
             SUM(CASE WHEN otlm = $1 THEN net_interest + delegate_mgmt_fee + delegate_service_fee + platform_mgmt_fee + platform_service_fee END) AS syrupusdg_gross_interest
      FROM claimed_funds WHERE otlm <> $2 AND block_time >= '2026-05-01' GROUP BY 1
    )
    SELECT month, syrupusdg_revenue, onchain_revenue_all_pools, syrupusdg_gross_interest,
           syrupusdg_revenue / NULLIF(onchain_revenue_all_pools, 0) AS syrupusdg_share_of_onchain_rev,
           CASE WHEN onchain_revenue_all_pools > 2000000 THEN 0.30 WHEN onchain_revenue_all_pools >= 1500000 THEN 0.20 ELSE 0.10 END AS mip21_tier,
           onchain_revenue_all_pools * CASE WHEN onchain_revenue_all_pools > 2000000 THEN 0.30 WHEN onchain_revenue_all_pools >= 1500000 THEN 0.20 ELSE 0.10 END AS implied_buyback_onchain_only
    FROM m ORDER BY month`, [OTLM_SYRUPUSDG, WETH_OTLM]);
  return rows.map(num);
}

// ---- Robinhood Chain activity (sampled blocks, scaled to full day) ----
export async function chainActivity() {
  const rows = await q(`
    SELECT s.day,
           d.n_blocks,
           d.sampled,
           SUM(s.txs) * d.n_blocks / NULLIF(d.sampled, 0)                    AS txs_est,
           SUM(s.unique_from) * d.n_blocks / NULLIF(d.sampled, 0)            AS active_addr_est,   -- upper bound (per-block uniques)
           SUM(s.gas_used) * d.n_blocks / NULLIF(d.sampled, 0)               AS gas_est,
           SUM(s.fees_eth) * d.n_blocks / NULLIF(d.sampled, 0)               AS fees_eth_est,
           SUM(s.fees_eth) * d.n_blocks / NULLIF(d.sampled, 0) * e.price_usd AS fees_usd_est,
           AVG(s.base_fee) / 1e9                                             AS avg_base_fee_gwei
    FROM rh_block_samples s
    JOIN rh_day_blocks d ON d.day = s.day
    LEFT JOIN eth_price e ON e.day = s.day
    WHERE d.sampled >= 50
    GROUP BY s.day, d.n_blocks, d.sampled, e.price_usd ORDER BY s.day`);
  return rows.map(num);
}

// meme / launchpad share of activity: txs whose "to" is a launchpad contract, by week
export async function memeShare() {
  const rows = await q(`
    WITH t AS (
      SELECT date_trunc('week', s.day)::date AS week,
             CASE WHEN l.kind = 'launchpad_deployer' THEN 'launchpad'
                  WHEN l.kind = 'dex' THEN 'dex'
                  ELSE 'other' END AS bucket,
             SUM(b.txs) AS txs, SUM(b.gas_used) AS gas, SUM(b.fees_eth) AS fees
      FROM rh_block_to b JOIN rh_block_samples s ON s.block_number = b.block_number
      LEFT JOIN rh_labels l ON l.address = b.to_addr
      GROUP BY 1, 2
    )
    SELECT week, bucket, txs, gas, fees,
           txs::numeric / NULLIF(SUM(txs) OVER (PARTITION BY week), 0) AS tx_share,
           gas::numeric / NULLIF(SUM(gas) OVER (PARTITION BY week), 0) AS gas_share,
           fees / NULLIF(SUM(fees) OVER (PARTITION BY week), 0) AS fee_share
    FROM t ORDER BY week, bucket`);
  return rows.map(num);
}

// top contracts by gas (sampled), last 30 days — for labeling and the "who pays the gas" table
export async function topContracts() {
  const rows = await q(`
    SELECT b.to_addr, COALESCE(l.label, '') AS label, COALESCE(l.kind, '') AS kind,
           SUM(b.txs) AS txs, SUM(b.gas_used) AS gas, SUM(b.fees_eth) AS fees_eth,
           SUM(b.gas_used)::numeric / NULLIF(SUM(SUM(b.gas_used)) OVER (), 0) AS gas_share
    FROM rh_block_to b JOIN rh_block_samples s ON s.block_number = b.block_number
    LEFT JOIN rh_labels l ON l.address = b.to_addr
    WHERE s.day >= CURRENT_DATE - 30
    GROUP BY 1, 2, 3 ORDER BY gas DESC LIMIT 20`);
  return rows.map(num);
}

// chain economics: L2 fee revenue (est) vs L1 posting cost, weekly
export async function chainEconomics() {
  const rows = await q(`
    WITH l2 AS (
      SELECT date_trunc('week', s.day)::date AS week,
             SUM(s.fees_eth * d.n_blocks / NULLIF(d.sampled, 0)) AS l2_fees_eth,
             SUM(s.fees_eth * d.n_blocks / NULLIF(d.sampled, 0) * e.price_usd) AS l2_fees_usd
      FROM rh_block_samples s JOIN rh_day_blocks d ON d.day = s.day LEFT JOIN eth_price e ON e.day = s.day
      WHERE d.sampled >= 50 GROUP BY 1
    ),
    l1 AS (
      SELECT date_trunc('week', b.block_time)::date AS week, SUM(b.fee_eth) AS l1_cost_eth, SUM(b.fee_eth * e.price_usd) AS l1_cost_usd, COUNT(*) AS batches
      FROM rh_l1_batches b LEFT JOIN eth_price e ON e.day = b.block_time::date GROUP BY 1
    )
    SELECT COALESCE(l2.week, l1.week) AS week, l2.l2_fees_eth, l2.l2_fees_usd, l1.l1_cost_eth, l1.l1_cost_usd, l1.batches,
           l2.l2_fees_usd - COALESCE(l1.l1_cost_usd, 0) AS net_usd,
           (l2.l2_fees_usd - COALESCE(l1.l1_cost_usd, 0)) / NULLIF(l2.l2_fees_usd, 0) AS margin
    FROM l2 FULL OUTER JOIN l1 ON l1.week = l2.week ORDER BY 1`);
  return rows.map(num);
}
