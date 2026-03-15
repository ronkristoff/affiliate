"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Users, Megaphone, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UsageStatsCardProps {
  usage: {
    affiliates: number;
    campaigns: number;
    teamMembers: number;
  };
  limits: {
    maxAffiliates: number;
    maxCampaigns: number;
    maxTeamMembers: number;
  };
  onUpgrade?: () => void;
}

const UNLIMITED = -1;

export function UsageStatsCard({ usage, limits, onUpgrade }: UsageStatsCardProps) {
  const resources = [
    { 
      name: "Affiliates", 
      used: usage.affiliates, 
      limit: limits.maxAffiliates,
      icon: Users,
    },
    { 
      name: "Campaigns", 
      used: usage.campaigns, 
      limit: limits.maxCampaigns,
      icon: Megaphone,
    },
    { 
      name: "Team Members", 
      used: usage.teamMembers, 
      limit: limits.maxTeamMembers,
      icon: UserCog,
    },
  ];

  const hasWarning = resources.some(r => {
    if (r.limit === UNLIMITED) return false;
    const percentage = (r.used / r.limit) * 100;
    return percentage >= 80;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Usage
            </CardTitle>
            <CardDescription>
              Current usage vs. plan limits
            </CardDescription>
          </div>
          {hasWarning && (
            <div className="flex items-center gap-1 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Approaching limits</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {resources.map((resource) => {
          const isUnlimited = resource.limit === UNLIMITED;
          const percentage = isUnlimited ? 0 : Math.min((resource.used / resource.limit) * 100, 100);
          const isWarning = !isUnlimited && percentage >= 80;
          const isCritical = !isUnlimited && percentage >= 95;
          const Icon = resource.icon;

          return (
            <div key={resource.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{resource.name}</span>
                </div>
                <span className={`text-sm ${isCritical ? "text-red-600 font-semibold" : isWarning ? "text-amber-600 font-medium" : ""}`}>
                  {isUnlimited ? (
                    `${resource.used} / Unlimited`
                  ) : (
                    <>
                      {resource.used} / {resource.limit}
                      {isWarning && ` (${percentage.toFixed(0)}%)`}
                    </>
                  )}
                </span>
              </div>
              {!isUnlimited && (
                <Progress 
                  value={percentage} 
                  className={`h-2 ${isCritical ? "bg-red-100" : isWarning ? "bg-amber-100" : ""}`}
                />
              )}
              {isWarning && !isUnlimited && (
                <p className={`text-xs ${isCritical ? "text-red-600" : "text-amber-600"}`}>
                  {isCritical 
                    ? "Critical: You've reached your limit. Upgrade now to add more."
                    : "Warning: You're approaching your plan limit."
                  }
                </p>
              )}
            </div>
          );
        })}

        {hasWarning && onUpgrade && (
          <div className="pt-2 border-t">
            <Button onClick={onUpgrade} variant="outline" className="w-full">
              Upgrade Plan for More Resources
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
