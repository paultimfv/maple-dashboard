import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid max-w-6xl gap-3 px-4 py-24">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted">404</div>
      <h1 className="text-[28px] font-semibold tracking-tight">Nothing here.</h1>
      <p className="text-[13px] text-ink-2">
        Try <Link href="/" className="underline underline-offset-2 hover:text-ink">Macro</Link>,{" "}
        <Link href="/maple" className="underline underline-offset-2 hover:text-ink">Maple + SYRUP</Link> or{" "}
        <Link href="/model" className="underline underline-offset-2 hover:text-ink">the model</Link>.
      </p>
    </main>
  );
}
