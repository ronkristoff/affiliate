"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check, Pin } from "lucide-react";

interface AccordionSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  /** Optional status badge - "completed" shows green check, "pending" shows amber dot */
  status?: "completed" | "pending";
  /** Controlled mode: externally control open state. Once mounted, cannot switch between controlled/uncontrolled. */
  open?: boolean;
  /** Controlled mode callback */
  onOpenChange?: (open: boolean) => void;
  /** When true, section cannot be collapsed by clicking the header */
  pinned?: boolean;
  /** Optional alert banner rendered above children inside the body area */
  alert?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Smooth accordion section using grid-template-rows animation.
 * No height animation jank — pure GPU-composited transform + grid transition.
 * 
 * Supports both uncontrolled mode (defaultOpen) and controlled mode (open/onOpenChange).
 * Once mounted, the component cannot switch between controlled and uncontrolled mode.
 */
export function AccordionSection({
  title,
  description,
  icon,
  defaultOpen = false,
  status,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  pinned = false,
  alert,
  children,
}: AccordionSectionProps) {
  // Determine if controlled on first render and lock it in
  const isControlledRef = useRef<boolean | null>(null);
  const [prevOpenPresence, setPrevOpenPresence] = useState<boolean | undefined>(controlledOpen);

  // Lock in controlled mode on first render
  if (isControlledRef.current === null) {
    isControlledRef.current = controlledOpen !== undefined;
  }

  // Dev warning if mode switches after mount
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && isControlledRef.current !== undefined) {
      if (prevOpenPresence !== undefined && controlledOpen !== undefined && prevOpenPresence !== controlledOpen) {
        console.warn("[AccordionSection] Cannot switch between controlled and uncontrolled mode after mount");
      }
      setPrevOpenPresence(controlledOpen);
    }
  }, [controlledOpen, prevOpenPresence]);

  // Use controlled or uncontrolled state
  const isControlled = isControlledRef.current;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isOpen = isControlled ? !!controlledOpen : internalOpen;
  const handleToggle = () => {
    if (pinned) return; // Pinned sections cannot be collapsed
    const newOpen = !isOpen;
    if (isControlled) {
      controlledOnOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  // Generate a stable section ID for aria-controls
  const sectionId = useRef(
    `accordion-section-${Math.random().toString(36).substring(2, 9)}`
  );

  return (
    <div className="rounded-xl overflow-hidden bg-white" id={sectionId.current}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls={`${sectionId.current}-content`}
        id={`${sectionId.current}-trigger`}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--hover)] transition-colors"
      >
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-[#1c2260]/10 flex items-center justify-center text-[#1c2260] text-sm shrink-0">
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text-heading)]">{title}</div>
          {description && (
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{description}</div>
          )}
        </div>
        {/* Status badge - always rendered with opacity transition to avoid layout shift */}
        <span
          className={`shrink-0 transition-opacity duration-200 ${
            status ? "opacity-100" : "opacity-0"
          }`}
        >
          {status === "completed" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
              <Check className="w-3 h-3" />
              Done
            </span>
          )}
          {status === "pending" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Pending
            </span>
          )}
        </span>
        {pinned && (
          <span className="shrink-0 text-amber-500" title="Pinned — click to unpin">
            <Pin className="w-3.5 h-3.5" />
          </span>
        )}
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
        <div className="overflow-hidden" id={`${sectionId.current}-content`} role="region" aria-labelledby={`${sectionId.current}-trigger`}>
          <div className="px-4 pb-4 pt-1">
            {alert && <div className="mb-3">{alert}</div>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
