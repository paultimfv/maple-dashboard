import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maple × Robinhood",
  description: "Self-hosted onchain data: Robinhood Chain, stablecoins, Maple Finance and SYRUP",
};

const nav = [
  { href: "/", label: "Macro" },
  { href: "/maple", label: "Maple Finance + SYRUP" },
  { href: "/model", label: "SYRUP model" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 antialiased">
        <nav className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
            <span className="font-semibold text-neutral-200">Maple × Robinhood</span>
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-neutral-400 hover:text-neutral-100">{n.label}</Link>
            ))}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
