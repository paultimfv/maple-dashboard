// GET /api/model — every line of the SYRUP model, from the pipeline's model_ledger.
//   ?period=year (default) | quarter | month    ?from=2024-01-01    ?format=csv (default) | json
// Google Sheets: =IMPORTDATA("https://maple.paultimofeev.com/api/model?period=year")
import { modelLedger, aggregate, toCsv, METRICS, type Period } from "@/lib/model-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const u = new URL(request.url);
  const period = (["year", "quarter", "month"].includes(u.searchParams.get("period") ?? "") ? u.searchParams.get("period") : "year") as Period;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get("from") ?? "") ? u.searchParams.get("from")! : "2024-01-01";
  const periods = aggregate(await modelLedger(), period, from);
  if (u.searchParams.get("format") === "json") return Response.json({ period, from, metrics: METRICS, periods });
  return new Response(toCsv(periods), {
    headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
