"use client";
import { useEffect, useRef } from "react";
import { usePalette } from "@/components/charts";
import { SPECS, type ExhibitSpec, type Kind } from "@/lib/exhibits";

const NS = "http://www.w3.org/2000/svg";
const FONT = "var(--font-geist-sans), -apple-system, sans-serif";
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

/** Draws one exhibit into an <svg>. Same layout engine as the artifact; colors are written as attributes. */
function draw(svg: SVGSVGElement, id: string, spec: ExhibitSpec, c: Colors) {
  svg.replaceChildren();
  const kc = (k?: Kind) => (!k || k === "plain" ? c.muted : c.kinds[k]);
  const defs = el("defs", {}, svg);
  ([["solid", c.ink2], ["dash", c.muted]] as const).forEach(([k, col]) => {
    const m = el("marker", { id: `${id}-a-${k}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse", markerUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M0,1 L10,5 L0,9 z", fill: col }, m);
  });
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

  const labels: { t: string; x: number; y: number; anchor: string }[] = [];
  spec.edges.forEach((e) => {
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
    el("path", { d, fill: "none", stroke: e.dash ? c.muted : c.ink2, "stroke-width": e.dash ? 1.2 : 1.4, "stroke-dasharray": e.dash ? "3 4" : "none",
      "stroke-linejoin": "round", "marker-end": `url(#${id}-a-${k})` }, L.edge);
    if (e.label) labels.push({ t: e.label, x: lx, y: ly, anchor });
  });

  Object.values(N).forEach((n) => {
    const col = kc(n.kind);
    const g = el("g", {}, L.node);
    el("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 3, fill: c.surface, stroke: col, "stroke-width": 1.2 }, g);
    el("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 3, fill: col, "fill-opacity": 0.08 }, g);
    const sub = n.sub ?? [];
    let y = n.cy - (16 + sub.length * 15) / 2 + 12;
    const t = el("text", { x: n.cx + 6, y, fill: c.ink, "font-family": FONT, "font-size": 12.5, "font-weight": 600, "text-anchor": "middle" }, g);
    t.textContent = n.t;
    try { const bb = t.getBBox(); el("rect", { x: bb.x - 12, y: bb.y + bb.height / 2 - 2.5, width: 6, height: 6, fill: col }, g); } catch {}
    sub.forEach((s) => { y += 15; el("text", { x: n.cx, y, fill: c.ink2, "font-family": FONT, "font-size": 11, "text-anchor": "middle" }, g).textContent = s; });
  });

  labels.forEach((l) => {
    const t = el("text", { x: l.x, y: l.y, fill: c.ink2, "font-family": FONT, "font-size": 10.5, "font-weight": 500, "text-anchor": l.anchor }, L.lab);
    t.textContent = l.t;
    try { const b = t.getBBox(); L.lab.insertBefore(el("rect", { x: b.x - 5, y: b.y - 2, width: b.width + 10, height: b.height + 4, rx: 2, fill: c.surface }), t); } catch {}
  });
}

const HEIGHT: Record<string, number> = { d1: 690, d2: 450, d3: 530, d4: 640, d5: 520, d6: 630 };

/** One flow diagram as a card: label, title, one-line lede, the diagram, and a source line. */
export function Exhibit({ id, n, title, lede, source }: { id: keyof typeof SPECS | string; n: number; title: string; lede?: string; source: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const pal = usePalette();
  const dark = pal.surface !== "#f6f6f6";
  useEffect(() => {
    if (!ref.current) return;
    const go = () => draw(ref.current!, `ex-${id}`, SPECS[id], {
      ink: pal.ink, ink2: pal.ink2, muted: pal.axis, surface: pal.surface, line: pal.other, kinds: dark ? KIND.dark : KIND.light,
    });
    go();
    document.fonts?.ready.then(go);   // re-measure label boxes once Geist has loaded
  }, [id, pal, dark]);
  return (
    <figure className="m-0 overflow-hidden rounded-[3px] border border-line bg-surface">
      <figcaption className="px-4 pt-4">
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-accent-ink">Exhibit {n}</div>
        <div className="mt-0.5 text-[13px] font-medium text-ink">{title}</div>
        {lede && <div className="mt-0.5 max-w-3xl text-[11.5px] leading-relaxed text-muted">{lede}</div>}
      </figcaption>
      <div className="overflow-x-auto">
        <svg ref={ref} viewBox={`0 0 760 ${HEIGHT[id]}`} role="img" aria-label={title} className="block h-auto w-full min-w-[640px] px-3 pb-1 pt-2" />
      </div>
      <div className="mx-4 flex justify-between gap-4 border-t border-line py-2.5 font-mono text-[10.5px] text-muted">
        <span>Source: {source}</span><span>@ptimfv</span>
      </div>
    </figure>
  );
}
