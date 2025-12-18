'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value ? format(value, 'yyyy-MM-dd') : '');

  // Update input value when external value changes
  React.useEffect(() => {
    if (value) {
      setInputValue(format(value, 'yyyy-MM-dd'));
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Try to parse the date
    if (newValue) {
      const parsed = new Date(newValue);
      if (!isNaN(parsed.getTime())) {
        onChange?.(parsed);
      }
    } else {
      onChange?.(undefined);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange?.(date);
    if (date) {
      setInputValue(format(date, 'yyyy-MM-dd'));
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
        />
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            disabled={disabled}
            type="button"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleCalendarSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}


