"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

interface CopyTextAsset {
  _id: Id<"brandAssets">;
  title: string;
  description?: string;
  textContent?: string;
  sortOrder?: number;
}

interface CopyTextCardProps {
  asset: CopyTextAsset;
  primaryColor: string;
}

export function CopyTextCard({ asset, primaryColor }: CopyTextCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!asset.textContent) {
      toast.error("No text to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(asset.textContent);
      setCopied(true);
      toast.success("Copied to clipboard");
      
      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy error:", error);
      toast.error("Failed to copy text");
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-semibold line-clamp-1">
            {asset.title}
          </CardTitle>
          <span 
            className="text-xs px-2 py-1 rounded uppercase"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          >
            Text
          </span>
        </div>
        {asset.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {asset.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Text Preview */}
        <div 
          className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-3 max-h-32 overflow-y-auto"
        >
          {asset.textContent || "No content"}
        </div>

        {/* Copy Button */}
        <Button
          onClick={handleCopy}
          className="w-full"
          style={{ backgroundColor: primaryColor }}
          size="sm"
        >
          {copied ? (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Copied!
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Copy Text
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
