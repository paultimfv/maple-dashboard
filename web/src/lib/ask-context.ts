// Turns the dashboard's datasets into compact text for the public "Ask AI" box (the assistant lives on Paul HQ, /api/ask).
// Long daily series are thinned to at most `max` rows (always keeping the latest), numbers are rounded.
type Row = Record<string, unknown>;

const round = (v: unknown) => {
  if (typeof v !== "number" || !isFinite(v)) return v == null ? "" : String(v).replace(/[\n,]/g, " ");
  const a = Math.abs(v);
  return a >= 1000 ? String(Math.round(v)) : a >= 1 ? String(+v.toFixed(3)) : String(+v.toPrecision(4));
};

export function table(title: string, rows: Row[], opts: { max?: number; recent?: number; note?: string; cols?: string[] } = {}) {
  if (!rows?.length) return `## ${title}\n(no data)\n`;
  const max = opts.max ?? 120, cols = opts.cols ?? Object.keys(rows[0]);
  // older rows thinned to fit `max`; the latest `recent` rows always kept in full
  let keep = rows, step = 1;
  const recent = Math.min(opts.recent ?? 30, rows.length);
  if (rows.length > max) {
    const old = rows.slice(0, rows.length - recent);
    step = Math.ceil(old.length / Math.max(1, max - recent));
    keep = [...old.filter((_, i) => i % step === 0), ...rows.slice(rows.length - recent)];
  }
  const thinned = step > 1 ? ` (${rows.length} rows: 1 in ${step} shown, the latest ${recent} in full)` : "";
  return [`## ${title}${thinned}`, opts.note ?? "", cols.join(","), ...keep.map((r) => cols.map((c) => round(r[c])).join(","))].filter(Boolean).join("\n") + "\n";
}

export const contextResponse = (parts: string[]) =>
  new Response(parts.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });

// Any JSON (a data file, a loader's result) → text: scalars as "path: value" lines, arrays of objects as tables.
export function fromJson(title: string, obj: unknown, opts: { max?: number; skip?: string[] } = {}) {
  const lines: string[] = [], tables: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (opts.skip?.some((s) => path === s || path.startsWith(s + "."))) return;
    if (Array.isArray(v)) {
      if (v.length && v[0] && typeof v[0] === "object" && !Array.isArray(v[0])) tables.push(table(`${title}: ${path}`, v as Row[], { max: opts.max }));
      else lines.push(`${path}: ${v.slice(0, 200).map(round).join(", ")}${v.length > 200 ? " …" : ""}`);
    } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
    else lines.push(`${path}: ${round(v)}`);
  };
  walk(obj, "");
  return [`## ${title}`, ...lines, "", ...tables].join("\n") + "\n";
}
