"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

export function useNotifications(userId: Id<"users"> | undefined) {
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const notifications = userId
    ? useQuery(api.notifications.listNotifications, {
        userId,
        typeFilter,
        unreadOnly,
      })
    : useQuery(api.notifications.listNotifications, "skip");

  const markRead = useMutation(api.notifications.markNotificationRead);
  const markAllRead = useMutation(api.notifications.markAllNotificationsRead);

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await markAllRead({ userId });
  };

  return {
    notifications: notifications ?? [],
    isDone: true,
    isLoading: notifications === undefined,
    continueCursor: null,
    markRead,
    markAllRead: handleMarkAllRead,
    loadMore: () => {},
    typeFilter,
    setTypeFilter,
    unreadOnly,
    setUnreadOnly,
  };
}
