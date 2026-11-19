// GET /api/assumptions.json — the assumption cells and rules the dashboard's model runs on (a copy of the sheet's).
import assumptions from "../../../../config/syrup-model-assumptions.json";

export function GET() {
  return Response.json(assumptions, { headers: { "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400", "access-control-allow-origin": "*" } });
}
