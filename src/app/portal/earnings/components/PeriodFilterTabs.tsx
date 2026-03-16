'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface PeriodFilterTabsProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
}

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
];

export function PeriodFilterTabs({ selectedPeriod, onPeriodChange }: PeriodFilterTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize from URL params or default to 'all'
  useEffect(() => {
    const periodFromUrl = searchParams.get('period');
    if (periodFromUrl && PERIODS.some(p => p.value === periodFromUrl)) {
      onPeriodChange(periodFromUrl);
    }
  }, [searchParams, onPeriodChange]);

  const handlePeriodClick = (period: string) => {
    onPeriodChange(period);
    
    // Update URL without triggering navigation
    const params = new URLSearchParams(searchParams);
    if (period === 'all') {
      params.delete('period');
    } else {
      params.set('period', period);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          onClick={() => handlePeriodClick(period.value)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors',
            'border border-transparent',
            selectedPeriod === period.value
              ? 'bg-[var(--brand)] text-white shadow-sm'
              : 'bg-white text-[var(--text-body)] hover:bg-gray-100 border-gray-200'
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}