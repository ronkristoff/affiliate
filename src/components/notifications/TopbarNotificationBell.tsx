"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";

/**
 * Notification bell for the PageTopbar.
 *
 * Renders the NotificationPanel (Radix Popover) for the authenticated user.
 * No fallback needed — both (auth) and (admin) layouts block rendering
 * until `getCurrentUser` resolves, so this component only mounts when
 * the user is guaranteed to exist.
 */
export function TopbarNotificationBell() {
  const user = useQuery(api.auth.getCurrentUser);

  if (!user) return null;

  return <NotificationPanel userId={user._id} />;
}
