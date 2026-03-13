"use client";

import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getLimitStatusText } from "@/lib/tierConfig";

/**
 * Props for TierLimitBanner component.
 */
export interface TierLimitBannerProps {
  status: "ok" | "warning" | "critical" | "blocked";
  resourceType: string;
  current: number;
  limit: number;
  percentage: number;
  upgradePrompt: boolean;
  className?: string;
  onUpgradeClick?: () => void;
}

/**
 * Banner component to display tier limit warnings and errors.
 * AC4, AC5, AC6: Shows warnings/critical/blocking messages based on limit status.
 */
export function TierLimitBanner({
  status,
  resourceType,
  current,
  limit,
  percentage,
  upgradePrompt,
  className,
  onUpgradeClick,
}: TierLimitBannerProps) {
  if (status === "ok") {
    return null;
  }

  const getIcon = () => {
    switch (status) {
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "critical":
      case "blocked":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getVariantStyles = () => {
    switch (status) {
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "critical":
        return "bg-orange-50 border-orange-200 text-orange-800";
      case "blocked":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "";
    }
  };

  const formatLimit = (val: number) => {
    return val === -1 ? "Unlimited" : val.toString();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border",
        getVariantStyles(),
        className
      )}
      role="alert"
    >
      {getIcon()}
      <div className="flex-1">
        <p className="text-sm font-medium">{getLimitStatusText(status)}</p>
        <p className="text-sm opacity-90">
          {resourceType}: {current} / {formatLimit(limit)} ({percentage}%)
        </p>
      </div>
      {upgradePrompt && onUpgradeClick && (
        <button
          onClick={onUpgradeClick}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium",
            "bg-white hover:bg-gray-50 border"
          )}
        >
          <ArrowUpRight className="h-4 w-4" />
          Upgrade Plan
        </button>
      )}
    </div>
  );
}

/**
 * Props for TierLimitIndicator component.
 */
export interface TierLimitIndicatorProps {
  status: "ok" | "warning" | "critical" | "blocked";
  current: number;
  limit: number;
  showLabel?: boolean;
  className?: string;
}

/**
 * Compact indicator for tier limit status.
 */
export function TierLimitIndicator({
  status,
  current,
  limit,
  showLabel = true,
  className,
}: TierLimitIndicatorProps) {
  const formatLimit = (val: number) => {
    return val === -1 ? "∞" : val.toString();
  };

  const getBadgeStyles = () => {
    switch (status) {
      case "ok":
        return "bg-green-100 text-green-700";
      case "warning":
        return "bg-yellow-100 text-yellow-700";
      case "critical":
        return "bg-orange-100 text-orange-700";
      case "blocked":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getIcon = () => {
    switch (status) {
      case "ok":
        return <CheckCircle className="h-3.5 w-3.5" />;
      case "warning":
      case "critical":
        return <AlertTriangle className="h-3.5 w-3.5" />;
      case "blocked":
        return <AlertCircle className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        getBadgeStyles(),
        className
      )}
    >
      {getIcon()}
      {showLabel && <span>{current}/{formatLimit(limit)}</span>}
    </span>
  );
}
