"use client";
// Core restyled primitives: paper-and-ink, maroon accent, quiet by default.
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn, initialsOf } from "@/lib/utils";

/* ---------------- Button ---------------- */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-maroon-700 text-white shadow-sm hover:bg-maroon-900 active:translate-y-px",
        secondary:
          "border border-sand-300 bg-white text-ink-900 hover:border-maroon-300 hover:text-maroon-700",
        ghost: "text-ink-600 hover:bg-maroon-100/60 hover:text-maroon-900",
        gold: "bg-gold-100 text-maroon-900 border border-gold-300 hover:bg-gold-300/40",
        danger: "bg-danger text-white hover:opacity-90",
        link: "text-maroon-700 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9.5 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" /> : null}
      {children}
    </button>
  )
);
Button.displayName = "Button";

/* ---------------- Inputs ---------------- */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9.5 w-full rounded-lg border border-sand-300 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 shadow-none transition-colors focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-100 disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-100 disabled:opacity-50 min-h-24",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-medium text-ink-600", className)}
      {...props}
    />
  );
}

export function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9.5 w-full rounded-lg border border-sand-300 bg-white px-2.5 text-sm text-ink-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-100",
        className
      )}
      {...props}
    />
  );
}

/* ---------------- Chips ---------------- */

const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-4",
  {
    variants: {
      tone: {
        maroon: "bg-maroon-100 text-maroon-900",
        sand: "bg-sand-100 text-ink-600 border border-sand-300",
        gulf: "bg-gulf-100 text-gulf-600",
        gold: "bg-gold-100 text-maroon-900 border border-gold-300",
        ok: "bg-ok-light text-ok",
        warn: "bg-warn-light text-warn",
        danger: "bg-danger-light text-danger",
        info: "bg-info-light text-info",
        ghost: "text-ink-400",
      },
    },
    defaultVariants: { tone: "sand" },
  }
);

export function Chip({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}

/** Classification chip per National Data Policy levels. */
export function ClassificationChip({
  level,
  labels,
}: {
  level: number;
  labels: [string, string, string, string];
}) {
  const tones = ["gulf", "sand", "warn", "danger"] as const;
  const tone = tones[Math.min(3, Math.max(0, level - 1))];
  return <Chip tone={tone}>{labels[Math.min(3, Math.max(0, level - 1))]}</Chip>;
}

/* ---------------- Avatar ---------------- */

/* Each ground carries its own ink: white initials on gold-500 measure 2.4 to 1,
   which no amount of weight rescues, so the gold monogram reads in ink. */
const AVATAR_BG: Record<string, string> = {
  maroon: "bg-maroon-700 text-white",
  gulf: "bg-gulf-600 text-white",
  gold: "bg-gold-500 text-ink-900",
};

export function Avatar({
  name,
  color = "maroon",
  size = 32,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        AVATAR_BG[color] ?? "bg-maroon-700 text-white",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

/* ---------------- Skeletons ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function ShelfSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden py-2" aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-11 rounded-md" />
      ))}
    </div>
  );
}

/* ---------------- Empty state ---------------- */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sand-300 bg-sand-50 px-6 py-12 text-center",
        className
      )}
    >
      {icon ? <div className="text-ink-400 [&_svg]:size-8">{icon}</div> : null}
      <p className="font-medium text-ink-900">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-ink-600">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* ---------------- Section heading ---------------- */

export function SectionTitle({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-4", className)}>
      <h2 className="text-lg">{children}</h2>
      {aside}
    </div>
  );
}

/* ---------------- Progress ring ---------------- */

export function ProgressRing({
  value,
  size = 40,
  stroke = 3.5,
  className,
  color = "var(--color-maroon-700)",
  track = "var(--color-sand-200)",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  className?: string;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 700ms var(--ease-paper)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  );
}

/* ---------------- RAG dot ---------------- */

export function RagDot({ status, className }: { status: string; className?: string }) {
  const color =
    status === "on_track" || status === "completed"
      ? "bg-ok"
      : status === "at_risk"
        ? "bg-warn"
        : status === "delayed"
          ? "bg-danger"
          : "bg-ink-200";
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", color, className)}
      aria-hidden
    />
  );
}
