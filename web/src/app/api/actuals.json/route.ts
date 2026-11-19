// GET /api/actuals.json — the same rows as /api/actuals.csv, with the as-of date up top.
import { INPUTS } from "@/lib/syrup-model";
import { modelActuals } from "@/lib/model-actuals";

export function GET() {
  const a = modelActuals();
  return Response.json({ as_of: a.as_of, rows: INPUTS.map((x) => ({ ...x, value: a.E[x.row] })), history: { c_2024: a.C, d_2025: a.D } }, { headers: { "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400", "access-control-allow-origin": "*" } });
}
