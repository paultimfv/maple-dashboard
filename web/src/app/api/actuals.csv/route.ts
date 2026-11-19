// GET /api/actuals.csv — the model's hardcoded actual rows for column E, one row each: row,key,label,value,as_of,unit,source.
// Google Sheet, hidden tab "Actuals": =IMPORTDATA("https://maple.paultimofeev.com/api/actuals.csv"), then
// Model!E{row}: =VALUE(VLOOKUP(ROW(),Actuals!$A:$D,4,FALSE)). Formula rows (5, 7, 9, 12, 16, 18, 19, 35, 36, 38, 39, 41, 47) are not emitted.
import { actualsCsv } from "@/lib/model-csv";
import { modelActuals } from "@/lib/model-actuals";

export function GET() {
  return new Response(actualsCsv(modelActuals()), { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400", "access-control-allow-origin": "*" } });
}
