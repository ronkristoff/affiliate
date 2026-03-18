"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export function NotFoundState() {
  const router = useRouter();

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fee2e2]">
        <AlertTriangle className="h-8 w-8 text-[#ef4444]" />
      </div>
      <h2 className="text-xl font-bold text-[#333333]">Tenant Not Found</h2>
      <p className="max-w-md text-sm text-[#6b7280]">
        The tenant you&apos;re looking for doesn&apos;t exist or has been removed.
        Please check the URL and try again.
      </p>
      <Button
        onClick={() => router.push("/admin/tenants")}
        className="gap-2 bg-[#10409a] text-white hover:bg-[#0d347a]"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to Tenants
      </Button>
    </div>
  );
}
