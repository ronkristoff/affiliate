'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { FilterTabs, type FilterTabItem } from '@/components/ui/FilterTabs';

interface PeriodFilterTabsProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
}

const PERIODS: FilterTabItem[] = [
  { key: 'all', label: 'All Time' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3_months', label: 'Last 3 Months' },
];

export function PeriodFilterTabs({ selectedPeriod, onPeriodChange }: PeriodFilterTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize from URL params or default to 'all'
  useEffect(() => {
    const periodFromUrl = searchParams.get('period');
    if (periodFromUrl && PERIODS.some(p => p.key === periodFromUrl)) {
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
    <FilterTabs
      tabs={PERIODS}
      activeTab={selectedPeriod}
      onTabChange={handlePeriodClick}
      size="md"
      className="overflow-x-auto pb-2"
    />
  );
}
