// GET /api/forecast.csv?scenario=base|bear|bull — the engine's output, one row per model row, columns C–I. For cross-checking the sheet.
import { params, run, SCENARIOS, type Scenario, type Assumptions } from "@/lib/syrup-model";
import { forecastCsv } from "@/lib/model-csv";
import { modelActuals } from "@/lib/model-actuals";
import assumptions from "../../../../config/syrup-model-assumptions.json";

export function GET(request: Request) {
  const s = new URL(request.url).searchParams.get("scenario") ?? "base";
  const scenario = ((SCENARIOS as readonly string[]).includes(s) ? s : "base") as Scenario;
  const a = modelActuals();
  return new Response(forecastCsv(run(a, params(a, assumptions as Assumptions, scenario))), { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400", "access-control-allow-origin": "*" } });
}
