"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AssetCard } from "./AssetCard";
import { CopyTextCard } from "./CopyTextCard";
import { Id } from "@/convex/_generated/dataModel";

interface ImageAsset {
  _id: Id<"brandAssets">;
  title: string;
  description?: string;
  fileUrl?: string;
  storageId?: Id<"_storage">;
  format?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  sortOrder?: number;
}

interface CopyTextAsset {
  _id: Id<"brandAssets">;
  title: string;
  description?: string;
  textContent?: string;
  sortOrder?: number;
}

interface AssetCategorySectionProps {
  title: string;
  imageAssets?: ImageAsset[];
  textAssets?: CopyTextAsset[];
  icon?: React.ReactNode;
}

export function AssetCategorySection({
  title,
  imageAssets = [],
  textAssets = [],
  icon,
}: AssetCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const hasAssets = imageAssets.length > 0 || textAssets.length > 0;

  if (!hasAssets) {
    return null;
  }

  return (
    <section className="mb-8">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-4 py-2 border-b border-gray-200 hover:border-gray-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-[var(--portal-primary)]">{icon}</span>}
          <h2 
            className="text-lg font-bold text-[var(--portal-primary)]"
          >
            {title}
          </h2>
          <span 
            className="text-sm px-2 py-0.5 rounded-full bg-[var(--portal-primary)]/10 text-[var(--portal-primary)]"
          >
            {imageAssets.length + textAssets.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {/* Assets Grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Image Assets */}
          {imageAssets.map((asset) => (
            <AssetCard 
              key={asset._id} 
              asset={asset} 
            />
          ))}
          
          {/* Text Assets */}
          {textAssets.map((asset) => (
            <CopyTextCard 
              key={asset._id} 
              asset={asset} 
            />
          ))}
        </div>
      )}
    </section>
  );
}
