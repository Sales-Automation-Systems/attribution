'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  MessageSquare,
  UserPlus,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  CircleSlash,
  Flag,
  ArrowUpCircle,
  X,
} from 'lucide-react';
import { AccountTimeline } from './account-timeline';
import { DefinitionTooltip, SimpleTooltip } from '@/components/ui/definition-tooltip';
import { cn } from '@/lib/utils';
import type { DomainStatus, MatchType } from '@/db/attribution/types';

// Event types that can be filtered
type EventType = 'POSITIVE_REPLY' | 'SIGN_UP' | 'MEETING_BOOKED' | 'PAYING_CUSTOMER';

export interface TimelineDomain {
  id: string;
  domain: string;
  first_email_sent_at: Date | null;
  first_event_at: Date | null;
  has_positive_reply: boolean;
  has_sign_up: boolean;
  has_meeting_booked: boolean;
  has_paying_customer: boolean;
  is_within_window: boolean;
  match_type: MatchType;
  status: DomainStatus;
}

interface TimelineDialogProps {
  domain: TimelineDomain | null;
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  uuid: string;
}

// Map domain status to filter types for consistent display
function getStatusType(domain: TimelineDomain): 'attributed' | 'outside_window' | 'unattributed' | 'disputed' | 'client_attributed' {
  if (domain.status === 'CLIENT_PROMOTED') return 'client_attributed';
  if (domain.status === 'DISPUTED') return 'disputed';
  if (domain.status === 'OUTSIDE_WINDOW' || (!domain.is_within_window && domain.match_type !== 'NO_MATCH' && domain.match_type !== null)) return 'outside_window';
  if (domain.status === 'UNATTRIBUTED' || domain.match_type === 'NO_MATCH' || domain.match_type === null) return 'unattributed';
  return 'attributed';
}

export function TimelineDialog({ domain, isOpen, onClose, slug, uuid }: TimelineDialogProps) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline-dialog.tsx:64',message:'TimelineDialog render start',data:{isOpen,hasDomain:!!domain,domainId:domain?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
  // #endregion

  // Event type filter state - empty set means show all
  const [eventTypeFilters, setEventTypeFilters] = useState<Set<EventType>>(new Set());

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline-dialog.tsx:70',message:'useState initialized',data:{filterSize:eventTypeFilters?.size,filterType:typeof eventTypeFilters,isSet:eventTypeFilters instanceof Set},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'})}).catch(()=>{});
  // #endregion

  // Toggle an event type filter
  const toggleEventFilter = useCallback((eventType: EventType) => {
    setEventTypeFilters(prev => {
      const next = new Set(prev);
      if (next.has(eventType)) {
        next.delete(eventType);
      } else {
        next.add(eventType);
      }
      return next;
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setEventTypeFilters(new Set());
  }, []);

  if (!domain) return null;

  // #region agent log
  try {
    const statusType = getStatusType(domain);
    const hasActiveFilters = eventTypeFilters.size > 0;
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline-dialog.tsx:95',message:'statusType and hasActiveFilters computed',data:{statusType,hasActiveFilters,domainStatus:domain.status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  } catch (e) {
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline-dialog.tsx:97',message:'ERROR in statusType/hasActiveFilters',data:{error:String(e)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion

  const statusType = getStatusType(domain);
  const hasActiveFilters = eventTypeFilters.size > 0;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline-dialog.tsx:beforeRender',message:'About to render Dialog JSX',data:{domainId:domain.id,domainName:domain.domain,statusType,hasActiveFilters,filterCount:eventTypeFilters.size},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'I'})}).catch(()=>{});
  // #endregion

  const renderStatusBadge = () => {
    switch (statusType) {
      case 'attributed':
        return (
          <DefinitionTooltip term="attributed" showUnderline={false}>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Attributed
            </Badge>
          </DefinitionTooltip>
        );
      case 'outside_window':
        return (
          <DefinitionTooltip term="outsideWindow" showUnderline={false}>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
              <Clock className="h-3 w-3 mr-1" />
              Outside Window
            </Badge>
          </DefinitionTooltip>
        );
      case 'unattributed':
        return (
          <DefinitionTooltip term="unattributed" showUnderline={false}>
            <Badge variant="outline" className="bg-gray-500/10 text-gray-600 dark:text-gray-400">
              <CircleSlash className="h-3 w-3 mr-1" />
              Unattributed
            </Badge>
          </DefinitionTooltip>
        );
      case 'disputed':
        return (
          <DefinitionTooltip term="disputed" showUnderline={false}>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
              <Flag className="h-3 w-3 mr-1" />
              Disputed
            </Badge>
          </DefinitionTooltip>
        );
      case 'client_attributed':
        return (
          <DefinitionTooltip term="manuallyAttributed" showUnderline={false}>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
              <ArrowUpCircle className="h-3 w-3 mr-1" />
              Manually Attributed
            </Badge>
          </DefinitionTooltip>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-3rem)] sm:w-[calc(100vw-6rem)] md:w-[calc(100vw-12rem)] lg:w-[calc(100vw-20rem)] max-w-none sm:max-w-none md:max-w-none lg:max-w-none max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="pl-6 pr-12 pt-6 pb-4 border-b shrink-0 bg-background">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                {domain.domain}
                <a
                  href={`https://${domain.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                Full event history and attribution details
              </DialogDescription>
            </div>
            
            {/* Status and Match Type Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {renderStatusBadge()}
              {domain.match_type && domain.match_type !== 'NO_MATCH' && (
                <DefinitionTooltip
                  term={domain.match_type === 'HARD_MATCH' ? 'hardMatch' : 'softMatch'}
                  showUnderline={false}
                >
                  <Badge variant="secondary">
                    {domain.match_type === 'HARD_MATCH' ? 'Focused Match' : 'Company Match'}
                  </Badge>
                </DefinitionTooltip>
              )}
            </div>
          </div>

          {/* Event Type Filter Badges - Click to filter timeline */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground mr-1">
              {hasActiveFilters ? 'Filtering:' : 'Events:'}
            </span>
            {domain.has_positive_reply && (
              <SimpleTooltip content={eventTypeFilters.has('POSITIVE_REPLY') ? 'Click to show all' : 'Click to filter to replies only'}>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs px-2 py-0.5 cursor-pointer transition-all",
                    eventTypeFilters.has('POSITIVE_REPLY')
                      ? "bg-purple-500/30 ring-2 ring-purple-500 ring-offset-1"
                      : "bg-purple-500/10 hover:bg-purple-500/20"
                  )}
                  onClick={() => toggleEventFilter('POSITIVE_REPLY')}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Reply
                </Badge>
              </SimpleTooltip>
            )}
            {domain.has_sign_up && (
              <SimpleTooltip content={eventTypeFilters.has('SIGN_UP') ? 'Click to show all' : 'Click to filter to sign-ups only'}>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs px-2 py-0.5 cursor-pointer transition-all",
                    eventTypeFilters.has('SIGN_UP')
                      ? "bg-blue-500/30 ring-2 ring-blue-500 ring-offset-1"
                      : "bg-blue-500/10 hover:bg-blue-500/20"
                  )}
                  onClick={() => toggleEventFilter('SIGN_UP')}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Sign-Up
                </Badge>
              </SimpleTooltip>
            )}
            {domain.has_meeting_booked && (
              <SimpleTooltip content={eventTypeFilters.has('MEETING_BOOKED') ? 'Click to show all' : 'Click to filter to meetings only'}>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs px-2 py-0.5 cursor-pointer transition-all",
                    eventTypeFilters.has('MEETING_BOOKED')
                      ? "bg-yellow-500/30 ring-2 ring-yellow-500 ring-offset-1"
                      : "bg-yellow-500/10 hover:bg-yellow-500/20"
                  )}
                  onClick={() => toggleEventFilter('MEETING_BOOKED')}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Meeting
                </Badge>
              </SimpleTooltip>
            )}
            {domain.has_paying_customer && (
              <SimpleTooltip content={eventTypeFilters.has('PAYING_CUSTOMER') ? 'Click to show all' : 'Click to filter to paying customers only'}>
                <Badge 
                  className={cn(
                    "text-xs px-2 py-0.5 cursor-pointer transition-all",
                    eventTypeFilters.has('PAYING_CUSTOMER')
                      ? "bg-green-600 ring-2 ring-green-500 ring-offset-1"
                      : "bg-green-500 hover:bg-green-600"
                  )}
                  onClick={() => toggleEventFilter('PAYING_CUSTOMER')}
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Paying
                </Badge>
              </SimpleTooltip>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-1"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
            {!domain.has_positive_reply && !domain.has_sign_up && !domain.has_meeting_booked && !domain.has_paying_customer && (
              <span className="text-xs text-muted-foreground italic">No events recorded</span>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Timeline Body */}
        <div className="flex-1 overflow-y-auto bg-background isolate">
          <div className="px-6 py-4">
            <AccountTimeline
              domainId={domain.id}
              slug={slug}
              uuid={uuid}
              isOpen={isOpen}
              eventTypeFilters={eventTypeFilters}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
