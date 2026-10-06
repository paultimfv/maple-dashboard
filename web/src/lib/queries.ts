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
    SELECT u.day, u.supply AS usdg_supply, y.supply * COALESCE(p.exch_rate, 1) AS maple_on_rh_usd,
           y.supply * COALESCE(p.exch_rate, 1) / NULLIF(u.supply, 0) AS maple_share_of_usdg
    FROM rh_stable_supply u
    JOIN rh_stable_supply y ON y.day = u.day AND y.token = 'syrupUSDG'
    LEFT JOIN LATERAL (SELECT exch_rate FROM pool_state WHERE pool = 'syrupUSDG' AND day <= u.day ORDER BY day DESC LIMIT 1) p ON true
    WHERE u.token = 'USDG' AND u.supply > 0 AND y.supply > 0
    ORDER BY u.day`);
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
// Protocol-wide revenue needs all pools; here we show syrupUSDG's contribution and the share of Maple's onchain fees it represents.
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


// ---- Robinhood Chain macro (DeFiLlama, source-labeled) ----
const FINANCE_CATS = `'Lending','RWA','Yield','Yield Aggregator','Risk Curators','Onchain Capital Allocator','Uncollateralized Lending','Payments'`;
export async function llamaChain() {
  const rows = await q(`SELECT day, tvl_usd, fees_usd, revenue_usd, dex_volume_usd, sequencer_fees_usd FROM llama_chain_daily WHERE day >= '2026-05-01' ORDER BY day`);
  return rows.map(num);
}

// chain fees by bucket, weekly: speculation (dex/launchpad/meme/bots/perps/NFT) vs finance (lending/RWA/yield)
// vs other (bridges, wallets, interfaces, AI agents, indexes — ~1% of fees; shown muted, on top of the stack)
export async function llamaFeesByBucket() {
  const rows = await q(`
    WITH b AS (
      SELECT date_trunc('week', day)::date AS week,
             CASE WHEN category IN ('Dexs','DEX Aggregator','Derivatives','Prediction Market','Launchpad','Meme','Telegram Bot','Gamified Mining','Luck Games','Volume Boosting','Trading App','NFT Marketplace') THEN 'speculation'
                  WHEN category IN (${FINANCE_CATS}) THEN 'finance'
                  ELSE 'other' END AS bucket,
             SUM(value_usd) AS fees_usd
      FROM llama_protocol_daily WHERE metric = 'fees' AND day >= '2026-05-01'
      GROUP BY 1, 2
    )
    SELECT week, bucket, fees_usd, fees_usd / NULLIF(SUM(fees_usd) OVER (PARTITION BY week), 0) AS share
    FROM b ORDER BY week, CASE bucket WHEN 'speculation' THEN 1 WHEN 'finance' THEN 2 ELSE 3 END`);
  return rows.map(num);
}

// lending / earn products only (the Morpho / Steakhouse / Maple side of the chain), last 7 days
export async function llamaFinanceProtocols() {
  const rows = await q(`
    SELECT protocol, category,
           SUM(CASE WHEN metric='fees' THEN value_usd END) AS fees_7d,
           SUM(CASE WHEN metric='revenue' THEN value_usd END) AS revenue_7d,
           SUM(CASE WHEN metric='fees' THEN value_usd END) / NULLIF(SUM(SUM(CASE WHEN metric='fees' THEN value_usd END)) OVER (), 0) AS fee_share
    FROM llama_protocol_daily WHERE day >= CURRENT_DATE - 7 AND category IN (${FINANCE_CATS})
    GROUP BY 1, 2 ORDER BY fees_7d DESC NULLS LAST LIMIT 10`);
  return rows.map(num);
}

// lending / earn protocol fees, weekly, by protocol (stacked columns on the page)
export async function llamaFinanceWeekly() {
  const rows = await q(`
    SELECT date_trunc('week', day)::date AS week, protocol, SUM(value_usd) AS fees_usd
    FROM llama_protocol_daily WHERE metric = 'fees' AND category IN (${FINANCE_CATS}) AND day >= '2026-05-01'
    GROUP BY 1, 2 HAVING SUM(value_usd) > 0 ORDER BY 1, 2`);
  return rows.map(num);
}

// ---- Tokenization / RWA on Robinhood Chain ----
// Robinhood stock tokens: supply (shares) by token, latest
export async function stockTokens() {
  const rows = await q(`
    SELECT t.symbol, t.name, t.address,
           SUM(CASE WHEN f.kind = 'mint' THEN f.amount ELSE -f.amount END) AS shares_outstanding,
           SUM(CASE WHEN f.kind = 'mint' THEN f.amount END) AS minted, SUM(CASE WHEN f.kind = 'burn' THEN f.amount END) AS burned,
           COUNT(*) AS events, MIN(f.block_time)::date AS first_mint
    FROM stock_token_flows f JOIN rh_tokens t ON t.address = f.token
    GROUP BY 1, 2, 3 HAVING SUM(CASE WHEN f.kind = 'mint' THEN f.amount ELSE -f.amount END) > 0
    ORDER BY shares_outstanding DESC`);
  return rows.map(num);
}
export async function stockTokensWeekly() {
  const rows = await q(`
    WITH w AS (
      SELECT date_trunc('week', block_time)::date AS week,
             SUM(CASE WHEN kind = 'mint' THEN amount END) AS minted, SUM(CASE WHEN kind = 'burn' THEN amount END) AS burned,
             COUNT(DISTINCT token) AS active_tokens
      FROM stock_token_flows GROUP BY 1
    )
    SELECT week, minted, burned, active_tokens,
           SUM(COALESCE(minted,0) - COALESCE(burned,0)) OVER (ORDER BY week) AS cumulative_shares,
           (SELECT COUNT(DISTINCT token) FROM stock_token_flows s WHERE s.block_time < w.week + 7) AS tokens_launched
    FROM w ORDER BY week`);
  return rows.map(num);
}
// Credit against tokenized stocks: USDG borrowed in Morpho markets whose collateral is a Robinhood stock token
export async function stockCredit() {
  const rows = await q(`
    SELECT m.collateral,
           SUM(CASE WHEN c.kind = 'borrow' THEN c.amount WHEN c.kind = 'repay' THEN -c.amount END) AS net_borrowed_usdg,
           SUM(CASE WHEN c.kind = 'borrow' THEN c.amount END) AS gross_borrowed_usdg,
           SUM(CASE WHEN c.kind = 'supply_collateral' THEN c.amount WHEN c.kind = 'withdraw_collateral' THEN -c.amount END) AS collateral_shares,
           COUNT(DISTINCT CASE WHEN c.kind = 'borrow' THEN c.on_behalf END) AS borrowers,
           COUNT(DISTINCT m.market_id) AS markets
    FROM morpho_credit c JOIN morpho_markets m ON m.market_id = c.market_id JOIN rh_tokens t ON t.address = m.collateral_token
    WHERE t.name LIKE '%• Robinhood Token'
    GROUP BY 1 ORDER BY net_borrowed_usdg DESC NULLS LAST LIMIT 15`);
  return rows.map(num);
}
export async function stockCreditWeekly() {
  const rows = await q(`
    WITH w AS (
      SELECT date_trunc('week', c.block_time)::date AS week,
             CASE WHEN t.name LIKE '%• Robinhood Token' THEN 'tokenized stocks'
                  WHEN m.collateral IN ('syrupUSDG','USDe','spUSDG','mGLO') THEN 'yield / credit tokens'
                  ELSE 'other' END AS bucket,
             SUM(CASE WHEN c.kind = 'borrow' THEN c.amount WHEN c.kind = 'repay' THEN -c.amount END) AS net
      FROM morpho_credit c JOIN morpho_markets m ON m.market_id = c.market_id LEFT JOIN rh_tokens t ON t.address = m.collateral_token
      WHERE c.kind IN ('borrow', 'repay') GROUP BY 1, 2
    )
    SELECT week, bucket, GREATEST(SUM(net) OVER (PARTITION BY bucket ORDER BY week), 0) AS borrowed_outstanding_usdg FROM w ORDER BY week, bucket`);
  return rows.map(num);
}
// Earn vault allocation now includes mGLO (Midas) — the "RWA credit" collaterals
export async function earnRwaShare() {
  const rows = await q(`
    WITH cum AS (
      SELECT m.collateral, SUM(CASE WHEN f.kind = 'supply' THEN f.assets ELSE -f.assets END) AS a
      FROM morpho_flows f JOIN morpho_markets m ON m.market_id = f.market_id WHERE f.on_behalf = $1 GROUP BY 1
    )
    SELECT collateral, GREATEST(a, 0) AS allocated_usdg, GREATEST(a, 0) / NULLIF(SUM(GREATEST(a, 0)) OVER (), 0) AS share FROM cum ORDER BY a DESC`, [EARN_VAULT]);
  return rows.map(num);
}


// ---- Raw chain data: Blockscout stats-service + canonical bridge (no DeFiLlama) ----
// daily activity; today excluded (partial day)
export async function bsChain() {
  const rows = await q(`
    SELECT b.day, b.txns, b.active_accounts, b.new_accounts, b.new_contracts, b.user_ops, b.new_aa_wallets, b.success_rate,
           b.fees_eth, b.fees_eth * p.price_usd AS fees_usd,
           l.l1_eth * p.price_usd AS l1_cost_usd,
           (b.fees_eth - COALESCE(l.l1_eth, 0)) * p.price_usd AS sequencer_margin_usd
    FROM bs_chain_daily b
    LEFT JOIN eth_price p ON p.day = b.day
    LEFT JOIN (SELECT block_time::date AS day, SUM(fee_eth) AS l1_eth FROM rh_l1_batches GROUP BY 1) l ON l.day = b.day
    WHERE b.day >= '2026-05-11' AND b.day < CURRENT_DATE ORDER BY b.day`);
  return rows.map(num);
}

// capital on the chain, two ways: ETH in the L1 bridge (onchain) + USDG minted natively, vs DeFiLlama's protocol-sum TVL
export async function capitalOnChain() {
  const rows = await q(`
    WITH syrup AS (
      SELECT block_time::date AS day, SUM(CASE WHEN from_addr = '0x0000000000000000000000000000000000000000' THEN amount ELSE -amount END) AS net
      FROM rh_transfers WHERE token = 'syrupUSDG' GROUP BY 1
    )
    SELECT b.day, b.eth_bridged, b.eth_bridged * p.price_usd AS eth_bridged_usd,
           COALESCE(u.supply, 0) AS usdg_native,
           b.eth_bridged * p.price_usd + COALESCE(u.supply, 0) AS capital_onchain_usd,
           t.tvl_usd AS llama_tvl_usd,
           (SELECT COALESCE(SUM(net), 0) FROM syrup WHERE day <= b.day) * COALESCE(ps.exch_rate, 1) AS maple_on_rh_usd,
           (SELECT COALESCE(SUM(net), 0) FROM syrup WHERE day <= b.day) * COALESCE(ps.exch_rate, 1)
             / NULLIF(b.eth_bridged * p.price_usd + COALESCE(u.supply, 0), 0) AS maple_share_of_capital,
           (SELECT COALESCE(SUM(net), 0) FROM syrup WHERE day <= b.day) * COALESCE(ps.exch_rate, 1) / NULLIF(t.tvl_usd, 0) AS maple_share_of_llama_tvl
    FROM bridge_tvl b
    LEFT JOIN eth_price p ON p.day = b.day
    LEFT JOIN chain_tvl t ON t.day = b.day
    LEFT JOIN rh_stable_supply u ON u.day = b.day AND u.token = 'USDG'
    LEFT JOIN LATERAL (SELECT exch_rate FROM pool_state WHERE pool = 'syrupUSDG' AND day <= b.day ORDER BY day DESC LIMIT 1) ps ON true
    WHERE b.day >= '2026-06-05' ORDER BY b.day`);
  return rows.map(num);
}

// holder counts (Blockscout REST), latest snapshot
export async function holders() {
  const rows = await q(`
    SELECT token, address, holders, transfers FROM bs_holders WHERE day = (SELECT MAX(day) FROM bs_holders) ORDER BY holders DESC`);
  return rows.map(num);
}

// stablecoin supply on Robinhood Chain, daily totalSupply() per canonical contract (spUSDG wraps USDG: shown, not summed)
export async function stableSupply() {
  const rows = await q(`SELECT day, token, kind, supply FROM rh_stable_supply WHERE supply > 0 AND token <> 'spUSDG' ORDER BY day, token`);
  return rows.map(num);
}
export async function stableSupplyLatest() {
  const rows = await q(`
    SELECT token, kind, supply FROM rh_stable_supply WHERE day = (SELECT MAX(day) FROM rh_stable_supply WHERE token = 'USDG') ORDER BY supply DESC`);
  return rows.map(num);
}

// ---- Maple protocol economics (pipeline views: monthly_revenue, monthly_model, aum_monthly, annual_model_inputs) ----
// Every onchain line is rebuilt from contract events; offchain = OTC desk (Maple-published, to May 2026),
// then implied from onchain MIP-021 buybacks (buyback ÷ tier − onchain fees).
export async function mapleRevenueMonthly() {
  const rows = await q(`
    SELECT month, open_term_platform + open_term_delegate AS open_term_loans, fixed_term AS fixed_term_loans,
           strategy AS strategies, offchain_revenue AS otc_offchain, onchain_revenue, total_revenue, offchain_unknown
    FROM monthly_revenue WHERE month >= '2024-01-01' AND month < date_trunc('month', now()) ORDER BY month`);
  return rows.map(num);
}
export async function mapleModelMonthly() {
  const rows = await q(`SELECT * FROM monthly_model WHERE month >= '2024-01-01' AND month < date_trunc('month', now()) ORDER BY month`);
  return rows.map(num);
}
export async function mapleAumByPool() {
  const rows = await q(`SELECT date_trunc('month', month_end)::date AS day, pool, aum_usd FROM aum_monthly WHERE month_end >= '2024-01-01' ORDER BY month_end, pool`);
  return rows.map(num);
}
export async function mapleAumLatest() {
  const rows = await q(`
    SELECT pool, total_assets AS aum_usd, day FROM pool_state
    WHERE day = (SELECT max(day) FROM pool_state) AND pool NOT IN ('High Yield Corporate Loan WETH', 'Maven11 WETH') AND total_assets > 1000
    ORDER BY total_assets DESC`);
  return rows.map(num);
}
export async function annualInputs() {
  const rows = await q(`SELECT *, mcap_year_end / NULLIF(total_revenue, 0) AS ps FROM annual_model_inputs WHERE year >= 2024 ORDER BY year`);
  return rows.map(num);
}
export async function syrupSupply() {
  const rows = await q(`SELECT day, total_supply, maple_held, total_supply - maple_held AS circulating FROM syrup_supply ORDER BY day`);
  return rows.map(num);
}

// ---- Macro ----
export async function stablecoinSupplyGlobal() {
  const rows = await q(`SELECT day, supply_usd FROM stablecoin_supply WHERE day >= '2020-01-01' AND extract(dow FROM day) = 0 ORDER BY day`);
  return rows.map(num);
}

// ---- From the author's Dune exports (schema `dune`, static history to Sep 2026) ----
// Maple-reported AUM = lender deposits + borrower collateral (collateral sits with custodians, not in pool contracts)
export async function mapleAumReported() {
  const rows = await q(`
    SELECT date::date AS day, deposits_usd, collateral_usd, deposits_usd + collateral_usd AS aum_usd
    FROM dune.pool_aum_vs_deposits_over_time_protocol_totals
    WHERE extract(dow FROM date::date) = 0 OR date::date = (SELECT max(date::date) FROM dune.pool_aum_vs_deposits_over_time_protocol_totals)
    ORDER BY 1`);
  return rows.map(num);
}
export async function poolsSnapshot() {
  const rows = await q(`SELECT * FROM dune.pools_snapshot ORDER BY is_total, tvl DESC`);
  return rows.map(num);
}

// ---- Lenders and borrowers (rebuilt from contracts; replaces Dune 8714452 / 8714541) ----
export async function mapleLenders() {
  const rows = await q(`SELECT month, active_lenders, new_lenders, cumulative_lenders, deposits, deposited_usd FROM monthly_lenders WHERE month >= '2024-01-01' AND month < date_trunc('month', now()) ORDER BY month`);
  return rows.map(num);
}
export async function mapleBorrowers() {
  const rows = await q(`SELECT month, active_borrowers, new_borrowers, cumulative_borrowers, active_loans, interest_paid_usd FROM monthly_borrowers WHERE month >= '2024-01-01' AND month < date_trunc('month', now()) ORDER BY month`);
  return rows.map(num);
}
