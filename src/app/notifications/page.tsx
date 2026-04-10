"use client";

import { Suspense } from "react";
import { NotificationsContent, NotificationsLoadingSkeleton } from "@/components/notifications/NotificationsPageContent";

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsLoadingSkeleton />}>
      <NotificationsContent />
    </Suspense>
  );
}
