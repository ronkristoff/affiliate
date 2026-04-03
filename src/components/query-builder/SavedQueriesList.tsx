"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SavedQueriesListSkeleton } from "./skeletons";
import type { QueryConfig } from "@/hooks/useQueryBuilder";
import {
  Trash2,
  Share2,
  Play,
  Bookmark,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface SavedQueriesListProps {
  onLoadQuery: (config: QueryConfig) => void;
  onShareQuery?: (queryId: string) => void;
}

function timeAgo(date: number): string {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function SavedQueriesList({ onLoadQuery, onShareQuery }: SavedQueriesListProps) {
  const queries = useQuery(api.queryBuilder.listSavedQueries);
  const deleteMutation = useMutation(api.queryBuilder.deleteSavedQuery);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!queries) {
    return <SavedQueriesListSkeleton />;
  }

  const handleDelete = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      await deleteMutation({ queryId: id as Id<"savedQueries"> });
      toast.success(`Deleted "${name}"`);
    } catch {
      toast.error("Failed to delete query");
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoad = (query: { queryConfig: string; name: string }) => {
    try {
      const parsed = JSON.parse(query.queryConfig) as QueryConfig;
      onLoadQuery(parsed);
      toast.success(`Loaded "${query.name}"`);
    } catch {
      toast.error("Failed to parse saved query configuration");
    }
  };

  if (queries.length === 0) {
    return (
      <div className="text-center py-8">
        <Bookmark className="w-8 h-8 mx-auto text-[var(--text-muted)]/30 mb-2" />
        <p className="text-sm text-[var(--text-muted)]">No saved queries yet</p>
        <p className="text-xs text-[var(--text-muted)]/70 mt-1">
          Build a query and save it for later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {queries.map((query: Record<string, unknown>) => {
        const q = query as {
          _id: string;
          name: string;
          description?: string;
          queryConfig: string;
          isShared: boolean;
          sharedWithRoles: string[];
          canEdit: boolean;
          createdAt: number;
        };
        return (
          <div
            key={q._id}
            className="group rounded-xl border border-[var(--border)] bg-white p-3 transition-all hover:border-[#1fb5a5]/30 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--text-heading)] truncate">
                    {q.name}
                  </span>
                  {q.isShared && (
                    <Badge variant="info" className="text-[9px] px-1.5 py-0 shrink-0">
                      <Share2 className="w-2 h-2 mr-0.5" />
                      Shared
                    </Badge>
                  )}
                </div>
                {q.description && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                    {q.description}
                  </p>
                )}
              </div>
            </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {timeAgo(q.createdAt)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2 text-[#1fb5a5] hover:text-[#1c2260]"
                    onClick={() => handleLoad(q)}
                  >
                    <Play className="w-3 h-3" />
                    Load
                  </Button>
                  {onShareQuery && q.canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onShareQuery(q._id)}
                    >
                      <Share2 className="w-3 h-3" />
                    </Button>
                  )}
                  {q.canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-50 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(q._id, q.name)}
                      disabled={deletingId === q._id}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
          </div>
        );
      })}
    </div>
  );
}
