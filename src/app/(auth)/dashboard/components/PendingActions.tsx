"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Clock, ChevronRight, UserCircle, DollarSign, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface PendingActionCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconColor: string;
  isLoading?: boolean;
}

function PendingActionCard({ label, value, icon, iconColor, isLoading }: PendingActionCardProps) {
  return (
    <Card className="shadow-sm border-[var(--border-light)] overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-1 group relative cursor-pointer bg-white">
      {/* Subtle indicator bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-[2.5px] transition-all", 
        value > 0 ? "bg-[var(--warning)]" : "bg-[var(--border-light)] group-hover:bg-[var(--warning)]/30")} />
      
      <CardContent className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110", iconColor)}>
            {icon}
          </div>
          <div>
            <p className="text-[13px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{label}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-[32px] font-black text-[var(--text-heading)] tabular-nums leading-none mt-1">{value}</p>
            )}
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-[var(--bg-page)]/50 flex items-center justify-center transition-all duration-300 group-hover:bg-amber-50 group-hover:translate-x-1 border border-[var(--border-light)] group-hover:border-amber-200">
           <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-amber-600" />
        </div>
      </CardContent>
    </Card>
  );
}

interface PendingActionsProps {
  pendingPromoters?: number;
  pendingCommissions?: number;
  pendingReferrals?: number;
  isLoading?: boolean;
}

export function PendingActions({ 
  pendingPromoters = 0, 
  pendingCommissions = 0, 
  pendingReferrals = 0, 
  isLoading 
}: PendingActionsProps) {
  return (
    <div className="space-y-6 pt-6 mb-12">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[15px] font-bold text-[var(--text-heading)] uppercase tracking-[0.15em] flex items-center gap-2">
           Pending actions
           <span className="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse" />
        </h3>
        {/* Optional: Add a "Resolve All" link or similar button here later */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PendingActionCard
          label="Pending promoters"
          value={pendingPromoters}
          icon={<Users className="w-6 h-6 text-amber-600" />}
          iconColor="bg-amber-50"
          isLoading={isLoading}
        />
        <PendingActionCard
          label="Pending commissions"
          value={pendingCommissions}
          icon={<DollarSign className="w-6 h-6 text-amber-600" />}
          iconColor="bg-amber-50"
          isLoading={isLoading}
        />
        <PendingActionCard
          label="Pending referrals"
          value={pendingReferrals}
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          iconColor="bg-amber-50"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
