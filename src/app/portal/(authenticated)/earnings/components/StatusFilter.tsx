'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StatusFilterProps {
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'paid', label: 'Paid' },
];

export function StatusFilter({ selectedStatus, onStatusChange }: StatusFilterProps) {
  return (
    <Select value={selectedStatus} onValueChange={onStatusChange}>
      <SelectTrigger className="w-[160px] bg-white border-gray-200">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}