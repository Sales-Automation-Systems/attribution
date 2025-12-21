'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  Loader2,
  Lock,
  Unlock,
} from 'lucide-react';
import { DefinitionTooltip, SimpleTooltip } from '@/components/ui/definition-tooltip';
import { cn } from '@/lib/utils';
import type { DomainStatus, MatchType } from '@/db/attribution/types';

// Timeline Dialog component
import { TimelineDialog } from './timeline-dialog';

// #region agent log
fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'accounts-table.tsx:import',message:'accounts-table module loaded, TimelineDialog imported',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
// #endregion

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
  onOpenDisputePanel?: (domain: AccountDomain) => void;
}

type EventTypeFilter = 'reply' | 'signup' | 'meeting' | 'paying';
type StatusFilterType = 'attributed' | 'outside_window' | 'unattributed' | 'disputed' | 'dispute_pending' | 'client_attributed';

// Map domain status to our filter types
function getStatusFilterType(domain: AccountDomain): StatusFilterType {
  if (domain.status === 'CLIENT_PROMOTED') return 'client_attributed';
  if (domain.status === 'DISPUTE_PENDING') return 'dispute_pending';
  if (domain.status === 'DISPUTED') return 'disputed';
  if (domain.status === 'OUTSIDE_WINDOW' || (!domain.is_within_window && domain.match_type !== 'NO_MATCH' && domain.match_type !== null)) return 'outside_window';
  if (domain.status === 'UNATTRIBUTED' || domain.match_type === 'NO_MATCH' || domain.match_type === null) return 'unattributed';
  return 'attributed';
}

// Parse date strings from API response
function parseDomainDates(domain: Record<string, unknown>): AccountDomain {
  return {
    ...domain,
    first_email_sent_at: domain.first_email_sent_at ? new Date(domain.first_email_sent_at as string) : null,
    first_event_at: domain.first_event_at ? new Date(domain.first_event_at as string) : null,
    last_event_at: domain.last_event_at ? new Date(domain.last_event_at as string) : null,
  } as AccountDomain;
}

export function AccountsTable({
  domains: initialDomains,
  totalCount: initialTotalCount,
  slug,
  uuid,
  attributionWindowDays,
  onOpenDisputePanel,
}: AccountsTableProps) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'accounts-table.tsx:AccountsTable:entry',message:'AccountsTable RENDER START',data:{initialDomainsCount:initialDomains?.length,initialTotalCount,slug,uuid},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
  // #endregion
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // State for fetched domains (server-side filtered)
  const [fetchedDomains, setFetchedDomains] = useState<AccountDomain[] | null>(null);
  const [fetchedTotalCount, setFetchedTotalCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        ['attributed', 'outside_window', 'unattributed', 'disputed', 'dispute_pending', 'client_attributed'].includes(s)
      ) as StatusFilterType[]);
    }
    return new Set();
  });
  const [focusView, setFocusView] = useState(() => searchParams.get('focus') === 'true');
  const [selectedDomain, setSelectedDomain] = useState<AccountDomain | null>(null);
  
  // Dispute mode - hidden by default, unlocked with password for developer demos
  const [disputeModeUnlocked, setDisputeModeUnlocked] = useState(false);
  const [disputePasswordDialog, setDisputePasswordDialog] = useState(false);
  const [disputePassword, setDisputePassword] = useState('');
  const [disputePasswordError, setDisputePasswordError] = useState(false);
  
  // Track if initial URL sync has been done
  const initialSyncDoneRef = useRef(false);
  
  // LOCK: Completely prevent dialog opens for 1 second after closing
  const dialogLockedUntilRef = useRef<number>(0);
  
  // Debounce timer for search
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || eventTypeFilters.size > 0 || statusFilters.size > 0 || focusView;

  // Use fetched domains when filters are active, otherwise use initial domains
  const domains = hasActiveFilters && fetchedDomains !== null ? fetchedDomains : initialDomains;
  const totalCount = hasActiveFilters && fetchedTotalCount !== null ? fetchedTotalCount : initialTotalCount;

  // Fetch filtered domains from API
  const fetchFilteredDomains = useCallback(async () => {
    // Build query params
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (eventTypeFilters.size > 0) params.set('events', Array.from(eventTypeFilters).join(','));
    if (statusFilters.size > 0) params.set('status', Array.from(statusFilters).join(','));
    if (focusView) params.set('focus', 'true');
    params.set('limit', '100');

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/clients/${slug}/${uuid}/domains?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch domains');
      }
      const data = await response.json();
      setFetchedDomains(data.domains.map(parseDomainDates));
      setFetchedTotalCount(data.totalCount);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching filtered domains:', err);
    } finally {
      setIsLoading(false);
    }
  }, [slug, uuid, searchQuery, eventTypeFilters, statusFilters, focusView]);

  // Fetch when filters change (with debounce for search)
  useEffect(() => {
    // If no filters, use initial data
    if (!hasActiveFilters) {
      setFetchedDomains(null);
      setFetchedTotalCount(null);
      return;
    }

    // Clear previous debounce
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Debounce search queries, immediate for other filters
    if (searchQuery) {
      searchDebounceRef.current = setTimeout(() => {
        fetchFilteredDomains();
      }, 300);
    } else {
      fetchFilteredDomains();
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [hasActiveFilters, searchQuery, eventTypeFilters, statusFilters, focusView, fetchFilteredDomains]);

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'accounts-table.tsx:useEffect:urlSync',message:'URL sync effect running',data:{initialSyncDone:initialSyncDoneRef.current,accountParam:searchParams.get('account'),domainsCount:domains.length,loadedDomainsCount:loadedDomains.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    if (initialSyncDoneRef.current) return;
    
    const accountParam = searchParams.get('account');
    if (accountParam && domains.length > 0) {
      const domain = domains.find(d => d.domain === accountParam);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'accounts-table.tsx:useEffect:urlSync:found',message:'Looking for domain from URL',data:{accountParam,foundDomain:!!domain,domainId:domain?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'accounts-table.tsx:handleSelectDomain',message:'handleSelectDomain called',data:{hasDomain:!!domain,domainId:domain?.id,domainName:domain?.domain},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
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

  // Handle dispute mode toggle - requires password to unlock
  const handleDisputeModeToggle = () => {
    if (disputeModeUnlocked) {
      // Already unlocked, just toggle off
      setDisputeModeUnlocked(false);
    } else {
      // Open password dialog
      setDisputePassword('');
      setDisputePasswordError(false);
      setDisputePasswordDialog(true);
    }
  };

  // Handle dispute password submission
  const handleDisputePasswordSubmit = () => {
    if (disputePassword === 'Dispute') {
      setDisputeModeUnlocked(true);
      setDisputePasswordDialog(false);
      setDisputePassword('');
      setDisputePasswordError(false);
    } else {
      setDisputePasswordError(true);
    }
  };

  // No longer need client-side filtering - server does it now
  const filteredDomains = domains;

  // Calculate stats from current domains
  const stats = useMemo(() => {
    const total = filteredDomains.length;
    const attributed = filteredDomains.filter((d) => getStatusFilterType(d) === 'attributed').length;
    const outsideWindow = filteredDomains.filter((d) => getStatusFilterType(d) === 'outside_window').length;
    const unattributed = filteredDomains.filter((d) => getStatusFilterType(d) === 'unattributed').length;
    const disputePending = filteredDomains.filter((d) => d.status === 'DISPUTE_PENDING').length;
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
      disputePending,
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
    setFetchedDomains(null);
    setFetchedTotalCount(null);
    // URL will be updated by the useEffect
  }, []);

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
      case 'dispute_pending':
        // Show "In Review" badge - dispute submitted, awaiting agency review
        return disputeModeUnlocked ? (
          <Badge 
            variant="outline" 
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 cursor-pointer hover:bg-amber-500/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDisputePanel?.(domain);
            }}
            title="Dispute submitted - click to view details"
          >
            <Clock className="h-3 w-3 mr-1" />
            In Review
          </Badge>
        ) : (
          <Badge 
            variant="outline" 
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400"
          >
            <Clock className="h-3 w-3 mr-1" />
            In Review
          </Badge>
        );
      case 'disputed':
        // Dispute has been approved by agency
        return disputeModeUnlocked ? (
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
        ) : (
          <Badge 
            variant="outline" 
            className="bg-orange-500/10 text-orange-700 dark:text-orange-400"
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

    // Only show dispute-related buttons when dispute mode is unlocked
    if (statusType === 'attributed' && disputeModeUnlocked) {
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

    if (statusType === 'dispute_pending' && disputeModeUnlocked) {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDisputePanel?.(domain);
          }}
          title="View dispute in review"
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
      );
    }

    if (statusType === 'disputed' && disputeModeUnlocked) {
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

    // For outside_window and unattributed, no action button
    // Users should use "Add Event" modal to add missing events
    // which will trigger attribution recalculation automatically
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
            onClick={() => toggleStatusFilter('dispute_pending')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              statusFilters.has('dispute_pending')
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Clock className="h-3 w-3" />
            In Review
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

        {/* Dispute Mode Toggle (password protected) */}
        <button
          onClick={handleDisputeModeToggle}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
            disputeModeUnlocked
              ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          title={disputeModeUnlocked ? 'Click to lock dispute features' : 'Click to unlock dispute features (requires password)'}
        >
          {disputeModeUnlocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          Dispute
        </button>

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
      {isLoading ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-spin" />
          <h3 className="text-lg font-medium mb-2">Loading...</h3>
          <p className="text-muted-foreground">
            Fetching filtered accounts from database...
          </p>
        </Card>
      ) : error ? (
        <Card className="p-8 text-center">
          <XCircle className="h-12 w-12 mx-auto text-red-500/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">Error Loading Data</h3>
          <p className="text-muted-foreground">{error}</p>
        </Card>
      ) : filteredDomains.length === 0 ? (
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
      {!isLoading && !error && (
        <div className="text-sm text-muted-foreground text-center space-y-1">
          <p>
            Showing {filteredDomains.length} {hasActiveFilters ? 'filtered' : ''} accounts
            {totalCount > filteredDomains.length && (
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
      )}

      {/* Timeline Dialog */}
      {/* #region agent log */}
      {(() => { fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'accounts-table.tsx:TimelineDialog-render',message:'About to render TimelineDialog',data:{hasSelectedDomain:!!selectedDomain,selectedDomainId:selectedDomain?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{}); return null; })()}
      {/* #endregion */}
      <TimelineDialog
        domain={selectedDomain}
        isOpen={!!selectedDomain}
        onClose={() => handleSelectDomain(null)}
        slug={slug}
        uuid={uuid}
      />

      {/* Dispute Mode Password Dialog */}
      <Dialog open={disputePasswordDialog} onOpenChange={setDisputePasswordDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Unlock Dispute Features
            </DialogTitle>
            <DialogDescription>
              Enter the password to enable dispute functionality.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="dispute-password">Password</Label>
            <Input
              id="dispute-password"
              type="password"
              placeholder="Enter password..."
              value={disputePassword}
              onChange={(e) => {
                setDisputePassword(e.target.value);
                setDisputePasswordError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleDisputePasswordSubmit();
                }
              }}
              className={cn(disputePasswordError && 'border-red-500')}
              autoFocus
            />
            {disputePasswordError && (
              <p className="text-sm text-red-500 mt-1">Incorrect password</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputePasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDisputePasswordSubmit}>
              <Unlock className="h-4 w-4 mr-2" />
              Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

