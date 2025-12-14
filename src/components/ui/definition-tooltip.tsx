'use client';

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DEFINITIONS,
  type DefinitionKey,
  isContractDefinition,
  formatDefinitionWithSource,
} from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface DefinitionTooltipProps {
  /** The definition key from the DEFINITIONS dictionary */
  term: DefinitionKey;
  /** The content to wrap with the tooltip */
  children: React.ReactNode;
  /** Whether to show the dotted underline style */
  showUnderline?: boolean;
  /** Whether to show a small info icon */
  showIcon?: boolean;
  /** Additional className for the wrapper */
  className?: string;
  /** Side of the tooltip */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * DefinitionTooltip - A tooltip component that shows contract definitions
 * 
 * Wraps content with a tooltip that shows the definition from the contract
 * or UI-specific terms. Contract terms show their source section.
 * 
 * @example
 * ```tsx
 * <DefinitionTooltip term="attributed">
 *   Attributed
 * </DefinitionTooltip>
 * ```
 */
export function DefinitionTooltip({
  term,
  children,
  showUnderline = true,
  showIcon = false,
  className,
  side = 'top',
}: DefinitionTooltipProps) {
  const definition = DEFINITIONS[term];
  const isContract = isContractDefinition(term);
  const fullDefinition = formatDefinitionWithSource(term);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'cursor-help inline-flex items-center gap-1',
            showUnderline && 'border-b border-dotted border-muted-foreground/50 hover:border-muted-foreground',
            className
          )}
        >
          {children}
          {showIcon && <Info className="h-3 w-3 text-muted-foreground" />}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        <div className="space-y-1">
          <p className="text-sm">{definition.definition}</p>
          {isContract && definition.source && (
            <p className="text-xs text-muted-foreground/80 italic">
              {definition.source}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * SimpleTooltip - For custom tooltip content not from the definitions dictionary
 */
interface SimpleTooltipProps {
  content: string;
  children: React.ReactNode;
  showUnderline?: boolean;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function SimpleTooltip({
  content,
  children,
  showUnderline = false,
  className,
  side = 'top',
}: SimpleTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'cursor-help',
            showUnderline && 'border-b border-dotted border-muted-foreground/50 hover:border-muted-foreground',
            className
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        <p className="text-sm">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * StatusTooltip - Pre-configured tooltips for status badges
 */
type StatusType = 'attributed' | 'outsideWindow' | 'unattributed' | 'clientPromoted' | 'disputed';

const STATUS_COLORS: Record<StatusType, string> = {
  attributed: 'text-green-600 dark:text-green-400',
  outsideWindow: 'text-yellow-600 dark:text-yellow-400',
  unattributed: 'text-gray-500 dark:text-gray-400',
  clientPromoted: 'text-blue-600 dark:text-blue-400',
  disputed: 'text-orange-600 dark:text-orange-400',
};

interface StatusTooltipProps {
  status: StatusType;
  children: React.ReactNode;
  className?: string;
}

export function StatusTooltip({ status, children, className }: StatusTooltipProps) {
  return (
    <DefinitionTooltip
      term={status}
      showUnderline={false}
      className={cn(STATUS_COLORS[status], className)}
    >
      {children}
    </DefinitionTooltip>
  );
}

/**
 * EventTooltip - Pre-configured tooltips for event type badges
 */
type EventType = 'positiveReply' | 'websiteSignUp' | 'meetingBooked' | 'payingCustomer';

interface EventTooltipProps {
  eventType: EventType;
  children: React.ReactNode;
  className?: string;
}

export function EventTooltip({ eventType, children, className }: EventTooltipProps) {
  return (
    <DefinitionTooltip term={eventType} showUnderline={false} className={className}>
      {children}
    </DefinitionTooltip>
  );
}

