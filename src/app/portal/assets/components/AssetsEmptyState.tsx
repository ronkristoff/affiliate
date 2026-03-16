"use client";

import { Images } from "lucide-react";

interface AssetsEmptyStateProps {
  primaryColor: string;
}

export function AssetsEmptyState({ primaryColor }: AssetsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: `${primaryColor}15` }}
      >
        <Images className="h-8 w-8" style={{ color: primaryColor }} />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No Brand Assets Yet
      </h3>
      
      <p className="text-muted-foreground max-w-sm">
        The program owner hasn&apos;t uploaded any marketing assets yet. 
        Check back soon for logos, banners, and promotional copy you can use.
      </p>
    </div>
  );
}
