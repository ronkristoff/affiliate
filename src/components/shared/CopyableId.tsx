"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Displays a Convex document ID in a small monospace font with a copy button.
 * Shows a truncated version of the ID and copies the full ID on click.
 */
export function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API not available — silently fail
    }
  };

  return (
    <div className="flex items-center gap-1.5 group">
      <code
        className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]"
        title={id}
      >
        {id}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        title="Copy ID"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-600" />
        ) : (
          <Copy className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
