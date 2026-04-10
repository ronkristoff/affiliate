"use client";

import React, { type ReactNode } from "react";

/**
 * NotificationProvider — placeholder for future notification context.
 * Currently, notifications use direct Convex useQuery/useMutation hooks
 * via useNotificationCount and useNotifications. This provider is
 * reserved for potential future enhancements (e.g., notification
 * preferences, real-time subscriptions via context).
 */

export function NotificationProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
