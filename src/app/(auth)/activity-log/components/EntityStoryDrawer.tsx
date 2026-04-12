"use client";

import { Suspense, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { Copy, Check, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface EntityStoryDrawerProps {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
}

function EntityStoryContent({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const story = useQuery(api.audit.getEntityStory, { entityType, entityId });

  if (story === undefined) {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (story === null || story.entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-page)]">
          <Info className="h-6 w-6 text-[var(--text-muted)]" />
        </div>
        <p className="text-[13px] font-medium text-[var(--text-heading)]">
          No activity found
        </p>
        <p className="mt-1 text-[12px] text-[var(--text-muted)] max-w-[240px]">
          No audit log entries exist for this entity yet.
        </p>
      </div>
    );
  }

  const chain = story.chain ?? [];

  return (
    <div className="mt-4 space-y-4">
      {chain.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {chain.map((item: any, index: number) => {
            const isCurrent =
              item.entityType === entityType && item.entityId === entityId;
            return (
              <div key={`${item.entityType}-${item.entityId}-${index}`} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {}}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap",
                    isCurrent
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                      : "bg-muted text-[var(--text-muted)] border-[var(--border)] hover:bg-muted/80"
                  )}
                >
                  {item.entityType.replace(/([A-Z])/g, " $1").trim()}
                </button>
                {index < chain.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {story.notes && story.notes.length > 0 && (
        <div className="space-y-2">
          {story.notes.map((note: string, index: number) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[12px] text-amber-800"
            >
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-[var(--border-light)] pt-4">
        <ActivityTimeline activities={story.entries} />
      </div>
    </div>
  );
}

export function EntityStoryDrawer({
  open,
  onClose,
  entityType,
  entityId,
}: EntityStoryDrawerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entityId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[15px] font-bold text-[var(--text-heading)]">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[11px] font-medium capitalize"
              >
                {entityType.replace(/([A-Z])/g, " $1").trim()}
              </Badge>
              <span className="font-mono text-[12px] text-[var(--text-muted)]">
                {entityId.slice(0, 12)}...
              </span>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Entity story timeline for {entityType} {entityId.slice(0, 12)}
          </SheetDescription>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 text-[11px] text-[var(--text-muted)]"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy ID"}
            </Button>
          </div>
        </SheetHeader>

        <Suspense
          fallback={
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-7 w-16 rounded-full" />
                ))}
              </div>
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <EntityStoryContent entityType={entityType} entityId={entityId} />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}
