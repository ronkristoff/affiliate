"use client";

import { Images } from "lucide-react";

export function AssetsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-[var(--portal-primary)]/10"
      >
        <Images className="h-8 w-8 text-[var(--portal-primary)]" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No Brand Assets Yet
      </h3>
      
      <p className="text-muted-foreground max-w-sm">
        Brand assets are ready-made marketing materials — logos, banners, and
        promotional images — that help you promote the program consistently and
        professionally. Using branded assets builds trust with your audience and
        improves conversion rates.
      </p>
      <p className="text-sm text-muted-foreground mt-3">
        No assets have been uploaded yet. Contact your program manager to get
        started.
      </p>
    </div>
  );
}
