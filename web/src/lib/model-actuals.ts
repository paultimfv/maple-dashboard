// The model's 2026 actuals (column E) and the 2024/2025 columns. One month-end snapshot, never mixed with intra-day prints:
// flow items (revenue, buybacks) run to the as-of month-end, and stock items (deposits, loans, stables, collateral) are read on it.
// Row 48 is the 2026 reference price ($0.1354, near the average buyback price), not CoinGecko spot; 43 and 46 are the same month-end's.
// Today this is the sheet's 31 Oct 2026 snapshot. Moving to a later month-end changes the 2030 price on the sheet and here together.
import { FIXTURE, type Actuals } from "./syrup-model.ts";

export function modelActuals(): Actuals {
  return FIXTURE;
}
