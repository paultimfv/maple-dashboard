"use client";
import { useEffect, useRef, useState } from "react";
import { usePalette } from "@/components/charts";
import { SPECS, type ExhibitSpec, type Kind } from "@/lib/exhibits";

const NS = "http://www.w3.org/2000/svg";
const FONT = "var(--font-body), -apple-system, sans-serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";

/* entity colors, same as the charts: Robinhood green, Maple coral, Morpho/Steakhouse blue, SYRUP rust */
const KIND = {
  light: { rh: "#6e9e00", maple: "#f26b3a", morpho: "#2b6cb0", syrup: "#a8402a", infra: "#8a8683", warn: "#e8a33a" },
  dark: { rh: "#a6d400", maple: "#e8663a", morpho: "#4b8fe0", syrup: "#c4503a", infra: "#8d8681", warn: "#bf8418" },
};

function el(tag: string, attrs: Record<string, string | number>, parent?: Element) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e as SVGGraphicsElement;
}

type Colors = { ink: string; ink2: string; muted: string; surface: string; line: string; kinds: Record<Exclude<Kind, "plain">, string> };

/* ticker codes: by entity, with plain-language codes for infrastructure nodes */
const CODE_BY_KIND: Record<Kind, string> = { rh: "RH", morpho: "MRP", maple: "MPL", syrup: "SYR", infra: "INF", warn: "?", plain: "—" };
const CODE_BY_TITLE: [string, string][] = [["Steakhouse", "STK"], ["Robinhood Earn vault", "STK"], ["Buys USDG", "USDG"], ["Borrower", "BRW"], ["Institutional borrowers", "BRW"],
  ["Gas fees", "GAS"], ["L1 data cost", "ETH"], ["Arbitrum DAO", "ARB"], ["Pons", "APP"], ["DEXs", "APP"], ["Merkl", "MRKL"], ["Governance", "DAO"],
  ["Loan contracts", "LOAN"], ["Institutional loans", "LOAN"], ["Chainlink CCIP", "LINK"], ["syrupUSDG holders", "LP"], ["Bought on Binance", "CEX"],
  ["Wallet 0x", "WLT"], ["Open question", "?"], ["USDe market", "ENA"], ["mGLO market", "MRP"], ["spUSDG market", "MRP"]];
const code = (n: { t: string; kind?: Kind }) => CODE_BY_TITLE.find(([t]) => n.t.startsWith(t))?.[1] ?? CODE_BY_KIND[n.kind ?? "plain"];
/* readable text on a filled tag: dark ink on light fills (lime), white on the rest */
const inkOn = (hex: string) => { const v = parseInt(hex.replace("#", ""), 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#141414" : "#ffffff"; };
/* shrink a text line until it fits its box (never clip) */
function fit(t: SVGTextElement, str: string, room: number, size: number) {
  t.textContent = str;
  try { while (t.getComputedTextLength() > room && size > 8) { size -= 0.5; t.setAttribute("font-size", String(size)); } } catch {}
}

/** Draws one exhibit into an <svg>. Same layout engine as the artifact; colors are written as attributes. */
function draw(svg: SVGSVGElement, id: string, spec: ExhibitSpec, c: Colors) {
  svg.replaceChildren();
  const kc = (k?: Kind) => (!k || k === "plain" ? c.muted : c.kinds[k]);
  const defs = el("defs", {}, svg);
  ([["solid", c.ink2], ["dash", c.muted]] as const).forEach(([k, col]) => {
    const m = el("marker", { id: `${id}-a-${k}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse", markerUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M0,1 L10,5 L0,9 z", fill: col }, m);
  });
  const vbw = 760, vbh = Number(svg.viewBox.baseVal.height) || 700;
  const pat = el("pattern", { id: `${id}-dots`, width: 16, height: 16, patternUnits: "userSpaceOnUse" }, defs);
  el("circle", { cx: 1, cy: 1, r: 0.8, fill: c.line, "fill-opacity": 0.6 }, pat);
  svg.insertBefore(el("rect", { x: 0, y: 0, width: vbw, height: vbh, fill: `url(#${id}-dots)` }), defs.nextSibling);
  type N = ExhibitSpec["nodes"][number] & { cx: number; cy: number };
  const N: Record<string, N> = {};
  spec.nodes.forEach((n) => { N[n.id] = { ...n, cx: n.x + n.w / 2, cy: n.y + n.h / 2 }; });
  const L = { grp: el("g", {}, svg), dec: el("g", {}, svg), edge: el("g", {}, svg), node: el("g", {}, svg), lab: el("g", {}, svg) };

  (spec.groups ?? []).forEach((g) => {
    el("rect", { x: g.x, y: g.y, width: g.w, height: g.h, rx: 3, fill: "none", stroke: c.line, "stroke-width": 1, "stroke-dasharray": "3 4" }, L.grp);
    el("text", { x: g.x + 12, y: g.y + 18, fill: c.muted, "font-family": MONO, "font-size": 10, "letter-spacing": ".06em" }, L.grp).textContent = g.label.toUpperCase();
  });
  (spec.text ?? []).forEach((t) => {
    el("text", { x: t.x, y: t.y, fill: c.muted, "font-family": MONO, "font-size": 11, "letter-spacing": ".08em", "text-anchor": t.anchor ?? "start" }, L.dec).textContent = t.t.toUpperCase();
  });
  (spec.lines ?? []).forEach((l) => el("line", { x1: l[0], y1: l[1], x2: l[2], y2: l[3], stroke: c.line, "stroke-width": 1 }, L.dec));

  const labels: { t: string; x: number; y: number; anchor: string; ei: number }[] = [];
  const hit = (p: number[]) => Object.values(N).find((n) => p[0] >= n.x - 6 && p[0] <= n.x + n.w + 6 && p[1] >= n.y - 6 && p[1] <= n.y + n.h + 6)?.id ?? "";
  spec.edges.forEach((e, ei) => {
    let d = "", lx = 0, ly = 0, anchor = "start";
    if (e.pts) {
      d = "M" + e.pts.map((p) => p.join(",")).join(" L");
      lx = e.lx ?? 0; ly = e.ly ?? 0; anchor = e.anchor ?? "start";
    } else {
      const a = N[e.from!], b = N[e.to!];
      if (b.y >= a.y + a.h - 1) {
        const x1 = a.cx + (e.dx1 ?? 0), y1 = a.y + a.h, x2 = b.cx + (e.dx2 ?? 0), y2 = b.y;
        if (Math.abs(x1 - x2) < 1) { d = `M${x1},${y1} V${y2}`; lx = x1 + 10; ly = (y1 + y2) / 2 + 4; }
        else { const ym = e.ym ?? (y1 + y2) / 2; d = `M${x1},${y1} V${ym} H${x2} V${y2}`; lx = x2 + 10; ly = (ym + y2) / 2 + 4; }
      } else if (b.y + b.h <= a.y + 1) {
        const x1 = a.cx + (e.dx1 ?? 0), y1 = a.y, x2 = b.cx + (e.dx2 ?? 0), y2 = b.y + b.h;
        if (Math.abs(x1 - x2) < 1) { d = `M${x1},${y1} V${y2}`; lx = x1 + 10; ly = (y1 + y2) / 2 + 4; }
        else { const ym = e.ym ?? (y1 + y2) / 2; d = `M${x1},${y1} V${ym} H${x2} V${y2}`; lx = x1 + 10; ly = (y1 + ym) / 2 + 4; }
      } else {
        const right = b.x >= a.x + a.w - 1;
        const x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w;
        const y1 = a.cy + (e.dy1 ?? 0), y2 = b.cy + (e.dy2 ?? 0);
        d = Math.abs(y1 - y2) < 1 ? `M${x1},${y1} H${x2}` : `M${x1},${y1} H${(x1 + x2) / 2} V${y2} H${x2}`;
        lx = (x1 + x2) / 2; ly = Math.min(y1, y2) - 10; anchor = "middle";
      }
      if (e.lx !== undefined) lx = e.lx;
      if (e.ly !== undefined) ly = e.ly;
      if (e.anchor) anchor = e.anchor;
    }
    const k = e.dash ? "dash" : "solid";
    const ends = e.pts ? [hit(e.pts[0]), hit(e.pts[e.pts.length - 1])] : [e.from!, e.to!];
    el("path", { "data-e": ei, "data-a": ends[0], "data-b": ends[1], d, fill: "none", stroke: e.dash ? c.muted : c.ink2, "stroke-width": 1, "stroke-dasharray": e.dash ? "3 3" : "none",
      "stroke-linejoin": "round", "marker-end": `url(#${id}-a-${k})` }, L.edge);
    if (e.label) labels.push({ t: e.label, x: lx, y: ly, anchor, ei });
  });

  Object.values(N).forEach((n) => {
    const col = kc(n.kind);
    const g = el("g", { "data-n": n.id, tabindex: 0, role: "button", "aria-label": [n.t, ...(n.sub ?? [])].join(", ") }, L.node);
    const tw = n.w < 160 ? 28 : 36;   // ticker tag width
    el("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 2, fill: c.surface, stroke: c.line, "stroke-width": 1 }, g);
    el("path", { d: `M${n.x + 2},${n.y} H${n.x + tw} V${n.y + n.h} H${n.x + 2} Q${n.x},${n.y + n.h} ${n.x},${n.y + n.h - 2} V${n.y + 2} Q${n.x},${n.y} ${n.x + 2},${n.y} Z`, fill: col }, g);
    el("text", { x: n.x + tw / 2, y: n.cy + 3.5, fill: inkOn(col), "font-family": MONO, "font-size": n.w < 160 ? 8.5 : 9.5, "font-weight": 500, "text-anchor": "middle", "letter-spacing": ".04em" }, g).textContent = code(n);
    const bx = n.x + tw + 10, room = n.w - tw - 18;
    const sub = n.sub ?? [];
    let y = n.cy - (15 + sub.length * 14) / 2 + 11.5;
    fit(el("text", { x: bx, y, fill: c.ink, "font-family": FONT, "font-size": 12, "font-weight": 600, "letter-spacing": "-.01em" }, g) as SVGTextElement, n.t, room, 12);
    sub.forEach((s) => { y += 14; fit(el("text", { x: bx, y, fill: c.ink2, "font-family": FONT, "font-size": 10.5 }, g) as SVGTextElement, s, room, 10.5); });
  });

  labels.forEach((l) => {
    const lg = el("g", { "data-l": l.ei }, L.lab);
    const t = el("text", { x: l.x, y: l.y, fill: c.ink2, "font-family": MONO, "font-size": 9.5, "text-anchor": l.anchor, "letter-spacing": ".02em" }, lg);
    t.textContent = l.t;
    try { const b = t.getBBox(); lg.insertBefore(el("rect", { x: b.x - 4, y: b.y - 2, width: b.width + 8, height: b.height + 4, rx: 2, fill: c.surface, stroke: c.line, "stroke-width": 1 }), t); } catch {}
  });
}

const HEIGHT: Record<string, number> = { d1: 690, d2: 450, d3: 530, d4: 640, d5: 520, d6: 630 };
const KEY: [Exclude<Kind, "plain" | "warn">, string][] = [["maple", "Maple"], ["syrup", "SYRUP"], ["rh", "Robinhood"], ["morpho", "Morpho / Steakhouse"], ["infra", "Infrastructure"]];

export type Fig = { id: keyof typeof SPECS | string; title: string; lede?: string; source: string };

/** Light up one box and everything wired to it; dim the rest. */
function trace(svg: SVGSVGElement, on: string | null, soft = false) {
  svg.classList.toggle("is-tracing", !!on && !soft);
  svg.classList.toggle("is-focus", !!on && soft);
  const live = new Set<string>();
  svg.querySelectorAll<SVGPathElement>("[data-e]").forEach((p) => {
    const hot = !!on && (p.dataset.a === on || p.dataset.b === on);
    p.classList.toggle("on", hot);
    if (hot) { live.add(p.dataset.a!); live.add(p.dataset.b!); svg.querySelector(`[data-l="${p.dataset.e}"]`)?.classList.add("on"); }
    else svg.querySelector(`[data-l="${p.dataset.e}"]`)?.classList.remove("on");
  });
  svg.querySelectorAll<SVGGElement>("[data-n]").forEach((g) => { g.classList.toggle("on", live.has(g.dataset.n!) || g.dataset.n === on); g.classList.toggle("is-sel", g.dataset.n === on); });
}

/** Flow diagrams, one on screen at a time. Click a box to trace what flows in and out of it. */
export function Diagrams({ figs, focus, onNode }: { figs: Fig[]; focus?: { fig: string; id: string }; onNode?: (fig: string, id: string) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const pal = usePalette();
  const dark = pal.dark;
  const [i, setI] = useState(0);
  const [on, setOn] = useState<string | null>(null);
  const onRef = useRef<string | null>(null);
  onRef.current = on;
  useEffect(() => {
    if (!focus) return;
    const k = figs.findIndex((x) => x.id === focus.fig);
    if (k >= 0) setI(k);
    setOn(null);
  }, [focus?.fig, focus?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = figs[i];
  const soft = !on && focus?.fig === f.id ? focus.id : null;
  const softRef = useRef<string | null>(null);
  softRef.current = soft;
  const spec = SPECS[f.id];
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const go = () => { draw(svg, `ex-${f.id}`, spec, { ink: pal.ink, ink2: pal.ink2, muted: pal.axis, surface: pal.surface, line: pal.other, kinds: dark ? KIND.dark : KIND.light }); trace(svg, onRef.current ?? softRef.current, !onRef.current); };
    go();
    document.fonts?.ready.then(go);
    setOn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.id, dark, pal.ink, pal.surface]);
  // a redraw (fonts loading, theme) keeps whatever box is selected
  useEffect(() => { if (ref.current) trace(ref.current, on ?? soft, !on); }, [on, soft]);
  const pickNode = (e: React.SyntheticEvent) => {
    const g = (e.target as Element).closest("[data-n]") as SVGGElement | null;
    const id = g?.dataset.n ?? null;
    setOn((cur) => (!id || cur === id ? null : id));
    if (id) onNode?.(f.id, id);
  };
  const node = spec.nodes.find((n) => n.id === (on ?? soft));
  const name = (id?: string) => spec.nodes.find((n) => n.id === id)?.t ?? "";
  const flows = node ? spec.edges.map((e, k) => {
    const p = ref.current?.querySelector<SVGPathElement>(`[data-e="${k}"]`);
    const a = p?.dataset.a, b = p?.dataset.b;
    const at = on ?? soft;
    if (a !== at && b !== at) return null;
    return { dir: a === at ? "to" : "from", other: name(a === at ? b : a), label: e.label };
  }).filter((x) => x && x.other) as { dir: string; other: string; label?: string }[] : [];
  const kinds = new Set(spec.nodes.map((n) => n.kind));

  return (
    <figure className="dg">
      <figcaption className="dg-h">
        <div className="dg-tabs" role="tablist" aria-label="Diagrams">
          {figs.map((x, k) => (
            <button key={x.id} role="tab" aria-selected={k === i} onClick={() => setI(k)}>{x.title}</button>
          ))}
        </div>
        {f.lede && <p className="dg-l">{f.lede}</p>}
      </figcaption>
      <div className="dg-body">
        <svg ref={ref} viewBox={`0 0 760 ${HEIGHT[f.id]}`} role="img" aria-label={f.title} className="dg-svg"
          onClick={pickNode} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickNode(e); } if (e.key === "Escape") setOn(null); }} />
      </div>
      <div className="dg-detail" aria-live="polite">
        {node ? (<>
          <div className="dg-dt">{node.t}{node.sub?.length ? <span>{node.sub.join(". ")}</span> : null}</div>
          <ul>{flows.map((x, k) => <li key={k}><i>{x.dir === "to" ? "→" : "←"}</i>{x.other}{x.label ? <span>{x.label}</span> : null}</li>)}</ul>
        </>) : <div className="dg-hint">Select a box to trace what flows in and out of it.</div>}
      </div>
      <div className="dg-f">
        <span className="dg-key">{KEY.filter(([k]) => kinds.has(k)).map(([k, l]) => <span key={k}><i style={{ background: (dark ? KIND.dark : KIND.light)[k] }} />{l}</span>)}</span>
        <span>Source: {f.source}</span>
      </div>
    </figure>
  );
}

/** A single diagram. */
export function Exhibit(f: Fig & { n?: number }) {
  return <Diagrams figs={[f]} />;
}
