"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useCallback, useRef } from "react";

const INITIAL_PAGINATION: {
  numItems: number;
  cursor: string | null;
} = {
  numItems: 20,
  cursor: null,
};

export function useNotifications(userId: Id<"users"> | undefined) {
  const [typeFilter, setTypeFilterRaw] = useState<string | undefined>(undefined);
  const [unreadOnly, setUnreadOnlyRaw] = useState(false);
  const [paginationOpts, setPaginationOpts] = useState(INITIAL_PAGINATION);

  // Track previous filter values to detect changes and reset cursor
  const prevFilterRef = useRef({ typeFilter, unreadOnly });

  // Reset cursor to page 1 whenever filters change
  const setTypeFilter = useCallback((value: string | undefined) => {
    setTypeFilterRaw(value);
    setPaginationOpts(INITIAL_PAGINATION);
  }, []);

  const setUnreadOnly = useCallback((value: boolean) => {
    setUnreadOnlyRaw(value);
    setPaginationOpts(INITIAL_PAGINATION);
  }, []);

  const notifications = useQuery(
    userId ? api.notifications.getNotifications : undefined,
    userId
      ? {
          userId,
          paginationOpts,
          typeFilter,
          unreadOnly,
        }
      : "SKIP"
  );

  const markRead = useMutation(api.notifications.markNotificationRead);
  const markAllRead = useMutation(api.notifications.markAllNotificationsRead);

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await markAllRead({ userId });
  };

  const loadMore = () => {
    if (notifications && !notifications.isDone && notifications.continueCursor) {
      setPaginationOpts({
        numItems: 20,
        cursor: notifications.continueCursor,
      });
    }
  };

  return {
    notifications: notifications?.page ?? [],
    isDone: notifications?.isDone ?? true,
    isLoading: notifications === undefined,
    continueCursor: notifications?.continueCursor,
    markRead,
    markAllRead: handleMarkAllRead,
    loadMore,
    typeFilter,
    setTypeFilter,
    unreadOnly,
    setUnreadOnly,
  };
}
