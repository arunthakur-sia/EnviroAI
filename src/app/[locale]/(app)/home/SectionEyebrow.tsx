// CR02 1.3.4: one consistent section eyebrow. Small caps label with a hairline
// rule; ink-600 instead of the CR's ink-400 for WCAG AA contrast (see
// DECISIONS.md CR02 entry). Server-safe, no client hooks.
export function SectionEyebrow({
  label,
  action,
}: {
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {/* fontFamily inherit: the globals h2 rule would set the display serif,
          and it is unlayered so it beats utility classes */}
      <h2
        className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-600"
        style={{ fontFamily: "inherit", letterSpacing: "0.12em" }}
      >
        {label}
      </h2>
      <span className="h-px min-w-6 flex-1 bg-sand-300" aria-hidden />
      {action}
    </div>
  );
}
