"use client";

import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

export function ReportsEmptyState() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">No activity this period</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Share your link to start earning! Once people click and sign up, your reports will appear here.
      </p>
      <Button
        onClick={() => router.push("/portal/links")}
        variant="default"
        className="bg-[var(--portal-primary)] hover:bg-[var(--portal-primary)]/90"
      >
        Share Link
      </Button>
    </div>
  );
}
