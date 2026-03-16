"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface PromoLibraryProps {
  primaryColor: string;
  affiliateLink?: {
    shortUrl: string;
    fullUrl: string;
    vanityUrl?: string;
  };
}

const copyTemplates = [
  {
    id: 1,
    type: "Newsletter/Blog",
    title: "Email Newsletter",
    body: "Hey! I wanted to share this amazing product with you. Use my link to get started and support me as an affiliate: {link}",
  },
  {
    id: 2,
    type: "Telegram/Discord",
    title: "Social Media Post",
    body: "Check out this awesome service I've been using! Sign up through my link and you'll get a great deal: {link}",
  },
  {
    id: 3,
    type: "Short Social",
    title: "Quick Tweet",
    body: "Get started with this great service! Use my link: {link} #affiliatelink #referral",
  },
];

const banners = [
  { id: 1, title: "Banner 728x90", size: "728x90px" },
  { id: 2, title: "Banner 300x250", size: "300x250px" },
  { id: 3, title: "Banner 160x600", size: "160x600px" },
  { id: 4, title: "Square 250x250", size: "250x250px" },
];

export function PromoLibrary({ primaryColor, affiliateLink }: PromoLibraryProps) {
  const [activeTab, setActiveTab] = useState<"templates" | "banners">("templates");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const getLink = () => {
    return affiliateLink?.vanityUrl || affiliateLink?.shortUrl || affiliateLink?.fullUrl || "";
  };

  const copyTemplate = async (templateBody: string, id: number) => {
    const link = getLink();
    if (!link) {
      toast.error("No referral link available");
      return;
    }

    const text = templateBody.replace("{link}", link);
    
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Template copied to clipboard!");
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy template");
    }
  };

  const downloadBanner = (banner: typeof banners[0]) => {
    // Generate a placeholder SVG banner with tenant branding
    const [width, height] = banner.size.split('x').map(Number);
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${primaryColor}" />
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 10}" fill="white" text-anchor="middle" dominant-baseline="middle">
          ${banner.title}
        </text>
        <text x="50%" y="65%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 15}" fill="white" fill-opacity="0.8" text-anchor="middle" dominant-baseline="middle">
          Placeholder Banner
        </text>
      </svg>
    `.trim();

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${banner.title.replace(/\s+/g, '-').toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`${banner.title} downloaded`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Promo Library</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tab Switcher */}
        <div className="flex border-b mb-4">
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "templates"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Copy Templates
          </button>
          <button
            onClick={() => setActiveTab("banners")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "banners"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Banners
          </button>
        </div>

        {/* Templates Tab */}
        {activeTab === "templates" && (
          <div className="space-y-3">
            {copyTemplates.map((template) => (
              <div
                key={template.id}
                className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-sm">{template.title}</h4>
                    <span className="text-xs text-muted-foreground">{template.type}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyTemplate(template.body, template.id)}
                    className="flex-shrink-0"
                  >
                    {copiedId === template.id ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Text
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {template.body.replace("{link}", getLink() || "[Your Link]")}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Banners Tab */}
        {activeTab === "banners" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className="border rounded-lg p-3 text-center hover:bg-gray-50 transition-colors"
              >
                <div
                  className="bg-gray-200 rounded mb-2 mx-auto"
                  style={{
                    width: banner.size.split('x')[0] + 'px',
                    height: '60px',
                    maxWidth: '100%',
                  }}
                />
                <h4 className="font-medium text-sm mb-1">{banner.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">{banner.size}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadBanner(banner)}
                  className="w-full"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}