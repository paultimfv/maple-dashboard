import type { Metadata } from "next";
import { Schibsted_Grotesk, Geist_Mono } from "next/font/google";
import Nav from "@/components/nav";
import Ask from "@/components/ask";
import "./globals.css";

// one newspaper-grade grotesk for everything; its heavy weights carry the big figures
const sans = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Maple Finance",
  description: "Maple Finance and SYRUP, rebuilt from onchain data",
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
        <footer className="mx-auto mt-16 max-w-6xl border-t-2 border-ink px-4 py-6 text-[12px] text-muted">
          Built by Paul Timofeev · onchain data from Ethereum and Robinhood Chain, refreshed daily · not investment advice
        </footer>
        <Ask site="maple" title="Maple Finance" suggestions={["How has SYRUP's price moved over the last 30 days?", "What was Maple's revenue last month, and where did it come from?", "How much SYRUP has Maple bought back so far?"]} />
      </body>
    </html>
  );
}
