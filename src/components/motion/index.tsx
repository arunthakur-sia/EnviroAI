"use client";
// Motion primitives: one choreographed entrance per page, then calm.
// 320ms, 40ms stagger, cubic-bezier(0.22,1,0.36,1). Respects reduced motion.
import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  className,
  y = 10,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  // CR08 Phase A: useReducedMotion() is null on the server, so switching
  // `initial` on it made the server write style="opacity:0" where a
  // reduced-motion client wrote none, a hydration attribute mismatch on every
  // page. The initial state is now the same on both sides and the preference
  // collapses the duration instead, which is what "no animation" means here.
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.32, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  step = 0.04,
  fromEnd = false,
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
  fromEnd?: boolean;
}) {
  const reduced = useReducedMotion();
  const items = React.Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <motion.div
          key={i}
          // same hydration rule as Reveal: one initial state, the preference
          // collapses the duration
          initial={{ opacity: 0, x: fromEnd ? 14 : 0, y: fromEnd ? 0 : 10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.32, delay: i * step, ease: EASE }}
          className="contents-none"
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

/** Counts up once when it enters the viewport. Tabular figures required by callers. */
export function CountUp({
  value,
  format,
  duration = 900,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = React.useState(reduced ? value : 0);

  React.useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {format ? format(display) : Math.round(display).toLocaleString()}
    </span>
  );
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
