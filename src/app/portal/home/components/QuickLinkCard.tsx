"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Copy, Share2, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { DomainVerificationBanner } from "@/components/affiliate/DomainVerificationBanner";

interface QuickLinkCardProps {
  primaryLink?: string;
  affiliateId: string;
}

export function QuickLinkCard({ primaryLink }: QuickLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [showUtmBuilder, setShowUtmBuilder] = useState(false);
  const [utmSource, setUtmSource] = useState("");

  const handleCopyLink = async (url?: string) => {
    const linkToCopy = url || primaryLink;
    if (!linkToCopy) return;
    
    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = linkToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!primaryLink) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out my affiliate link",
          text: "Sign up using my referral link:",
          url: primaryLink,
        });
      } catch (error) {
        // User cancelled or share failed
        console.log("Share cancelled or failed");
      }
    } else {
      // Fallback to clipboard
      await handleCopyLink();
      toast.info("Share not supported, link copied instead");
    }
  };

  const buildUtmUrl = (baseUrl: string, source: string): string => {
    if (!source) return baseUrl;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}utm_source=${encodeURIComponent(source)}`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Your Referral Link
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Domain Verification Warning */}
        <DomainVerificationBanner />

        {/* Link Display */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600 truncate flex-1">
            {primaryLink || "Loading..."}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleCopyLink()}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy Link
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4 mr-1" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShowUtmBuilder(!showUtmBuilder)}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            UTM
          </Button>
        </div>

        {/* UTM Builder Section */}
        {showUtmBuilder && (
          <div className="pt-3 border-t">
            <p className="text-sm text-gray-600 mb-2">
              Add UTM parameters to track your marketing sources:
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g., newsletter, facebook, partner-site"
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => handleCopyLink(buildUtmUrl(primaryLink || "", utmSource))}
                disabled={!utmSource.trim() || !primaryLink}
              >
                Copy
              </Button>
            </div>
            {utmSource && primaryLink && (
              <p className="text-xs text-gray-500 mt-2 truncate">
                Preview: {buildUtmUrl(primaryLink, utmSource)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
