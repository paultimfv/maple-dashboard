/* Exhibit specs shared with the diagrams artifact (claude.ai/artifact/T8XcSHM4q9SMEsda6mjYNx).
   Coordinates are in a 760-wide viewBox. Edit here and in the artifact together. */
export type Kind = "rh" | "maple" | "morpho" | "syrup" | "infra" | "warn" | "plain";
export type ExNode = { id: string; x: number; y: number; w: number; h: number; t: string; sub?: string[]; kind?: Kind };
export type ExEdge = { from?: string; to?: string; pts?: number[][]; label?: string; lx?: number; ly?: number; anchor?: string;
  dash?: boolean; ym?: number; dx1?: number; dx2?: number; dy1?: number; dy2?: number; k0?: string; k1?: string };
export type ExhibitSpec = { nodes: ExNode[]; edges: ExEdge[]; groups?: { x: number; y: number; w: number; h: number; label: string }[];
  text?: { x: number; y: number; t: string; anchor?: string }[]; lines?: number[][] };

export const SPECS: Record<string, ExhibitSpec> = {
/* 1. Earn under the hood */
d1: {
  nodes: [
    { id: "u", x: 260, y: 14, w: 240, h: 52, t: "Robinhood app user", sub: ["Turns on Earn in the app"], kind: "rh" },
    { id: "usdg", x: 260, y: 104, w: 240, h: 52, t: "Buys USDG", sub: ["Paxos-issued regulated dollar"], kind: "infra" },
    { id: "w", x: 220, y: 194, w: 320, h: 62, t: "Self-custodial wallet", sub: ["Keys held in a TEE run by Privy;", "Robinhood can't access them"], kind: "rh" },
    { id: "v", x: 190, y: 296, w: 380, h: 62, t: "Steakhouse USDG vault (Robinhood Earn)", sub: ["ERC-4626 · $530M TVL", "Steakhouse sets risk, collateral and allocation"], kind: "morpho" },
    { id: "ad", x: 230, y: 398, w: 300, h: 52, t: "Morpho V2 adapter", sub: ["Spreads the vault across markets"], kind: "morpho" },
    { id: "m1", x: 20, y: 494, w: 160, h: 56, t: "USDe market", sub: ["66% of Earn"], kind: "morpho" },
    { id: "m2", x: 200, y: 494, w: 160, h: 56, t: "syrupUSDG market", sub: ["25% of Earn"], kind: "morpho" },
    { id: "m3", x: 380, y: 494, w: 160, h: 56, t: "mGLO market", sub: ["6% of Earn"], kind: "morpho" },
    { id: "m4", x: 560, y: 494, w: 160, h: 56, t: "spUSDG market", sub: ["2.5% of Earn"], kind: "morpho" },
    { id: "b", x: 170, y: 604, w: 420, h: 62, t: "Borrowers", sub: ["Post USDe, syrupUSDG, mGLO or spUSDG as collateral,", "borrow USDG and pay interest"], kind: "infra" },
  ],
  edges: [
    { from: "u", to: "usdg", label: "pays dollars" },
    { from: "usdg", to: "w", label: "held in" },
    { from: "w", to: "v", label: "signs deposit" },
    { from: "v", to: "ad", label: "supplies USDG" },
    { from: "ad", to: "m1", ym: 472 }, { from: "ad", to: "m2", ym: 472 }, { from: "ad", to: "m3", ym: 472 }, { from: "ad", to: "m4", ym: 472 },
    { from: "m1", to: "b", ym: 578 }, { from: "m2", to: "b", ym: 578, label: "lent as USDG", lx: 290, ly: 572 }, { from: "m3", to: "b", ym: 578 }, { from: "m4", to: "b", ym: 578 },
    { pts: [[590, 635], [742, 635], [742, 40], [500, 40]], dash: true, label: "interest back to Earn users", lx: 734, ly: 590, anchor: "end" },
  ],
},
/* 2. Robinhood Chain value flow */
d2: {
  nodes: [
    { id: "u", x: 240, y: 14, w: 280, h: 52, t: "Users and apps on Robinhood Chain", sub: ["Arbitrum Nitro L2 operated by Robinhood"], kind: "rh" },
    { id: "gas", x: 40, y: 118, w: 280, h: 52, t: "Gas fees (ETH)", sub: ["Wallet gas rebate ended Sep 29, 2026"], kind: "infra" },
    { id: "seq", x: 40, y: 218, w: 280, h: 52, t: "Sequencer", sub: ["Operated by Robinhood; collects gas"], kind: "rh" },
    { id: "l1", x: 14, y: 354, w: 230, h: 62, t: "L1 data cost", sub: ["Paid to Ethereum to post", "batches (SequencerInbox)"], kind: "infra" },
    { id: "rm", x: 265, y: 354, w: 230, h: 62, t: "Sequencer margin", sub: ["Gas minus L1 cost:", "Robinhood's take"], kind: "rh" },
    { id: "arb", x: 516, y: 354, w: 230, h: 62, t: "Arbitrum DAO", sub: ["10% of net revenue: 8% DAO,", "2% Developer Guild (AEP)"], kind: "infra" },
    { id: "a1", x: 450, y: 160, w: 128, h: 44, t: "Pons", sub: ["launchpad"], kind: "plain" },
    { id: "a2", x: 592, y: 160, w: 128, h: 44, t: "DEXs", sub: ["swap fees"], kind: "plain" },
    { id: "a3", x: 450, y: 222, w: 128, h: 44, t: "Morpho · Earn", sub: ["lending"], kind: "morpho" },
    { id: "a4", x: 592, y: 222, w: 128, h: 44, t: "Maple", sub: ["syrupUSDG"], kind: "maple" },
  ],
  groups: [{ x: 432, y: 118, w: 306, h: 164, label: "App fees · kept by each app" }],
  edges: [
    { from: "u", to: "gas", label: "pay gas" },
    { pts: [[480, 66], [480, 92], [585, 92], [585, 118]], label: "pay app fees", lx: 593, ly: 108 },
    { from: "gas", to: "seq" },
    { from: "seq", to: "l1", ym: 312, dash: true }, { from: "seq", to: "rm", ym: 312, dash: true }, { from: "seq", to: "arb", ym: 312, dash: true, label: "net revenue split", lx: 639, ly: 334 },
  ],
},
/* 3. Earn value flow */
d3: {
  nodes: [
    { id: "u", x: 40, y: 14, w: 260, h: 52, t: "Robinhood Earn users", sub: ["Supply USDG"], kind: "rh" },
    { id: "mk", x: 360, y: 14, w: 200, h: 52, t: "Merkl incentives", sub: ["Top-up rewards"], kind: "plain" },
    { id: "v", x: 40, y: 118, w: 260, h: 52, t: "Steakhouse vault", sub: ["Routes USDG to markets"], kind: "morpho" },
    { id: "m", x: 40, y: 222, w: 260, h: 62, t: "Morpho syrupUSDG market", sub: ["USDG lent against syrupUSDG", "(also USDe, mGLO, spUSDG)"], kind: "morpho" },
    { id: "b", x: 40, y: 344, w: 260, h: 62, t: "Borrower", sub: ["Posts syrupUSDG,", "borrows USDG"], kind: "infra" },
    { id: "p", x: 460, y: 344, w: 270, h: 62, t: "Maple syrupUSDG pool", sub: ["Ethereum · pays holders ~4.95%"], kind: "maple" },
    { id: "i", x: 460, y: 456, w: 270, h: 56, t: "Institutional borrowers", sub: ["Overcollateralized Maple loans"], kind: "infra" },
    { id: "cut", x: 460, y: 160, w: 270, h: 56, t: "Maple's cut", sub: ["13.1% of interest ≈ 0.746%/yr"], kind: "maple" },
  ],
  edges: [
    { from: "u", to: "v", label: "USDG" },
    { from: "v", to: "m" },
    { from: "m", to: "b", label: "lends USDG" },
    { from: "b", to: "p", label: "deposits USDG, gets syrupUSDG", dy1: 12, dy2: 12, ly: 400 },
    { pts: [[595, 344], [595, 252], [300, 252]], label: "syrupUSDG posted as collateral", lx: 448, ly: 244, anchor: "middle" },
    { from: "p", to: "i", label: "lends" },
    { from: "i", to: "p", dash: true, dx1: 70, dx2: 70, label: "interest", lx: 674 },
    { from: "p", to: "cut", dash: true, dx1: 105, dx2: 105, label: "fee", lx: 708, ly: 290 },
    { pts: [[40, 380], [18, 380], [18, 40], [40, 40]], dash: true, label: "borrow rate → users", lx: 26, ly: 330 },
    { from: "mk", to: "u", dash: true, label: "+ rewards" },
  ],
},
/* 4. Contract map */
d4: {
  nodes: [
    { id: "gov", x: 190, y: 14, w: 380, h: 52, t: "Governance", sub: ["DAO multisig · Governor · security and operational admins"], kind: "infra" },
    { id: "gl", x: 260, y: 104, w: 240, h: 52, t: "MapleGlobals", sub: ["Roles, fee rates, treasury address"], kind: "maple" },
    { id: "f", x: 190, y: 194, w: 380, h: 52, t: "Factories", sub: ["Deploy pool managers, loan managers and strategies"], kind: "maple" },
    { id: "r", x: 28, y: 322, w: 150, h: 52, t: "SyrupRouter", sub: ["Deposit entry"], kind: "maple" },
    { id: "p", x: 205, y: 322, w: 170, h: 52, t: "MaplePool", sub: ["ERC-4626 · holds deposits"], kind: "maple" },
    { id: "pm", x: 402, y: 322, w: 170, h: 52, t: "PoolManager", sub: ["Runs the pool"], kind: "maple" },
    { id: "wq", x: 598, y: 322, w: 140, h: 52, t: "Withdrawal queue", sub: ["Redemptions"], kind: "maple" },
    { id: "cv", x: 28, y: 432, w: 150, h: 52, t: "Delegate cover", sub: ["First-loss capital"], kind: "maple" },
    { id: "ot", x: 205, y: 432, w: 170, h: 52, t: "Open-term loans", sub: ["Splits each payment"], kind: "maple" },
    { id: "ft", x: 402, y: 432, w: 170, h: 52, t: "Fixed-term loans", sub: ["Older loan type"], kind: "maple" },
    { id: "st", x: 598, y: 432, w: 140, h: 52, t: "Strategies", sub: ["Aave / Sky"], kind: "maple" },
    { id: "ln", x: 130, y: 570, w: 230, h: 56, t: "Loan contracts", sub: ["One per loan → borrower"], kind: "infra" },
    { id: "tr", x: 420, y: 570, w: 230, h: 56, t: "MapleTreasury", sub: ["Receives platform fees"], kind: "maple" },
  ],
  groups: [{ x: 14, y: 280, w: 738, h: 222, label: "Repeated for each pool" }],
  edges: [
    { from: "gov", to: "gl", label: "sets" },
    { from: "gl", to: "f" },
    { from: "f", to: "pm", label: "deploys", ym: 264 },
    { from: "r", to: "p", label: "deposits" },
    { from: "p", to: "pm" },
    { from: "pm", to: "wq" },
    { from: "pm", to: "ot", ym: 404 }, { from: "pm", to: "ft" }, { from: "pm", to: "st", ym: 404 },
    { from: "ot", to: "ln", label: "funds loans", ym: 540, dx1: -30 },
    { from: "ot", to: "tr", dash: true, ym: 528, dx1: 30, label: "platform fee", lx: 545, ly: 524 },
    { from: "ft", to: "tr", dash: true, ym: 528 },
  ],
},
/* 5. Maple × Robinhood Chain */
d5: {
  text: [{ x: 20, y: 28, t: "Robinhood Chain" }, { x: 420, y: 28, t: "Ethereum" }],
  lines: [[380, 14, 380, 506]],
  nodes: [
    { id: "e", x: 20, y: 46, w: 320, h: 52, t: "Robinhood Earn vault", sub: ["Lends USDG into Morpho"], kind: "morpho" },
    { id: "m", x: 20, y: 146, w: 320, h: 52, t: "Morpho syrupUSDG market", sub: ["Borrowers post syrupUSDG"], kind: "morpho" },
    { id: "s", x: 20, y: 246, w: 320, h: 62, t: "syrupUSDG on Robinhood Chain", sub: ["$135.9M · 72% of all syrupUSDG"], kind: "maple" },
    { id: "c", x: 20, y: 356, w: 320, h: 52, t: "Chainlink CCIP", sub: ["Mints and burns syrupUSDG across chains"], kind: "infra" },
    { id: "p", x: 420, y: 46, w: 320, h: 62, t: "syrupUSDG pool", sub: ["$188.4M total · 0x87b6…cd7a"], kind: "maple" },
    { id: "ot", x: 420, y: 146, w: 320, h: 52, t: "Open-term loan manager", sub: ["0x7be9…920a"], kind: "maple" },
    { id: "l", x: 420, y: 246, w: 320, h: 62, t: "Institutional loans", sub: ["Borrowers pay ~5.70% gross"], kind: "infra" },
    { id: "h", x: 420, y: 356, w: 150, h: 62, t: "syrupUSDG holders", sub: ["86.9% of interest", "≈ 4.95% a year"], kind: "plain" },
    { id: "mp", x: 590, y: 356, w: 150, h: 62, t: "Maple", sub: ["13.1% of interest", "≈ 0.746% a year"], kind: "maple" },
    { id: "t", x: 590, y: 450, w: 150, h: 56, t: "MapleTreasury", sub: ["~$1.0M/yr from here"], kind: "maple" },
  ],
  edges: [
    { from: "e", to: "m", label: "USDG" },
    { from: "s", to: "m", label: "posted as collateral" },
    { from: "c", to: "s", label: "mints on Robinhood Chain" },
    { pts: [[340, 382], [400, 382], [400, 77], [420, 77]], label: "backed by pool shares", lx: 410, ly: 128 },
    { from: "p", to: "ot" },
    { from: "ot", to: "l", label: "lends" },
    { from: "l", to: "h", dash: true, ym: 332 }, { from: "l", to: "mp", dash: true, ym: 332, label: "interest split", lx: 673, ly: 326 },
    { from: "mp", to: "t" },
  ],
},
/* 6. SYRUP value flow */
d6: {
  nodes: [
    { id: "s1", x: 10, y: 14, w: 176, h: 62, t: "Open-term loan fees", sub: ["Inside each payment", "(platform + delegate)"], kind: "maple" },
    { id: "s2", x: 200, y: 14, w: 176, h: 62, t: "Fixed-term fees", sub: ["Service + origination"], kind: "maple" },
    { id: "s3", x: 390, y: 14, w: 176, h: 62, t: "Strategy fees", sub: ["Aave / Sky", "$0 since May 2026"], kind: "maple" },
    { id: "s4", x: 580, y: 14, w: 170, h: 62, t: "Offchain revenue", sub: ["OTC desk and other", "(Maple-reported)"], kind: "maple" },
    { id: "rev", x: 200, y: 124, w: 360, h: 62, t: "Maple monthly revenue", sub: ["Sep 2026: $1.57M (Maple-reported)", "Trailing 12 months: $22.3M"], kind: "maple" },
    { id: "mip", x: 50, y: 236, w: 310, h: 62, t: "MIP-021 buyback", sub: ["10% under $1.5M · 20% to $2M · 30% above", "Sep 2026 revenue → 20% tier (not yet paid)"], kind: "syrup" },
    { id: "rest", x: 410, y: 236, w: 310, h: 62, t: "Rest of revenue", sub: ["Maple DAO Foundation:", "operations and reserves"], kind: "maple" },
    { id: "bin", x: 50, y: 346, w: 310, h: 52, t: "Bought on Binance", sub: ["Executed on an exchange, not onchain"], kind: "infra" },
    { id: "wal", x: 50, y: 446, w: 310, h: 52, t: "Wallet 0x99f0…a9ca", sub: ["Receives each buyback (Jun–Aug matched)"], kind: "infra" },
    { id: "ssf", x: 50, y: 548, w: 310, h: 62, t: "Syrup Strategic Fund", sub: ["76.7M SYRUP + $4.9M liquid"], kind: "syrup" },
    { id: "circ", x: 410, y: 548, w: 310, h: 62, t: "Circulating supply", sub: ["1,244.7M total − 76.7M SSF = 1,168.0M"], kind: "syrup" },
    { id: "q", x: 410, y: 346, w: 310, h: 152, t: "Open question", sub: ["SSF held 76.1M SYRUP in Aug 2025", "and 76.7M today, while about 6M", "SYRUP was bought back in between.", "Bought-back tokens aren't", "accumulating in the SSF.", "Ask Maple on the Oct 13 call."], kind: "warn" },
  ],
  edges: [
    { from: "s1", to: "rev", ym: 100 }, { from: "s2", to: "rev", ym: 100 }, { from: "s3", to: "rev", ym: 100 }, { from: "s4", to: "rev", ym: 100 },
    { from: "rev", to: "mip", ym: 212, label: "tiered share" }, { from: "rev", to: "rest", ym: 212 },
    { from: "mip", to: "bin", label: "USD to buy SYRUP" },
    { from: "bin", to: "wal", label: "withdrawn to" },
    { from: "wal", to: "ssf" },
    { from: "ssf", to: "circ", label: "excluded from" },
  ],
},
};
