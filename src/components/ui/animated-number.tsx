"use client";

import { useEffect, useRef } from "react";
import { useSpring, useMotionValue, useTransform, animate } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
  springConfig?: {
    stiffness?: number;
    damping?: number;
    mass?: number;
  };
}

/**
 * Animated number that smoothly interpolates between values using spring physics.
 * Numbers "count" up/down instead of jumping instantly.
 *
 * Usage:
 *   <AnimatedNumber value={150} format={v => `₱${v.toFixed(2)}`} />
 *   <AnimatedNumber value={20} format={v => `${v}%`} />
 */
export function AnimatedNumber({
  value,
  format,
  className,
  springConfig = { stiffness: 80, damping: 20, mass: 0.8 },
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, springConfig);
  const displayRef = useRef<HTMLSpanElement>(null);

  // Update spring target when value changes
  useEffect(() => {
    animate(motionValue, value, {
      type: "spring",
      ...springConfig,
    });
  }, [value, motionValue, springConfig]);

  // Sync spring output to DOM
  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (displayRef.current) {
        displayRef.current.textContent = format ? format(latest) : String(Math.round(latest));
      }
    });
    return unsubscribe;
  }, [springValue, format]);

  const initialValue = format ? format(value) : String(Math.round(value));

  return (
    <span ref={displayRef} className={className}>
      {initialValue}
    </span>
  );
}
