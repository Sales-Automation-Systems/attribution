'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  MessageSquare,
  UserPlus,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  CircleSlash,
  XCircle,
  ExternalLink,
  Eye,
  Flag,
  ArrowUpCircle,
} from 'lucide-react';
import { DefinitionTooltip, SimpleTooltip } from '@/components/ui/definition-tooltip';
import { cn } from '@/lib/utils';
import type { DomainStatus, MatchType } from '@/db/attribution/types';

// Timeline Dialog component
import { TimelineDialog } from './timeline-dialog';

export interface AccountDomain {
  id: string;
  domain: string;
  first_email_sent_at: Date | null;
  first_event_at: Date | null;
  last_event_at: Date | null;
  has_positive_reply: boolean;
  has_sign_up: boolean;
  has_meeting_booked: boolean;
  has_paying_customer: boolean;
  is_within_window: boolean;
  match_type: MatchType;
  status: DomainStatus;
}

interface AccountsTableProps {
  domains: AccountDomain[];
  totalCount: number;
  slug: string;
  uuid: string;
  attributionWindowDays: number;
  onAttribute?: (domainId: string) => void;
  onOpenDisputePanel?: (domain: AccountDomain) => void;
}

type EventTypeFilter = 'reply' | 'signup' | 'meeting' | 'paying';
type StatusFilterType = 'attributed' | 'outside_window' | 'unattributed' | 'disputed' | 'client_attributed';

// Map domain status to our filter types
function getStatusFilterType(domain: AccountDomain): StatusFilterType {
  if (domain.status === 'CLIENT_PROMOTED') return 'client_attributed';
  if (domain.status === 'DISPUTED') return 'disputed';
  if (domain.status === 'OUTSIDE_WINDOW' || (!domain.is_within_window && domain.match_type !== 'NO_MATCH' && domain.match_type !== null)) return 'outside_window';
  if (domain.status === 'UNATTRIBUTED' || domain.match_type === 'NO_MATCH' || domain.match_type === null) return 'unattributed';
  return 'attributed';
}

export function AccountsTable({
  domains,
  totalCount,
  slug,
  uuid,
  attributionWindowDays,
  onAttribute,
  onOpenDisputePanel,
}: AccountsTableProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize state from URL params
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [eventTypeFilters, setEventTypeFilters] = useState<Set<EventTypeFilter>>(() => {
    const events = searchParams.get('events');
    if (events) {
      return new Set(events.split(',').filter(e => ['reply', 'signup', 'meeting', 'paying'].includes(e)) as EventTypeFilter[]);
    }
    return new Set();
  });
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilterType>>(() => {
    const status = searchParams.get('status');
    if (status) {
      return new Set(status.split(',').filter(s => 
        ['attributed', 'outside_window', 'unattributed', 'disputed', 'client_attributed'].includes(s)
      ) as StatusFilterType[]);
    }
    return new Set();
  });
  const [focusView, setFocusView] = useState(() => searchParams.get('focus') === 'true');
  const [selectedDomain, setSelectedDomain] = useState<AccountDomain | null>(null);
  
  // Track if initial URL sync has been done
  const initialSyncDoneRef = useRef(false);
  
  // LOCK: Completely prevent dialog opens for 1 second after closing
  const dialogLockedUntilRef = useRef<number>(0);

  // Update URL when filters change
  const updateURL = useCallback((params: Record<string, string | null>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === '') {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, value);
      }
    });

    const queryString = newSearchParams.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // Sync URL with filter state changes
  useEffect(() => {
    const params: Record<string, string | null> = {
      search: searchQuery || null,
      events: eventTypeFilters.size > 0 ? Array.from(eventTypeFilters).join(',') : null,
      status: statusFilters.size > 0 ? Array.from(statusFilters).join(',') : null,
      focus: focusView ? 'true' : null,
    };
    updateURL(params);
  }, [searchQuery, eventTypeFilters, statusFilters, focusView, updateURL]);

  // Open account from URL on INITIAL MOUNT only (for deep linking / page refresh)
  // FIX: Only run once to prevent URL changes from reopening the dialog after close
  useEffect(() => {
    if (initialSyncDoneRef.current) return;
    
    const accountParam = searchParams.get('account');
    if (accountParam && domains.length > 0) {
      const domain = domains.find(d => d.domain === accountParam);
      if (domain) {
        setSelectedDomain(domain);
      }
      initialSyncDoneRef.current = true;
    } else if (!accountParam) {
      initialSyncDoneRef.current = true;
    }
  }, [searchParams, domains]);

  // Update URL when selecting/deselecting account
  // FIX: 1-second lock after closing prevents race conditions from reopening
  const handleSelectDomain = useCallback((domain: AccountDomain | null) => {
    const now = Date.now();
    
    // LOCK GUARD: If dialog is locked (within 1 second of closing), block opens
    if (domain && now < dialogLockedUntilRef.current) {
      return;
    }
    
    // When closing, lock the dialog for 1 second to prevent race condition reopens
    if (!domain) {
      dialogLockedUntilRef.current = now + 1000;
    }
    
    setSelectedDomain(domain);
    updateURL({ account: domain?.domain || null });
  }, [updateURL]);

  // Toggle event type filter
  const toggleEventFilter = (type: EventTypeFilter) => {
    setEventTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Toggle status filter
  const toggleStatusFilter = (status: StatusFilterType) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  // Apply filters
  const filteredDomains = useMemo(() => {
    return domains.filter((domain) => {
      // Search filter
      if (searchQuery && !domain.domain.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Focus View: Only show direct matches (exact email)
      if (focusView && domain.match_type !== 'HARD_MATCH') {
        return false;
      }

      // Event type filters (multi-select, OR logic)
      if (eventTypeFilters.size > 0) {
        const hasMatchingEvent =
          (eventTypeFilters.has('reply') && domain.has_positive_reply) ||
          (eventTypeFilters.has('signup') && domain.has_sign_up) ||
          (eventTypeFilters.has('meeting') && domain.has_meeting_booked) ||
          (eventTypeFilters.has('paying') && domain.has_paying_customer);
        if (!hasMatchingEvent) return false;
      }

      // Status filters (multi-select, OR logic)
      if (statusFilters.size > 0) {
        const domainStatus = getStatusFilterType(domain);
        if (!statusFilters.has(domainStatus)) return false;
      }

      return true;
    });
  }, [domains, searchQuery, eventTypeFilters, statusFilters, focusView]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredDomains.length;
    const attributed = filteredDomains.filter((d) => getStatusFilterType(d) === 'attributed').length;
    const outsideWindow = filteredDomains.filter((d) => getStatusFilterType(d) === 'outside_window').length;
    const unattributed = filteredDomains.filter((d) => getStatusFilterType(d) === 'unattributed').length;
    const disputed = filteredDomains.filter((d) => d.status === 'DISPUTED').length;
    const manuallyAttributed = filteredDomains.filter((d) => d.status === 'CLIENT_PROMOTED').length;
    const withReplies = filteredDomains.filter((d) => d.has_positive_reply).length;
    const withSignups = filteredDomains.filter((d) => d.has_sign_up).length;
    const withMeetings = filteredDomains.filter((d) => d.has_meeting_booked).length;
    const withPaying = filteredDomains.filter((d) => d.has_paying_customer).length;

    return {
      total,
      attributed,
      outsideWindow,
      unattributed,
      disputed,
      manuallyAttributed,
      withReplies,
      withSignups,
      withMeetings,
      withPaying,
    };
  }, [filteredDomains]);

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysSinceEmail = (emailDate: Date | null, eventDate: Date | null) => {
    if (!emailDate || !eventDate) return null;
    const email = new Date(emailDate);
    const event = new Date(eventDate);
    const days = Math.floor((event.getTime() - email.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setEventTypeFilters(new Set());
    setStatusFilters(new Set());
    setFocusView(false);
    // URL will be updated by the useEffect
  }, []);

  const hasActiveFilters = searchQuery || eventTypeFilters.size > 0 || statusFilters.size > 0 || focusView;

  // Render status badge
  const renderStatusBadge = (domain: AccountDomain) => {
    const statusType = getStatusFilterType(domain);
    
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
              Outside
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
          <Badge 
            variant="outline" 
            className="bg-orange-500/10 text-orange-700 dark:text-orange-400 cursor-pointer hover:bg-orange-500/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDisputePanel?.(domain);
            }}
            title="Click to view dispute details"
          >
            <Flag className="h-3 w-3 mr-1" />
            Disputed
          </Badge>
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

  // Render action button based on status
  const renderActionButton = (domain: AccountDomain) => {
    const statusType = getStatusFilterType(domain);

    if (statusType === 'attributed') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDisputePanel?.(domain);
          }}
          title="Challenge this attribution"
        >
          <Flag className="h-3 w-3 mr-1" />
          Dispute
        </Button>
      );
    }

    if (statusType === 'disputed') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDisputePanel?.(domain);
          }}
          title="View dispute details"
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
      );
    }

    if (statusType === 'outside_window' || statusType === 'unattributed') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={(e) => {
            e.stopPropagation();
            onAttribute?.(domain.id);
          }}
          title="Add to your billable attribution"
        >
          <ArrowUpCircle className="h-3 w-3 mr-1" />
          Attribute
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3">
      {/* Compact Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/30">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-7 h-8 w-40 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="h-6 w-px bg-border dark:bg-foreground/40" />

        {/* Event Type Chips */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleEventFilter('reply')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              eventTypeFilters.has('reply')
                ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <MessageSquare className="h-3 w-3" />
            Replies
          </button>
          <button
            onClick={() => toggleEventFilter('signup')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              eventTypeFilters.has('signup')
                ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <UserPlus className="h-3 w-3" />
            Sign-ups
          </button>
          <button
            onClick={() => toggleEventFilter('meeting')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              eventTypeFilters.has('meeting')
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Calendar className="h-3 w-3" />
            Meetings
          </button>
          <button
            onClick={() => toggleEventFilter('paying')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              eventTypeFilters.has('paying')
                ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <DollarSign className="h-3 w-3" />
            Paying
          </button>
        </div>

        <div className="h-6 w-px bg-border dark:bg-foreground/40" />

        {/* Status Chips */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleStatusFilter('attributed')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              statusFilters.has('attributed')
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            Attributed
          </button>
          <button
            onClick={() => toggleStatusFilter('outside_window')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              statusFilters.has('outside_window')
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Clock className="h-3 w-3" />
            Outside
          </button>
          <button
            onClick={() => toggleStatusFilter('unattributed')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              statusFilters.has('unattributed')
                ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <CircleSlash className="h-3 w-3" />
            Unattributed
          </button>
          <button
            onClick={() => toggleStatusFilter('disputed')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              statusFilters.has('disputed')
                ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Flag className="h-3 w-3" />
            Disputed
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Focus View Toggle */}
        <DefinitionTooltip term="focusView" showUnderline={false}>
          <button
            onClick={() => setFocusView(!focusView)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              focusView
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Eye className="h-3 w-3" />
            Focus
          </button>
        </DefinitionTooltip>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <>
            <div className="h-6 w-px bg-border dark:bg-foreground/40" />
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <XCircle className="h-3 w-3" />
              Clear
            </button>
          </>
        )}
      </div>

      {/* Results */}
      {filteredDomains.length === 0 ? (
        <Card className="p-8 text-center">
          <XCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Results</h3>
          <p className="text-muted-foreground">
            No accounts match your current filters. Try adjusting your criteria.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[200px]">
                    <DefinitionTooltip term="accounts">Account</DefinitionTooltip>
                  </TableHead>
                  <TableHead className="text-center">Events</TableHead>
                  <TableHead className="text-center">Email Sent</TableHead>
                  <TableHead className="text-center">Last Event</TableHead>
                  <TableHead className="text-center">
                    <DefinitionTooltip term="days">Days</DefinitionTooltip>
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDomains.map((domain) => {
                  const days = getDaysSinceEmail(domain.first_email_sent_at, domain.first_event_at);

                  return (
                    <TableRow
                      key={domain.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSelectDomain(domain)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {domain.domain}
                          <a
                            href={`https://${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {domain.has_positive_reply && (
                            <SimpleTooltip content="Positive Reply">
                              <Badge variant="outline" className="bg-purple-500/10 text-xs px-1.5">
                                <MessageSquare className="h-3 w-3" />
                              </Badge>
                            </SimpleTooltip>
                          )}
                          {domain.has_sign_up && (
                            <SimpleTooltip content="Website Sign-Up">
                              <Badge variant="outline" className="bg-blue-500/10 text-xs px-1.5">
                                <UserPlus className="h-3 w-3" />
                              </Badge>
                            </SimpleTooltip>
                          )}
                          {domain.has_meeting_booked && (
                            <SimpleTooltip content="Meeting Booked">
                              <Badge variant="outline" className="bg-yellow-500/10 text-xs px-1.5">
                                <Calendar className="h-3 w-3" />
                              </Badge>
                            </SimpleTooltip>
                          )}
                          {domain.has_paying_customer && (
                            <SimpleTooltip content="Paying Customer">
                              <Badge className="bg-green-500 text-xs px-1.5">
                                <DollarSign className="h-3 w-3" />
                              </Badge>
                            </SimpleTooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {formatDate(domain.first_email_sent_at)}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {formatDate(domain.last_event_at || domain.first_event_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        {days !== null ? (
                          <span
                            className={
                              days <= attributionWindowDays
                                ? 'text-green-600 font-medium'
                                : 'text-amber-600'
                            }
                          >
                            {days}d
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {renderStatusBadge(domain)}
                      </TableCell>
                      <TableCell className="text-center">
                        {renderActionButton(domain)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Results count */}
      <div className="text-sm text-muted-foreground text-center space-y-1">
        <p>
          Showing {filteredDomains.length} of {domains.length} matched accounts
          {totalCount > domains.length && (
            <span className="text-amber-600 dark:text-amber-400">
              {' '}(database has {totalCount} total)
            </span>
          )}
        </p>
        {stats.unattributed === 0 && statusFilters.has('unattributed') && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Note: Unattributed events (where we never sent an email) will appear after the next data sync.
          </p>
        )}
      </div>

      {/* Timeline Dialog */}
      <TimelineDialog
        domain={selectedDomain}
        isOpen={!!selectedDomain}
        onClose={() => handleSelectDomain(null)}
        slug={slug}
        uuid={uuid}
      />
    </div>
  );
}

