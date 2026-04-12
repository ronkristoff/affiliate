"use client";

import { useState } from "react";
import { format, isToday, isYesterday, isThisYear } from "date-fns";
import type { TimelineEntry } from "./TimelineEvent";
import { TimelineEvent } from "./TimelineEvent";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGroupDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "EEEE, MMM d");
  return format(date, "EEEE, MMM d, yyyy");
}

function formatGroupCount(count: number): string {
  return `${count} event${count !== 1 ? "s" : ""}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DateGroup {
  dateKey: string;
  dateLabel: string;
  latestTimestamp: number;
  entries: TimelineEntry[];
}

export function groupByDate(entries: TimelineEntry[]): DateGroup[] {
  const groupMap = new Map<string, DateGroup>();

  for (const entry of entries) {
    const date = new Date(entry._creationTime);
    const dateKey = format(date, "yyyy-MM-dd");

    let group = groupMap.get(dateKey);
    if (!group) {
      group = {
        dateKey,
        dateLabel: formatGroupDate(entry._creationTime),
        latestTimestamp: entry._creationTime,
        entries: [],
      };
      groupMap.set(dateKey, group);
    }

    group.entries.push(entry);
  }

  // Return sorted newest-first
  return Array.from(groupMap.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimelineDateGroup({
  group,
  defaultCollapsed = false,
}: {
  group: DateGroup;
  defaultCollapsed?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className="space-y-1">
      {/* Date header */}
      <button
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left group/date-header hover:bg-white/[0.03] rounded-lg px-2 py-1.5 transition-colors"
      >
        <span className="text-white/30 transition-transform">
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </span>
        <span className="text-[13px] font-semibold text-white/70">
          {group.dateLabel}
        </span>
        <span className="text-[11px] text-white/30 font-normal">
          {formatGroupCount(group.entries.length)}
        </span>
      </button>

      {/* Events */}
      {!isCollapsed && (
        <div className="ml-2 border-l border-white/[0.06] pl-3 space-y-0.5">
          {group.entries.map((entry) => (
            <TimelineEvent key={entry._id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
