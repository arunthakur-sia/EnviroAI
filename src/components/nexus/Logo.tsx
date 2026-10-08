// The EnviroAI brand (public/brand/EnviroAI_logo.svg, canvas 330x64).
// Variants: full = mark plus wordmark; compact = same as full (kept so older
// call sites keep working); mark = the droplet-with-leaf alone on a square
// canvas. `white` selects the variant for dark grounds (the navy sidebar).
// Do not recolour or restyle the wordmark.
import { cn } from "@/lib/utils";

const FULL_ASPECT = 330 / 64;
const NAME = "EnviroAI";

export function SiaLogo({
  variant = "full",
  height = 28,
  white = false,
  className,
}: {
  variant?: "full" | "compact" | "mark";
  height?: number;
  white?: boolean;
  className?: string;
}) {
  if (variant === "mark") {
    return (
      <span
        role="img"
        aria-label={NAME}
        className={cn(white ? "logo-mark-white" : "logo-mark", "inline-block select-none", className)}
        style={{ height, width: height }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={white ? "/brand/EnviroAI_logo_white.svg" : "/brand/EnviroAI_logo.svg"}
      alt={NAME}
      style={{ height, width: Math.round(height * FULL_ASPECT) }}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}

/** Compatibility wrapper: the old knot slot now renders the droplet mark. */
export function Knot({
  size = 32,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  return <SiaLogo variant="mark" height={size} className={className} />;
}

/** Compatibility wrapper: the old wordmark slot now renders the full brand. */
export function Wordmark({
  size = "md",
  className,
}: {
  locale?: string;
  size?: "md" | "lg";
  animated?: boolean;
  className?: string;
}) {
  return <SiaLogo variant="full" height={size === "lg" ? 40 : 24} className={className} />;
}
