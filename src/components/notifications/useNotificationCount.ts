"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function useNotificationCount(userId: Id<"users"> | undefined) {
  const unreadCount = useQuery(
    userId ? api.notifications.getUnreadNotificationCount : undefined,
    userId ? { userId } : "SKIP"
  );

  return {
    total: unreadCount?.total ?? 0,
    isLoading: unreadCount === undefined,
  };
}
