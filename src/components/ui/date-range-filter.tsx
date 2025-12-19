'use client';

import * as React from 'react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, subMonths, subQuarters } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

type PresetKey = 'all' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'ytd';

const presets: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'thisQuarter', label: 'This Quarter' },
  { key: 'lastQuarter', label: 'Last Quarter' },
  { key: 'ytd', label: 'YTD' },
];

function getPresetRange(key: PresetKey): DateRange {
  const now = new Date();
  
  switch (key) {
    case 'all':
      return { startDate: null, endDate: null };
    case 'thisMonth':
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    case 'lastMonth': {
      const lastMonth = subMonths(now, 1);
      return { startDate: startOfMonth(lastMonth), endDate: endOfMonth(lastMonth) };
    }
    case 'thisQuarter':
      return { startDate: startOfQuarter(now), endDate: endOfQuarter(now) };
    case 'lastQuarter': {
      const lastQuarter = subQuarters(now, 1);
      return { startDate: startOfQuarter(lastQuarter), endDate: endOfQuarter(lastQuarter) };
    }
    case 'ytd':
      return { startDate: startOfYear(now), endDate: now };
    default:
      return { startDate: null, endDate: null };
  }
}

function getActivePreset(range: DateRange): PresetKey | null {
  if (!range.startDate && !range.endDate) return 'all';
  
  for (const preset of presets) {
    if (preset.key === 'all') continue;
    const presetRange = getPresetRange(preset.key);
    if (
      presetRange.startDate && 
      presetRange.endDate && 
      range.startDate &&
      range.endDate &&
      format(presetRange.startDate, 'yyyy-MM-dd') === format(range.startDate, 'yyyy-MM-dd') &&
      format(presetRange.endDate, 'yyyy-MM-dd') === format(range.endDate, 'yyyy-MM-dd')
    ) {
      return preset.key;
    }
  }
  
  return null; // Custom range
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [startOpen, setStartOpen] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);
  
  const activePreset = getActivePreset(value);
  const isCustom = activePreset === null && (value.startDate || value.endDate);

  const handlePresetClick = (key: PresetKey) => {
    onChange(getPresetRange(key));
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    onChange({ ...value, startDate: date || null });
    setStartOpen(false);
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    onChange({ ...value, endDate: date || null });
    setEndOpen(false);
  };

  const clearDates = () => {
    onChange({ startDate: null, endDate: null });
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <Button
            key={preset.key}
            variant={activePreset === preset.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset.key)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border mx-1" />

      {/* Custom date pickers */}
      <div className="flex items-center gap-2">
        <Popover open={startOpen} onOpenChange={setStartOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={isCustom ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'justify-start text-left font-normal text-xs min-w-[120px]',
                !value.startDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-1 h-3 w-3" />
              {value.startDate ? format(value.startDate, 'MMM d, yyyy') : 'Start date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value.startDate || undefined}
              onSelect={handleStartDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground text-xs">to</span>

        <Popover open={endOpen} onOpenChange={setEndOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={isCustom ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'justify-start text-left font-normal text-xs min-w-[120px]',
                !value.endDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-1 h-3 w-3" />
              {value.endDate ? format(value.endDate, 'MMM d, yyyy') : 'End date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value.endDate || undefined}
              onSelect={handleEndDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Clear button - only show when custom dates are selected */}
        {isCustom && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearDates}
            className="h-8 w-8"
            title="Clear dates"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

