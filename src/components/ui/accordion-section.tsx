"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";

interface AccordionSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Smooth accordion section using grid-template-rows animation.
 * No height animation jank — pure GPU-composited transform + grid transition.
 */
export function AccordionSection({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--hover)] transition-colors"
      >
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-[#10409a]/10 flex items-center justify-center text-[#10409a] text-sm shrink-0">
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text-heading)]">{title}</div>
          {description && (
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{description}</div>
          )}
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="text-[var(--text-muted)] shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.span>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
