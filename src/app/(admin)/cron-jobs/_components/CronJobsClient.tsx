"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow, format } from "date-fns";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Play,
  Pause,
  ChevronDown,
  TriangleAlert,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CronConfig {
  _id: string;
  name: string;
  handlerRef: string;
  enabled: boolean;
  intervalHours: number;
  description: string;
  lastFinishedAt?: number;
  lastScheduledAt?: number;
  extraArgs?: Record<string, unknown>;
}

interface CronExecution {
  _id: string;
  jobName: string;
  status: "success" | "failed" | "running";
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  resultSummary?: string;
  error?: string;
}

function formatInterval(hours: number): string {
  if (hours === 1) return "Every 1 hour";
  if (hours < 24) return `Every ${hours} hours`;
  const days = hours / 24;
  if (Number.isInteger(days)) return `Every ${days} day${days === 1 ? "" : "s"}`;
  return `Every ${days.toFixed(1)} days`;
}

function formatRelative(timestamp: number | undefined): string {
  if (!timestamp) return "Never";
  return formatDistanceToNow(timestamp, { addSuffix: true });
}

function estimateNextRun(
  lastFinishedAt: number | undefined,
  intervalHours: number,
  enabled: boolean,
): string {
  if (!enabled) return "Disabled";
  if (!lastFinishedAt) return "Pending";
  const nextMs = lastFinishedAt + intervalHours * 3600_000;
  const now = Date.now();
  if (nextMs <= now) return "Due now";
  return formatDistanceToNow(nextMs, { addSuffix: false }) + " from now";
}

const INTERVAL_OPTIONS = [1, 2, 4, 6, 8, 12, 24, 48, 72, 168];

function CronConfigCard({
  config,
  onToggle,
  onIntervalChange,
  isToggling,
}: {
  config: CronConfig;
  onToggle: (name: string, enable: boolean) => void;
  onIntervalChange: (name: string, hours: number) => void;
  isToggling: boolean;
}) {
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowIntervalPicker(false);
      }
    }
    if (showIntervalPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showIntervalPicker]);

  return (
    <div className="bg-white rounded-xl border border-[var(--border-light)] shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            <h3 className="text-sm font-semibold text-[var(--text-heading)] truncate">
              {config.name}
            </h3>
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mt-1 leading-relaxed">
            {config.description}
          </p>
        </div>
        <Badge
          variant={config.enabled ? "success" : "neutral"}
          className="shrink-0 text-[10px] px-2 py-0.5"
        >
          {config.enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
        <div>
          <div className="text-[var(--text-muted)] mb-0.5">Interval</div>
          <div className="font-medium text-[var(--text-body)]">
            {formatInterval(config.intervalHours)}
          </div>
        </div>
        <div>
          <div className="text-[var(--text-muted)] mb-0.5">Last Run</div>
          <div className="font-medium text-[var(--text-body)]">
            {formatRelative(config.lastFinishedAt)}
          </div>
        </div>
        <div>
          <div className="text-[var(--text-muted)] mb-0.5">Next Run</div>
          <div className="font-medium text-[var(--text-body)]">
            {estimateNextRun(
              config.lastFinishedAt,
              config.intervalHours,
              config.enabled,
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border-light)] flex items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant={config.enabled ? "outline" : "default"}
              size="sm"
              disabled={isToggling}
              className="text-[12px] h-7 px-3"
            >
              {isToggling ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : config.enabled ? (
                <>
                  <Pause className="w-3 h-3 mr-1" />
                  Disable
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Enable
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <TriangleAlert className="w-4 h-4 text-amber-500" />
                {config.enabled ? "Disable" : "Enable"} "{config.name}"?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {config.enabled
                  ? "This will stop the scheduled job from running automatically. You can re-enable it at any time."
                  : "This will start running the job on its configured schedule. The job will execute automatically at the set interval."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-[12px]">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onToggle(config.name, !config.enabled)}
                className={config.enabled ? "text-[12px]" : "text-[12px]"}
              >
                {config.enabled ? "Disable Job" : "Enable Job"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="relative" ref={pickerRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIntervalPicker((p) => !p)}
            className="text-[12px] h-7 px-3"
          >
            <Clock className="w-3 h-3 mr-1" />
            {formatInterval(config.intervalHours)}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
          {showIntervalPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-[var(--border-light)] rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
              {INTERVAL_OPTIONS.map((h) => (
                <Button
                  key={h}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-[12px] h-7 px-3 font-normal",
                    h === config.intervalHours &&
                      "text-[var(--brand-primary)] font-medium bg-[var(--brand-light)]/30 hover:bg-[var(--brand-light)]/40"
                  )}
                  onClick={() => {
                    onIntervalChange(config.name, h);
                    setShowIntervalPicker(false);
                  }}
                >
                  {formatInterval(h)}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
      return (
        <Badge variant="success" className="text-[10px] px-2 py-0">
          <CheckCircle2 className="w-3 h-3 mr-0.5" />
          Success
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="text-[10px] px-2 py-0">
          <XCircle className="w-3 h-3 mr-0.5" />
          Failed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="text-[10px] px-2 py-0 border-blue-300 text-blue-600">
          <Loader2 className="w-3 h-3 mr-0.5 animate-spin" />
          Running
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ExecutionRow({ execution }: { execution: CronExecution }) {
  return (
    <div className="group px-5 py-3 border-b border-[var(--border-light)] last:border-b-0 hover:bg-[var(--brand-light)]/20 transition-colors">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--text-heading)] truncate">
              {execution.jobName}
            </span>
            <StatusBadge status={execution.status} />
          </div>
          {(execution.resultSummary || execution.error) && (
            <div className="mt-1 text-[11px] text-[var(--text-muted)] font-mono truncate max-w-[500px]">
              {execution.error
                ? `Error: ${execution.error}`
                : execution.resultSummary}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right space-y-0.5">
          <div className="text-[12px] text-[var(--text-body)]">
            {format(new Date(execution.startedAt), "MMM d, HH:mm:ss")}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {execution.durationMs < 1000
              ? `${execution.durationMs}ms`
              : `${(execution.durationMs / 1000).toFixed(1)}s`}
          </div>
        </div>
      </div>
    </div>
  );
}

function CronJobsContent() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [jobNameFilter, setJobNameFilter] = useState<string | null>(null);
  const [togglingJob, setTogglingJob] = useState<string | null>(null);
  const [accumulatedExecutions, setAccumulatedExecutions] = useState<CronExecution[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const configs = useQuery(api.cronAdmin.listCronConfigs, {});
  const stats = useQuery(api.cronAdmin.getCronStats, {});

  const firstPageResult = useQuery(
    api.cronAdmin.listCronExecutions,
    {
      paginationOpts: { numItems: 20, cursor: null },
      jobName: jobNameFilter ?? undefined,
      status: statusFilter ?? undefined,
    },
  );

  const nextPageResult = useQuery(
    api.cronAdmin.listCronExecutions,
    cursor
      ? {
          paginationOpts: { numItems: 20, cursor },
          jobName: jobNameFilter ?? undefined,
          status: statusFilter ?? undefined,
        }
      : "skip",
  );

  const executions = firstPageResult?.page ?? [];

  useEffect(() => {
    setAccumulatedExecutions([]);
    setCursor(null);
    setHasMore(false);
  }, [statusFilter, jobNameFilter]);

  useEffect(() => {
    if (nextPageResult && nextPageResult !== undefined) {
      setAccumulatedExecutions((prev) => [...prev, ...nextPageResult.page]);
      setHasMore(!nextPageResult.isDone);
      setCursor(nextPageResult.continueCursor);
      setIsLoadingMore(false);
    }
  }, [nextPageResult]);

  useEffect(() => {
    if (firstPageResult && firstPageResult !== undefined) {
      setAccumulatedExecutions(firstPageResult.page);
      setHasMore(!firstPageResult.isDone);
      setCursor(firstPageResult.continueCursor);
    }
  }, [firstPageResult]);

  const toggleMutation = useMutation(api.cronAdmin.toggleCronEnabled);
  const intervalMutation = useMutation(api.cronAdmin.updateCronInterval);

  const handleToggle = useCallback(
    async (name: string, enable: boolean) => {
      setTogglingJob(name);
      try {
        await toggleMutation({ jobName: name });
        toast.success(`"${name}" ${enable ? "enabled" : "disabled"} successfully`);
      } catch {
        toast.error(`Failed to ${enable ? "enable" : "disable"} "${name}"`);
      } finally {
        setTogglingJob(null);
      }
    },
    [toggleMutation],
  );

  const handleIntervalChange = useCallback(
    async (name: string, hours: number) => {
      try {
        await intervalMutation({ jobName: name, intervalHours: hours });
        toast.success(`Interval updated for "${name}" to ${formatInterval(hours)}`);
      } catch {
        toast.error(`Failed to update interval for "${name}"`);
      }
    },
    [intervalMutation],
  );

  const isLoadingConfigs = configs === undefined;
  const isLoadingStats = stats === undefined;
  const isLoadingExecutions = firstPageResult === undefined;

  const uniqueJobNames = configs
    ? [...new Set(configs.map((c: CronConfig) => c.name))].sort()
    : [];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <PageTopbar description="Monitor and manage scheduled background jobs">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Cron Jobs
        </h1>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        <div className="space-y-6">
          <FadeIn delay={0}>
            <div className="flex items-center gap-6 text-[12px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                {stats?.totalExecutions ?? 0} executions
              </span>
              <span className="flex items-center gap-1.5 text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {stats?.successCount ?? 0} success
              </span>
              <span className="flex items-center gap-1.5 text-red-600">
                <XCircle className="w-3.5 h-3.5" />
                {stats?.failedCount ?? 0} failed
              </span>
              {stats?.lastRunTime && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Last: {formatRelative(stats.lastRunTime)}
                </span>
              )}
            </div>
          </FadeIn>

          <FadeIn delay={30}>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-heading)] mb-3">
                Job Configurations
              </h2>
              {isLoadingConfigs ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {configs?.map((config: CronConfig) => (
                    <CronConfigCard
                      key={config._id}
                      config={config as CronConfig}
                      onToggle={handleToggle}
                      onIntervalChange={handleIntervalChange}
                      isToggling={togglingJob === config.name}
                    />
                  ))}
                </div>
              )}
            </div>
          </FadeIn>

          <FadeIn delay={60}>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-heading)] mb-3">
                Execution History
              </h2>

              <div className="flex items-center gap-2 mb-3">
                <Select
                  value={jobNameFilter ?? "all"}
                  onValueChange={(v) =>
                    setJobNameFilter(v === "all" ? null : v)
                  }
                >
                  <SelectTrigger className="text-[12px] h-7 w-[180px]">
                    <SelectValue placeholder="All Jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    {uniqueJobNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter ?? "all"}
                  onValueChange={(v) =>
                    setStatusFilter(v === "all" ? null : v)
                  }
                >
                  <SelectTrigger className="text-[12px] h-7 w-[160px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                  </SelectContent>
                </Select>

                {(jobNameFilter || statusFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setJobNameFilter(null);
                      setStatusFilter(null);
                    }}
                    className="text-[12px] h-7 px-2 text-[var(--text-muted)] hover:text-[var(--text-body)]"
                  >
                    Clear filters
                  </Button>
                )}
              </div>

              <div className="bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm">
                <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/20 to-transparent" />

                {isLoadingExecutions ? (
                  <div className="divide-y divide-[var(--border-light)]">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="px-5 py-3 flex items-center gap-4"
                      >
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <div className="flex-1" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : accumulatedExecutions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                    <Clock className="w-8 h-8 mb-2" />
                    <p className="text-sm font-medium mb-1">
                      No executions found
                    </p>
                    <p className="text-[12px]">
                      Executions will appear here once the dispatcher runs.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-light)]">
                    {accumulatedExecutions.map((execution: CronExecution) => (
                      <ExecutionRow
                        key={execution._id}
                        execution={execution as CronExecution}
                      />
                    ))}
                  </div>
                )}

                {hasMore && !isLoadingMore && (
                  <div className="px-5 py-3 border-t border-[var(--border-light)]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsLoadingMore(true);
                      }}
                      className="w-full text-[12px]"
                    >
                      Load more
                    </Button>
                  </div>
                )}

                {isLoadingMore && (
                  <div className="px-5 py-3 border-t border-[var(--border-light)] flex justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                  </div>
                )}

                <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/10 to-transparent" />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

function CronJobsSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="px-8 py-6">
        <Skeleton className="h-5 w-24 mb-1" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="px-8 pb-8 space-y-6">
        <Skeleton className="h-4 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-4 w-40" />
        <div className="bg-white rounded-xl border border-[var(--border-light)] overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="px-5 py-3 flex items-center gap-4 border-b border-[var(--border-light)]"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CronJobsPage() {
  return (
    <Suspense fallback={<CronJobsSkeleton />}>
      <CronJobsContent />
    </Suspense>
  );
}
