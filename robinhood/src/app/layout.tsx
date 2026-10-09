import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/nav";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Robinhood Chain × Earn",
  description: "Self-hosted onchain data on Robinhood Chain and Robinhood Earn",
};

// applied before paint so a saved theme never flashes the other one; ?theme=light|dark forces one (handy for screenshots)
const themeScript = `try{var t=new URLSearchParams(location.search).get("theme")||localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="bg-page text-ink antialiased">
        <Nav />
        {children}
        <footer className="mx-auto max-w-6xl border-t border-line px-4 py-6 font-mono text-[11px] text-muted">
          Built by Paul Timofeev · onchain data from Robinhood Chain and Ethereum, refreshed daily · not investment advice
        </footer>
      </body>
    </html>
  );
}
