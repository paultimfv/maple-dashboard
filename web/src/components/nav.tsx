"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/", label: "Macro" },
  { href: "/maple", label: "Maple + SYRUP" },
  { href: "/model", label: "Model" },
];

type Theme = "light" | "dark";
const current = (): Theme => {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(current()), []);
  const flip = () => {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  };
  const sun = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
  const moon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
    </svg>
  );
  // shows the mode you'd switch to: moon in light, sun in dark
  return (
    <button onClick={flip} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="grid h-8 w-8 place-items-center rounded-[3px] border border-line text-ink-2 hover:border-line-strong hover:text-ink">
      {theme === null ? null : theme === "dark" ? sun : moon}
    </button>
  );
}

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-20 border-b border-line bg-page/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 text-sm">
        <span className="py-3 font-mono text-[12px] font-medium uppercase tracking-wider text-ink">
          <span className="text-accent">■</span> Maple × Robinhood
        </span>
        <div className="flex gap-5">
          {nav.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                className={`-mb-px border-b-2 py-3 ${on ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                {n.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto"><ThemeToggle /></div>
      </div>
    </nav>
  );
}
