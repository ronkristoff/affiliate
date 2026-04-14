"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function useNotificationCount(userId: Id<"users"> | undefined) {
  const unreadCount = userId
    ? useQuery(api.notifications.getUnreadNotificationCount, { userId })
    : useQuery(api.notifications.getUnreadNotificationCount, "skip");

  return {
    total: unreadCount?.total ?? 0,
    isLoading: unreadCount === undefined,
  };
}
