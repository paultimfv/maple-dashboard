// CSV for the Google Sheet (IMPORTDATA) and for cross-checking. No imports beyond the engine, so tests run it with node.
import { INPUTS, ROWS, COLS, type Actuals, type Col } from "./syrup-model.ts";

const num = (x: number | null | undefined) => (x == null || !isFinite(x) ? "" : String(Number(x.toPrecision(13))));
const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** row,key,label,value,as_of,unit,source — hardcoded actual rows of column E only */
export function actualsCsv(a: Actuals) {
  return ["row,key,label,value,as_of,unit,source",
    ...INPUTS.map((x) => [x.row, x.key, cell(x.label), num(a.E[x.row]), a.as_of, x.unit, x.source].join(","))].join("\n") + "\n";
}
/** row,key,label,c_2024 … i_2030 */
export function forecastCsv(cols: Col[]) {
  return [["row", "key", "label", ...COLS].join(","),
    ...ROWS.map((r) => [r.row, r.key, cell(r.label), ...cols.map((c) => num(c[r.row]))].join(","))].join("\n") + "\n";
}
