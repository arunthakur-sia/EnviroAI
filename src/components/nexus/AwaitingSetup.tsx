/**
 * What every page shows while the volume is still empty. Bilingual and
 * self-contained: there is no database to read a language preference from and
 * no session to ask.
 */
export function AwaitingSetup() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">SiaNexus</p>
      <h1 className="font-display text-3xl text-maroon-900">
        SiaNexus is being set up. Please check back in a few minutes.
      </h1>
      <p className="font-display text-2xl text-maroon-900" dir="rtl" lang="ar">
        يجري إعداد سيا نكسس. يرجى العودة بعد بضع دقائق.
      </p>
      <span aria-hidden className="mt-2 h-1 w-24 rounded-full bg-gold-500" />
    </main>
  );
}
