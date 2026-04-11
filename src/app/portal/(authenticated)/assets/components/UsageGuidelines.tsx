"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface UsageGuidelinesProps {
  guidelines: string;
}

export function UsageGuidelines({ guidelines }: UsageGuidelinesProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!guidelines) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-[var(--portal-primary)]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-[var(--portal-primary)]" />
          <span className="font-semibold text-gray-900">Usage Guidelines</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <CardContent className="pt-0 pb-4 px-4">
          <div className="prose prose-sm max-w-none text-gray-600">
            {guidelines.split('\n').map((line, index) => (
              <p key={index} className="mb-2 last:mb-0">
                {line}
              </p>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
