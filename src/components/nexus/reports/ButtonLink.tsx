"use client";
// CR08 5: a locale-aware link (or a plain anchor for API downloads) dressed
// as a Button, so a primary action can be a real link without nesting a
// button inside an anchor.
import * as React from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer";
const VARIANTS = {
  primary: "bg-maroon-700 text-white shadow-sm hover:bg-maroon-900 active:translate-y-px",
  secondary: "border border-sand-300 bg-white text-ink-900 hover:border-maroon-300 hover:text-maroon-700",
  ghost: "text-ink-600 hover:bg-maroon-100/60 hover:text-maroon-900",
  gold: "bg-gold-100 text-maroon-900 border border-gold-300 hover:bg-gold-300/40",
};
const SIZES = { sm: "h-8 px-3 text-xs", md: "h-9.5 px-4" };

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  external = false,
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** a plain anchor (API downloads), not the locale-aware Link */
  external?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">) {
  const classes = cn(BASE, SIZES[size], VARIANTS[variant], className);
  if (external) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  );
}
