"use client";
// Search + Ask AI, shared by Paul's dashboards (same file in each repo).
// Typing searches what's on the page (sections, charts, numbers, tables) and jumps to it; Enter asks the assistant
// (Claude Haiku 5.5 on Paul HQ, /api/ask), which answers from this dashboard's own data (/api/ask-context).
// Open with the button, "/" or ⌘K / Ctrl+K. Esc closes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ENDPOINT = "https://paulhq.vercel.app/api/ask";
type Msg = { role: "user" | "assistant"; content: string };
type Hit = { el: Element; text: string; kind: string };

function pageIndex(): Hit[] {
  const out: Hit[] = [], seen = new Set<string>();
  const add = (el: Element, kind: string) => {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 140 || seen.has(text) || el.closest("[data-ask-ui]")) return;
    seen.add(text); out.push({ el, text, kind });
  };
  document.querySelectorAll("main h1, main h2, main h3, main h4").forEach((el) => add(el, "section"));
  document.querySelectorAll("main [class*='uppercase']").forEach((el) => add(el, "number"));
  document.querySelectorAll("main th").forEach((el) => add(el, "table"));
  return out;
}

function flash(el: Element) {
  const box = (el.closest("section, [class*='rounded'], [class*='border']") || el) as HTMLElement;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  box.animate([{ outline: "2px solid var(--accent, #8fb3ff)", outlineOffset: "4px" }, { outline: "2px solid transparent", outlineOffset: "4px" }], { duration: 1600, easing: "ease-out" });
}

export default function Ask({ site, title, suggestions = [] }: { site: string; title: string; suggestions?: string[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(-1);
  const [idx, setIdx] = useState<Hit[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement)?.tagName || "");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setOpen(true); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) { setIdx(pageIndex()); setTimeout(() => input.current?.focus(), 20); } }, [open]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [msgs]);

  const hits = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (!terms.length) return [];
    return idx.map((h) => ({ h, s: terms.reduce((a, t) => a + (h.text.toLowerCase().includes(t) ? 1 : 0), 0) }))
      .filter((x) => x.s === terms.length).slice(0, 6).map((x) => x.h);
  }, [q, idx]);

  const ask = useCallback(async (text: string) => {
    text = text.trim(); if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs([...next, { role: "assistant", content: "" }]); setQ(""); setSel(-1); setBusy(true);
    try {
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site, messages: next }) });
      if (!r.body) throw new Error();
      const rd = r.body.getReader(), dec = new TextDecoder();
      let acc = "";
      for (;;) { const { done, value } = await rd.read(); if (done) break; acc += dec.decode(value, { stream: true }); setMsgs([...next, { role: "assistant", content: acc }]); }
      if (!acc.trim()) setMsgs([...next, { role: "assistant", content: "No answer came back. Try again." }]);
    } catch { setMsgs([...next, { role: "assistant", content: "Couldn't reach the assistant. Try again in a moment." }]); }
    setBusy(false);
  }, [busy, msgs, site]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && hits.length) { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp" && hits.length) { e.preventDefault(); setSel((s) => Math.max(s - 1, -1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (sel >= 0 && hits[sel]) { flash(hits[sel].el); setOpen(false); } else ask(q); }
  };

  return (
    <div data-ask-ui>
      <style>{CSS}</style>
      {!open && (
        <button className="pa-fab" onClick={() => setOpen(true)} aria-label="Search or ask about this data">
          <span>Search or ask AI</span><kbd>/</kbd>
        </button>
      )}
      {open && (
        <div className="pa-panel" role="dialog" aria-label={`Ask about ${title}`}>
          <div className="pa-head">
            <span>Ask about {title}</span>
            <button onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <div className="pa-log" ref={log}>
            {!msgs.length && (
              <div className="pa-empty">
                <p>Search this page, or ask a question about the data. Answers come only from this dashboard&apos;s numbers.</p>
                {suggestions.map((s) => <button key={s} className="pa-chip" onClick={() => ask(s)}>{s}</button>)}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "pa-q" : "pa-a"}>
                {m.content || (busy && i === msgs.length - 1 ? <span className="pa-dots">Reading the data…</span> : "")}
              </div>
            ))}
          </div>
          {hits.length > 0 && (
            <div className="pa-hits">
              {hits.map((h, i) => (
                <button key={i} className={`pa-hit ${i === sel ? "on" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => { flash(h.el); setOpen(false); }}>
                  <span>{h.text}</span><em>{h.kind}</em>
                </button>
              ))}
              <div className="pa-hint">↑↓ to pick · Enter on a result jumps to it · Enter with none picked asks AI</div>
            </div>
          )}
          <form className="pa-in" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input ref={input} value={q} maxLength={600} onChange={(e) => { setQ(e.target.value); setSel(-1); }} onKeyDown={onKeyDown}
              placeholder="Search the page or ask a question…" aria-label="Search or ask" />
            <button type="submit" disabled={busy || !q.trim()}>Ask</button>
          </form>
          <div className="pa-foot">AI answers from this dashboard&apos;s data, can be wrong · not investment advice</div>
        </div>
      )}
    </div>
  );
}

const CSS = `
[data-ask-ui]{--pa-bg:var(--surface,var(--panel,#141922));--pa-ink:var(--ink,var(--text,#e6e9ef));--pa-mut:var(--muted,#8a93a5);--pa-line:var(--line,#2a3140);--pa-acc:var(--accent,#8fb3ff);--pa-page:var(--page,var(--bg,#0d1117));font-family:inherit}
.pa-fab{position:fixed;right:18px;bottom:18px;z-index:60;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:999px;border:1px solid var(--pa-line);background:var(--pa-bg);color:var(--pa-ink);font-size:13px;cursor:pointer;box-shadow:0 8px 24px -10px rgba(0,0,0,.5)}
.pa-fab:hover{border-color:var(--pa-acc)}
.pa-fab kbd,.pa-head button{font:11px var(--font-mono,ui-monospace,monospace);color:var(--pa-mut);border:1px solid var(--pa-line);border-radius:4px;padding:1px 6px;background:transparent}
.pa-panel{position:fixed;right:18px;bottom:18px;z-index:60;width:min(440px,calc(100vw - 24px));max-height:min(620px,calc(100vh - 36px));display:flex;flex-direction:column;border:1px solid var(--pa-line);border-radius:4px;background:var(--pa-bg);color:var(--pa-ink);box-shadow:0 24px 64px -20px rgba(0,0,0,.6);overflow:hidden}
@media (max-width:520px){.pa-panel{right:12px;left:12px;bottom:12px;width:auto;max-height:calc(100vh - 24px)}.pa-fab{right:12px;bottom:12px}}
.pa-head{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-bottom:2px solid var(--pa-ink);font-size:13px;font-weight:600;color:var(--pa-ink)}
.pa-head button{cursor:pointer;font-size:14px;line-height:1}
.pa-log{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-height:120px}
.pa-empty p{font-size:13px;line-height:1.5;color:var(--pa-mut);margin:0 0 10px}
.pa-chip{display:block;width:100%;text-align:left;font-size:13px;color:var(--pa-ink);background:transparent;border:1px solid var(--pa-line);border-radius:6px;padding:8px 10px;margin-bottom:6px;cursor:pointer}
.pa-chip:hover{border-color:var(--pa-acc)}
.pa-q{align-self:flex-end;max-width:85%;font-size:13px;background:var(--pa-page);border:1px solid var(--pa-line);border-radius:8px;padding:7px 10px;white-space:pre-wrap}
.pa-a{font-size:13.5px;line-height:1.55;white-space:pre-wrap}
.pa-dots{color:var(--pa-mut)}
.pa-hits{border-top:1px solid var(--pa-line);padding:6px}
.pa-hit{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;background:transparent;border:0;border-radius:6px;padding:7px 8px;font-size:13px;color:var(--pa-ink);cursor:pointer}
.pa-hit em{font-size:11px;font-style:normal;color:var(--pa-mut)}
.pa-hit.on,.pa-hit:hover{background:var(--pa-page)}
.pa-hint{font-size:11px;color:var(--pa-mut);padding:4px 8px 2px}
.pa-in{display:flex;gap:8px;padding:10px;border-top:1px solid var(--pa-line)}
.pa-in input{flex:1;min-width:0;font-size:16px;background:var(--pa-page);color:var(--pa-ink);border:1px solid var(--pa-line);border-radius:8px;padding:9px 12px;outline:none}
.pa-in input:focus{border-color:var(--pa-acc)}
.pa-in button{font-size:13px;font-weight:600;border:0;border-radius:8px;padding:0 14px;background:var(--pa-acc);color:var(--accent-ink,var(--pa-page));cursor:pointer}
.pa-in button:disabled{opacity:.45;cursor:default}
.pa-foot{font-size:10.5px;color:var(--pa-mut);padding:0 14px 10px}
@media (min-width:521px){.pa-in input{font-size:14px}}
`;
