"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useQueryState, parseAsString } from "nuqs";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  X,
  Clock,
  Shield,
  Mail,
  DollarSign,
  Users,
  Lock,
  Filter,
  ChevronDown,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUDIT_ACTION_CATEGORIES,
  getActionCategory,
} from "@/lib/audit-constants";
import type { TimelineEntry } from "./TimelineEvent";
import type { UserSearchResult } from "./UserSearchResults";
import { UserSearchResults } from "./UserSearchResults";
import { TimelineDateGroup, groupByDate } from "./TimelineDateGroup";
import type { LoginAttemptEntry } from "./TimelineLoginAttemptEvent";
import type { EmailEventEntry } from "./TimelineEmailEvent";
import { TimelineLoginAttemptEvent } from "./TimelineLoginAttemptEvent";
import { TimelineEmailEvent } from "./TimelineEmailEvent";
import { format, isToday, isYesterday, isThisYear } from "date-fns";

// ---------------------------------------------------------------------------
// Types — Unified timeline entry (normalized from 3 data sources)
// ---------------------------------------------------------------------------

type UnifiedEntrySource = "audit" | "loginAttempt" | "email";

interface UnifiedTimelineEntry {
  source: UnifiedEntrySource;
  id: string;
  timestamp: number;
  /** Derived category for filtering: auth | email | money | affiliates | security */
  category: string;
  auditEntry?: TimelineEntry;
  loginEntry?: LoginAttemptEntry;
  emailEntry?: EmailEventEntry;
}

/** Auth-related email types that should be categorized under "Auth" tab */
const AUTH_EMAIL_TYPES = new Set([
  "otp_verification", "otp", "verification", "email_verification",
  "password_reset", "welcome", "two_factor", "2fa", "magic_link",
]);

function deriveCategory(entry: UnifiedTimelineEntry): string {
  if (entry.source === "loginAttempt") return "auth";
  if (entry.source === "email") {
    const emailType = entry.emailEntry?.type ?? "";
    const lower = emailType.toLowerCase();
    for (const authType of AUTH_EMAIL_TYPES) {
      if (lower.includes(authType)) return "auth";
    }
    return "email";
  }
  // source === "audit"
  return getActionCategory(entry.auditEntry?.action ?? "") ?? "email";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMELINE_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 150;
const SEARCH_MIN_CHARS = 2;

const CATEGORY_TABS = [
  { key: "all", label: "All", icon: <Filter className="w-3.5 h-3.5" /> },
  { key: "auth", label: "Auth", icon: <Shield className="w-3.5 h-3.5" /> },
  { key: "email", label: "Email", icon: <Mail className="w-3.5 h-3.5" /> },
  { key: "money", label: "Money", icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: "affiliates", label: "Affiliates", icon: <Users className="w-3.5 h-3.5" /> },
  { key: "security", label: "Security", icon: <Lock className="w-3.5 h-3.5" /> },
] as const;

type CategoryKey = (typeof CATEGORY_TABS)[number]["key"];

const DATE_RANGES = [
  { key: "all", label: "All time" },
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
] as const;

type DateRangeKey = (typeof DATE_RANGES)[number]["key"];

function getDateRangeBounds(
  range: DateRangeKey,
): { startDate?: number; endDate?: number } {
  const now = Date.now();
  switch (range) {
    case "24h":
      return { startDate: now - 24 * 60 * 60 * 1000, endDate: now };
    case "7d":
      return { startDate: now - 7 * 24 * 60 * 60 * 1000, endDate: now };
    case "30d":
      return { startDate: now - 30 * 24 * 60 * 60 * 1000, endDate: now };
    case "90d":
      return { startDate: now - 90 * 24 * 60 * 60 * 1000, endDate: now };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Content Component
// ---------------------------------------------------------------------------

function UserTimelineContent() {
  // ── URL state ──────────────────────────────────────────────────────────
  const [email, setEmail] = useQueryState("email", parseAsString.withDefault(""));
  const [userId, setUserId] = useQueryState("userId", parseAsString.withDefault(""));
  const [affiliateId, setAffiliateId] = useQueryState("affiliateId", parseAsString.withDefault(""));
  const [selectedType, setSelectedType] = useQueryState("type", parseAsString.withDefault(""));
  const [category, setCategory] = useQueryState("category", parseAsString.withDefault("all"));
  const [dateRange, setDateRange] = useQueryState("range", parseAsString.withDefault("all"));

  // ── Local state ────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(email);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [continueCursor, setContinueCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [accumulatedAudit, setAccumulatedAudit] = useState<TimelineEntry[]>([]);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const dateRangeRef = useRef<HTMLDivElement>(null);

  // ── Sync search input with URL param ──────────────────────────────────
  useEffect(() => {
    setSearchInput(email);
  }, [email]);

  // ── Debounced search query ────────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState(email);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      setEmail(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.length >= SEARCH_MIN_CHARS) {
        debounceRef.current = setTimeout(() => {
          setDebouncedSearch(value);
          setIsDropdownOpen(true);
        }, SEARCH_DEBOUNCE_MS);
      } else {
        setDebouncedSearch("");
        setIsDropdownOpen(false);
      }
    },
    [setEmail],
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setEmail("");
    setUserId("");
    setAffiliateId("");
    setSelectedType("");
    setDebouncedSearch("");
    setIsDropdownOpen(false);
    setAccumulatedAudit([]);
    setContinueCursor(null);
    setIsDone(false);
  }, [setEmail, setUserId, setAffiliateId, setSelectedType]);

  // ── Search query ──────────────────────────────────────────────────────
  const searchResults = useQuery(
    api.admin.audit.searchUsersAcrossTenants,
    debouncedSearch.length >= SEARCH_MIN_CHARS ? { query: debouncedSearch } : "skip",
  );

  // ── Deep link: auto-select if query matches exactly one user ─────────
  useEffect(() => {
    if (
      email.length >= SEARCH_MIN_CHARS &&
      searchResults &&
      searchResults.length === 1 &&
      !userId &&
      !affiliateId
    ) {
      const result = searchResults[0];
      setUserId(result.userId ?? "");
      setAffiliateId(result.affiliateId ?? "");
      setSelectedType(result.type);
      setIsDropdownOpen(false);
    }
  }, [email, searchResults, userId, affiliateId, setUserId, setAffiliateId, setSelectedType]);

  // ── Selected user info ───────────────────────────────────────────────
  const selectedUser = useMemo(() => {
    if (!searchResults) return null;
    if (userId) return searchResults.find((r) => r.userId === userId) ?? null;
    if (affiliateId) return searchResults.find((r) => r.affiliateId === affiliateId) ?? null;
    return null;
  }, [searchResults, userId, affiliateId]);

  // ── Handle user selection ────────────────────────────────────────────
  const handleSelectUser = useCallback(
    (result: UserSearchResult) => {
      setUserId(result.userId ?? "");
      setAffiliateId(result.affiliateId ?? "");
      setSelectedType(result.type);
      setEmail(result.email);
      setSearchInput(result.email);
      setIsDropdownOpen(false);
      setAccumulatedAudit([]);
      setContinueCursor(null);
      setIsDone(false);
    },
    [setUserId, setAffiliateId, setSelectedType, setEmail],
  );

  // ── Timeline query (audit logs — paginated) ──────────────────────────
  const { startDate, endDate } = useMemo(
    () => getDateRangeBounds(dateRange as DateRangeKey),
    [dateRange],
  );

  const hasSelection = !!(userId || affiliateId || email);

  const timelineResult = useQuery(
    api.admin.audit.getUserTimeline,
    hasSelection
      ? {
          userId: userId ? userId as any : undefined,
          affiliateId: affiliateId ? affiliateId as any : undefined,
          email: email || undefined,
          paginationOpts: {
            numItems: TIMELINE_PAGE_SIZE,
            cursor: continueCursor,
          },
          startDate,
          endDate,
        }
      : "skip",
  );

  // ── Login attempts query (parallel, capped at 50) ───────────────────
  const loginAttempts = useQuery(
    api.admin.audit.getUserLoginAttempts,
    hasSelection && email ? { email, limit: 50 } : "skip",
  );

  // ── Email events query (parallel, capped at 50) ─────────────────────
  const emailEvents = useQuery(
    api.admin.audit.getUserEmailEvents,
    hasSelection && email ? { email, limit: 50 } : "skip",
  );

  // ── Accumulate audit entries (for load more) ─────────────────────────
  useEffect(() => {
    if (!timelineResult) return;
    if (continueCursor === null) {
      setAccumulatedAudit(timelineResult.page);
    } else {
      setAccumulatedAudit((prev) => [...prev, ...timelineResult.page]);
    }
    setContinueCursor(timelineResult.isDone ? null : (timelineResult.continueCursor ?? null));
    setIsDone(timelineResult.isDone);
  }, [timelineResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset when filters change ────────────────────────────────────────
  useEffect(() => {
    if (!hasSelection) return;
    setAccumulatedAudit([]);
    setContinueCursor(null);
    setIsDone(false);
  }, [category, dateRange, userId, affiliateId, email, hasSelection]);

  // ── Merge all 3 sources into unified timeline ─────────────────────────
  const allUnified: UnifiedTimelineEntry[] = useMemo(() => {
    const entries: UnifiedTimelineEntry[] = [];

    // Audit log entries
    for (const audit of accumulatedAudit) {
      entries.push({
        source: "audit",
        id: audit._id,
        timestamp: audit._creationTime,
        category: getActionCategory(audit.action) ?? "email",
        auditEntry: audit,
      });
    }

    // Login attempts
    if (loginAttempts) {
      for (const la of loginAttempts) {
        entries.push({
          source: "loginAttempt",
          id: la._id,
          timestamp: la.failedAt,
          category: "auth",
          loginEntry: la,
        });
      }
    }

    // Email events
    if (emailEvents) {
      for (const em of emailEvents) {
        const lower = em.type.toLowerCase();
        let emailCat = "email";
        for (const authType of AUTH_EMAIL_TYPES) {
          if (lower.includes(authType)) {
            emailCat = "auth";
            break;
          }
        }
        entries.push({
          source: "email",
          id: em._id,
          timestamp: em._creationTime,
          category: emailCat,
          emailEntry: em,
        });
      }
    }

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);

    return entries;
  }, [accumulatedAudit, loginAttempts, emailEvents]);

  // ── Client-side category filtering ───────────────────────────────────
  const filteredEntries = useMemo(() => {
    if (category === "all") return allUnified;
    return allUnified.filter((e) => e.category === category);
  }, [allUnified, category]);

  // ── Category counts ──────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allUnified.length };
    for (const entry of allUnified) {
      counts[entry.category] = (counts[entry.category] ?? 0) + 1;
    }
    return counts;
  }, [allUnified]);

  // ── Grouped entries by date ──────────────────────────────────────────
  const dateGroups = useMemo(() => {
    const groupMap = new Map<string, { dateKey: string; dateLabel: string; latestTimestamp: number; entries: UnifiedTimelineEntry[] }>();

    for (const entry of filteredEntries) {
      const date = new Date(entry.timestamp);
      const dateKey = format(date, "yyyy-MM-dd");

      let group = groupMap.get(dateKey);
      if (!group) {
        let dateLabel: string;
        if (isToday(date)) dateLabel = "Today";
        else if (isYesterday(date)) dateLabel = "Yesterday";
        else if (isThisYear(date)) dateLabel = format(date, "EEEE, MMM d");
        else dateLabel = format(date, "EEEE, MMM d, yyyy");

        group = { dateKey, dateLabel, latestTimestamp: entry.timestamp, entries: [] };
        groupMap.set(dateKey, group);
      }

      group.entries.push(entry);
      if (entry.timestamp > group.latestTimestamp) {
        group.latestTimestamp = entry.timestamp;
      }
    }

    return Array.from(groupMap.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp);
  }, [filteredEntries]);

  // ── Click outside handlers ──────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (dateRangeRef.current && !dateRangeRef.current.contains(e.target as Node)) {
        setDateRangeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Derived state ───────────────────────────────────────────────────
  const isLoadingTimeline = hasSelection && timelineResult === undefined && accumulatedAudit.length === 0;
  const isLoadingLogin = hasSelection && loginAttempts === undefined;
  const isLoadingEmail = hasSelection && emailEvents === undefined;
  const isLoading = isLoadingTimeline || isLoadingLogin || isLoadingEmail;
  const hasNoUser = !hasSelection;
  const hasNoEntries = !isLoading && dateGroups.length === 0;

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar description="Search any user and see their complete activity history">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          User Timeline
        </h1>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        <div className="space-y-5">
          {/* ── Search Bar ──────────────────────────────────────────── */}
          <FadeIn delay={0}>
            <div ref={searchRef} className="relative max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => {
                    if (searchInput.length >= SEARCH_MIN_CHARS && searchResults && searchResults.length > 0) {
                      setIsDropdownOpen(true);
                    }
                  }}
                  placeholder="Search user or affiliate by name, email, or code..."
                  className={cn(
                    "w-full pl-10 pr-10 py-2.5 text-sm rounded-lg",
                    "bg-white border border-[var(--border-light)] shadow-sm",
                    "placeholder:text-[var(--text-muted)]",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]",
                    "transition-all",
                  )}
                />
                {searchInput && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Selected user badge */}
              {selectedUser && !isDropdownOpen && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="info" className="text-[11px] px-2 py-0.5 gap-1">
                    <Users className="w-3 h-3" />
                    {selectedUser.name ?? selectedUser.email}
                    <span className="text-[10px] opacity-60">
                      ({selectedUser.tenantName})
                    </span>
                  </Badge>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {selectedUser.email}
                  </span>
                  {selectedUser.type === "affiliate" && (
                    <Badge variant="success" className="text-[9px] px-1.5 py-0">
                      Affiliate
                    </Badge>
                  )}
                </div>
              )}

              {/* Dropdown */}
              {isDropdownOpen && (
                <UserSearchResults
                  results={searchResults ?? []}
                  isLoading={searchResults === undefined}
                  onSelect={handleSelectUser}
                  selectedUserId={userId || affiliateId || undefined}
                />
              )}
            </div>
          </FadeIn>

          {/* ── No user selected state ─────────────────────────────── */}
          {hasNoUser && (
            <FadeIn delay={60}>
              <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
                <div className="w-16 h-16 rounded-2xl bg-[var(--brand-light)]/30 flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-[var(--brand-secondary)]/40" />
                </div>
                <p className="text-sm font-medium mb-1">Search for a user to view their timeline</p>
                <p className="text-[12px]">
                  Type a name, email, or affiliate code to find users across all tenants
                </p>
              </div>
            </FadeIn>
          )}

          {/* ── Filters + Timeline ──────────────────────────────────── */}
          {!hasNoUser && (
            <div className="space-y-4">
              {/* Category filter tabs */}
              <FadeIn delay={60}>
                <div className="flex items-center gap-1 flex-wrap">
                  {CATEGORY_TABS.map((tab) => {
                    const isActive = category === tab.key;
                    const count = categoryCounts[tab.key] ?? 0;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setCategory(tab.key)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                          isActive
                            ? "bg-[var(--brand-primary)] text-white"
                            : "bg-white border border-[var(--border-light)] text-[var(--text-muted)] hover:bg-[var(--brand-light)]/30 hover:text-[var(--text-heading)]",
                        )}
                      >
                        {tab.icon}
                        {tab.label}
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0 rounded-full",
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-[var(--bg-page)] text-[var(--text-muted)]",
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </FadeIn>

              {/* Date range selector */}
              <FadeIn delay={90}>
                <div ref={dateRangeRef} className="relative inline-block">
                  <button
                    onClick={() => setDateRangeOpen((prev) => !prev)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                      dateRange !== "all"
                        ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20"
                        : "bg-white border border-[var(--border-light)] text-[var(--text-muted)] hover:bg-[var(--brand-light)]/30",
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {DATE_RANGES.find((r) => r.key === dateRange)?.label ?? "All time"}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
                  {dateRangeOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-[var(--border-light)] rounded-lg shadow-xl overflow-hidden z-50 min-w-[120px]">
                      {DATE_RANGES.map((range) => (
                        <button
                          key={range.key}
                          onClick={() => {
                            setDateRange(range.key);
                            setDateRangeOpen(false);
                          }}
                          className={cn(
                            "block w-full text-left px-3 py-2 text-[12px] transition-colors",
                            dateRange === range.key
                              ? "bg-[var(--brand-light)]/30 text-[var(--brand-primary)] font-medium"
                              : "text-[var(--text-body)] hover:bg-[var(--brand-light)]/20",
                          )}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FadeIn>

              {/* Timeline content */}
              <FadeIn delay={120}>
                <div className="bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm">
                  {/* Top gradient */}
                  <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/20 to-transparent" />

                  {isLoading ? (
                    /* Loading skeleton */
                    <div className="p-6 space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : hasNoEntries ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                      <div className="w-12 h-12 rounded-full bg-[var(--brand-light)]/50 flex items-center justify-center mb-3">
                        <Activity className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium mb-1">No activity recorded for this user</p>
                      <p className="text-[12px]">
                        {category !== "all" || dateRange !== "all"
                          ? "Try adjusting your filters"
                          : "Audit events will appear here as the user interacts with the platform"}
                      </p>
                    </div>
                  ) : (
                    /* Timeline */
                    <div className="p-4 space-y-4">
                      {/* Entry count */}
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                        <Activity className="w-3 h-3" />
                        {filteredEntries.length} event{filteredEntries.length !== 1 ? "s" : ""}
                        {category !== "all" && ` in ${category}`}
                      </div>

                      {dateGroups.map((group, idx) => (
                        <div key={group.dateKey} className="space-y-1">
                          {/* Date header */}
                          <div className="flex items-center gap-2 px-2 py-1">
                            <span className="text-[13px] font-semibold text-[var(--text-heading)]">
                              {group.dateLabel}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {group.entries.length} event{group.entries.length !== 1 ? "s" : ""}
                            </span>
                          </div>

                          {/* Events */}
                          <div className="ml-2 border-l border-[var(--border-light)] pl-3 space-y-0.5">
                            {group.entries.map((entry) => {
                              if (entry.source === "loginAttempt" && entry.loginEntry) {
                                return (
                                  <TimelineLoginAttemptEvent
                                    key={`la-${entry.id}`}
                                    entry={entry.loginEntry}
                                  />
                                );
                              }
                              if (entry.source === "email" && entry.emailEntry) {
                                return (
                                  <TimelineEmailEvent
                                    key={`em-${entry.id}`}
                                    entry={entry.emailEntry}
                                  />
                                );
                              }
                              if (entry.source === "audit" && entry.auditEntry) {
                                // Inline the TimelineEvent rendering to avoid importing
                                // the component which expects a specific format
                                return (
                                  <div key={`au-${entry.id}`}>
                                    {(() => {
                                      // Lazy import the component to avoid circular deps
                                      // We use a simple inline render here
                                      return <AuditEventInline entry={entry.auditEntry!} />;
                                    })()}
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Load more audit logs (login/email are already fully fetched) */}
                      {!isDone && (
                        <div className="pt-2 flex justify-center">
                          <button
                            disabled={!continueCursor}
                            onClick={() => {
                              // The useQuery will re-fire when continueCursor changes
                            }}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                              continueCursor
                                ? "bg-white border border-[var(--border-light)] text-[var(--text-body)] hover:bg-[var(--brand-light)]/30"
                                : "bg-[var(--bg-page)] text-[var(--text-muted)] cursor-not-allowed",
                            )}
                          >
                            Load more audit events
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom gradient */}
                  <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/10 to-transparent" />
                </div>
              </FadeIn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline audit event renderer (avoids separate component import issues)
// ---------------------------------------------------------------------------

import { TimelineEvent } from "./TimelineEvent";

function AuditEventInline({ entry }: { entry: TimelineEntry }) {
  return <TimelineEvent entry={entry} />;
}

// ---------------------------------------------------------------------------
// Page export (wrapped in Suspense)
// ---------------------------------------------------------------------------

function UserTimelineSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border-light)] px-8 py-3">
        <Skeleton className="h-5 w-32 mb-1" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="px-8 pt-6 pb-8 space-y-5">
        <Skeleton className="h-10 w-xl rounded-lg" />
        <div className="flex gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-[var(--border-light)] overflow-hidden p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UserTimelinePage() {
  return (
    <Suspense fallback={<UserTimelineSkeleton />}>
      <UserTimelineContent />
    </Suspense>
  );
}
