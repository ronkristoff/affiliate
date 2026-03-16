"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

interface Asset {
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

interface AssetCardProps {
  asset: Asset;
  primaryColor: string;
}

export function AssetCard({ asset, primaryColor }: AssetCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    if (!asset.fileUrl) {
      toast.error("Download not available");
      return;
    }

    setIsDownloading(true);
    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = asset.fileUrl;
      link.download = asset.title;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Download started");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download asset");
    } finally {
      setIsDownloading(false);
    }
  };

  const dimensionsText = asset.dimensions 
    ? `${asset.dimensions.width} × ${asset.dimensions.height}` 
    : null;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail Preview */}
      <div 
        className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: `${primaryColor}10` }}
      >
        {asset.fileUrl ? (
          <img 
            src={asset.fileUrl} 
            alt={asset.title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-gray-400 text-sm">No preview</div>
        )}
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold line-clamp-1">
          {asset.title}
        </CardTitle>
        {asset.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {asset.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          {asset.format && (
            <span className="uppercase bg-gray-100 px-2 py-1 rounded">
              {asset.format}
            </span>
          )}
          {dimensionsText && (
            <span>{dimensionsText}</span>
          )}
        </div>

        {/* Action Button */}
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full"
          style={{ backgroundColor: primaryColor }}
          size="sm"
        >
          {isDownloading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⟳</span>
              Downloading...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
