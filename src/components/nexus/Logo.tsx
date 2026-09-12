// The SiaNexus brand wordmark (brand/SiaNexus_logo.svg, canvas 2654x400).
// Variants: full = the whole wordmark; compact = the Sia part with the slash
// (crop 0 0 1032 400); mark = the teal slash alone on a square canvas.
// Crops are done with the .logo-compact / .logo-mark classes in globals.css so
// no asset is duplicated. Do not recolour or restyle the wordmark.
import { cn } from "@/lib/utils";

const FULL_ASPECT = 2654 / 400;
const COMPACT_ASPECT = 1032 / 400;

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
  if (variant === "full") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={white ? "/brand/SiaNexus_logo_white.png" : "/brand/SiaNexus_logo.svg"}
        alt="SiaNexus"
        style={{ height, width: Math.round(height * FULL_ASPECT) }}
        className={cn("select-none", className)}
        draggable={false}
      />
    );
  }
  if (variant === "compact") {
    return (
      <span
        role="img"
        aria-label="SiaNexus"
        className={cn("logo-compact inline-block select-none", className)}
        style={{ height, width: Math.round(height * COMPACT_ASPECT) }}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label="SiaNexus"
      className={cn("logo-mark inline-block select-none", className)}
      style={{ height, width: height }}
    />
  );
}

/** Compatibility wrapper: the old knot slot now renders the slash mark. */
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
