"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Ease-out-quart — smooth, natural deceleration.
 * Value reaches target quickly at first, then settles gracefully.
 */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

interface AnimatedCountProps {
  /** Target number to animate towards. */
  value: number;
  /** Custom formatter — receives the current interpolated value. */
  format?: (n: number) => string;
  /** Animation duration in ms. Default 800. */
  duration?: number;
  /** Delay before starting in ms. Default 0. */
  delay?: number;
  className?: string;
}

/**
 * Reusable count-up animation.
 *
 * Animates from 0 → `value` using requestAnimationFrame with ease-out-quart
 * easing. Respects `prefers-reduced-motion` (shows final value instantly).
 *
 * @example
 * ```tsx
 * <AnimatedCount value={150000} format={(n) => formatCurrency(n)} />
 * <AnimatedCount value={47} duration={600} />
 * ```
 */
export function AnimatedCount({
  value,
  format,
  duration = 800,
  delay = 0,
  className,
}: AnimatedCountProps) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  const animate = useCallback(() => {
    if (reducedMotion.current || value === 0) {
      setCurrent(value);
      return;
    }

    const timeout = setTimeout(() => {
      const start = performance.now();
      const from = 0;
      const to = value;

      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        setCurrent(from + (to - from) * eased);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, delay]);

  useEffect(() => {
    return animate();
  }, [animate]);

  const display = format ? format(current) : current.toLocaleString();

  return <span className={className}>{display}</span>;
}
