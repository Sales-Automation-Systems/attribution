'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { AccountTimeline } from './account-timeline';

interface Domain {
  id: string;
  domain: string;
  first_email_sent_at: Date | null;
  first_event_at: Date | null;
  has_positive_reply: boolean;
  has_sign_up: boolean;
  has_meeting_booked: boolean;
  has_paying_customer: boolean;
  is_within_window: boolean;
  match_type: 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH' | null;
  status: string;
}

interface LeadsViewProps {
  domains: Domain[];
  clientName: string;
  slug: string;
  uuid: string;
  settings: {
    sign_ups_mode: string;
    meetings_mode: string;
    paying_mode: string;
    attribution_window_days: number;
  };
}

type EventTypeFilter = 'all' | 'reply' | 'signup' | 'meeting' | 'paying';
type MatchTypeFilter = 'all' | 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH';
type StatusFilter = 'all' | 'within_window' | 'outside_window';

export function LeadsView({ domains, clientName, slug, uuid, settings }: LeadsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>('all');
  const [matchTypeFilter, setMatchTypeFilter] = useState<MatchTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  // Apply filters
  const filteredDomains = useMemo(() => {
    return domains.filter((domain) => {
      // Search filter
      if (searchQuery && !domain.domain.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Event type filter
      if (eventTypeFilter !== 'all') {
        if (eventTypeFilter === 'reply' && !domain.has_positive_reply) return false;
        if (eventTypeFilter === 'signup' && !domain.has_sign_up) return false;
        if (eventTypeFilter === 'meeting' && !domain.has_meeting_booked) return false;
        if (eventTypeFilter === 'paying' && !domain.has_paying_customer) return false;
      }

      // Match type filter
      if (matchTypeFilter !== 'all' && domain.match_type !== matchTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'within_window' && !domain.is_within_window) return false;
      if (statusFilter === 'outside_window' && domain.is_within_window) return false;

      return true;
    });
  }, [domains, searchQuery, eventTypeFilter, matchTypeFilter, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredDomains.length;
    const withinWindow = filteredDomains.filter((d) => d.is_within_window).length;
    const outsideWindow = filteredDomains.filter((d) => !d.is_within_window).length;
    const hardMatches = filteredDomains.filter((d) => d.match_type === 'HARD_MATCH').length;
    const softMatches = filteredDomains.filter((d) => d.match_type === 'SOFT_MATCH').length;
    const withReplies = filteredDomains.filter((d) => d.has_positive_reply).length;
    const withSignups = filteredDomains.filter((d) => d.has_sign_up).length;
    const withMeetings = filteredDomains.filter((d) => d.has_meeting_booked).length;
    const withPaying = filteredDomains.filter((d) => d.has_paying_customer).length;

    return {
      total,
      withinWindow,
      outsideWindow,
      hardMatches,
      softMatches,
      withReplies,
      withSignups,
      withMeetings,
      withPaying,
    };
  }, [filteredDomains]);

  const toggleDomain = (id: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Domains</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.withinWindow}</div>
            </div>
            <p className="text-xs text-muted-foreground">Within {settings.attribution_window_days}d Window</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.outsideWindow}</div>
            </div>
            <p className="text-xs text-muted-foreground">Outside Window</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.hardMatches}</div>
            <p className="text-xs text-muted-foreground">Hard Matches</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950 dark:to-violet-900">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{stats.softMatches}</div>
            <p className="text-xs text-muted-foreground">Soft Matches</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950 dark:to-teal-900">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.withPaying}</div>
            <p className="text-xs text-muted-foreground">Paying Customers</p>
          </CardContent>
        </Card>
      </div>

      {/* Event Type Breakdown */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="px-3 py-1 bg-purple-500/10">
          <MessageSquare className="h-3 w-3 mr-1" />
          {stats.withReplies} Replies
        </Badge>
        <Badge variant="outline" className="px-3 py-1 bg-blue-500/10">
          <UserPlus className="h-3 w-3 mr-1" />
          {stats.withSignups} Sign-ups
        </Badge>
        <Badge variant="outline" className="px-3 py-1 bg-yellow-500/10">
          <Calendar className="h-3 w-3 mr-1" />
          {stats.withMeetings} Meetings
        </Badge>
        <Badge variant="outline" className="px-3 py-1 bg-green-500/10">
          <DollarSign className="h-3 w-3 mr-1" />
          {stats.withPaying} Paying
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Filters</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Click on any row to see event details</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search domains..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={eventTypeFilter} onValueChange={(v) => setEventTypeFilter(v as EventTypeFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="reply">Replies</SelectItem>
                <SelectItem value="signup">Sign-ups</SelectItem>
                <SelectItem value="meeting">Meetings</SelectItem>
                <SelectItem value="paying">Paying</SelectItem>
              </SelectContent>
            </Select>
            <Select value={matchTypeFilter} onValueChange={(v) => setMatchTypeFilter(v as MatchTypeFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Match Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Matches</SelectItem>
                <SelectItem value="HARD_MATCH">Hard Match</SelectItem>
                <SelectItem value="SOFT_MATCH">Soft Match</SelectItem>
                <SelectItem value="NO_MATCH">No Match</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Window Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="within_window">Within Window</SelectItem>
                <SelectItem value="outside_window">Outside Window</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || eventTypeFilter !== 'all' || matchTypeFilter !== 'all' || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setEventTypeFilter('all');
                  setMatchTypeFilter('all');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {filteredDomains.length === 0 ? (
        <Card className="p-8 text-center">
          <XCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Results</h3>
          <p className="text-muted-foreground">
            No domains match your current filters. Try adjusting your criteria.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead className="w-[200px]">Domain</TableHead>
                  <TableHead className="text-center">Events</TableHead>
                  <TableHead className="text-center">Match Type</TableHead>
                  <TableHead className="text-center">Email Sent</TableHead>
                  <TableHead className="text-center">First Event</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDomains.map((domain) => {
                  const days = getDaysSinceEmail(domain.first_email_sent_at, domain.first_event_at);
                  const isExpanded = expandedDomains.has(domain.id);

                  return (
                    <>
                      <TableRow
                        key={domain.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleDomain(domain.id)}
                      >
                        <TableCell className="w-[30px]">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
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
                              <Badge variant="outline" className="bg-purple-500/10 text-xs px-1.5">
                                <MessageSquare className="h-3 w-3" />
                              </Badge>
                            )}
                            {domain.has_sign_up && (
                              <Badge variant="outline" className="bg-blue-500/10 text-xs px-1.5">
                                <UserPlus className="h-3 w-3" />
                              </Badge>
                            )}
                            {domain.has_meeting_booked && (
                              <Badge variant="outline" className="bg-yellow-500/10 text-xs px-1.5">
                                <Calendar className="h-3 w-3" />
                              </Badge>
                            )}
                            {domain.has_paying_customer && (
                              <Badge className="bg-green-500 text-xs px-1.5">
                                <DollarSign className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={domain.match_type === 'HARD_MATCH' ? 'default' : 'secondary'}>
                            {domain.match_type === 'HARD_MATCH' ? 'Hard' : domain.match_type === 'SOFT_MATCH' ? 'Soft' : 'None'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {formatDate(domain.first_email_sent_at)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {formatDate(domain.first_event_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          {days !== null ? (
                            <span className={days <= settings.attribution_window_days ? 'text-green-600 font-medium' : 'text-amber-600'}>
                              {days}d
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {domain.is_within_window ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Within
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700">
                              <Clock className="h-3 w-3 mr-1" />
                              Outside
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <TableRow key={`${domain.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={8} className="p-0">
                            <div className="p-6 border-t">
                              {/* Header with domain info and attribution status */}
                              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                                <div className="flex items-center gap-4">
                                  <div>
                                    <h3 className="font-semibold text-lg">{domain.domain}</h3>
                                    <p className="text-sm text-muted-foreground">Full account history</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={domain.match_type === 'HARD_MATCH' ? 'default' : 'secondary'}>
                                    {domain.match_type === 'HARD_MATCH' ? 'Hard Match' : 'Soft Match'}
                                  </Badge>
                                  {domain.is_within_window ? (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-700">
                                      Within {settings.attribution_window_days}d Window
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700">
                                      Outside Window
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Account Timeline */}
                              <div className="max-h-[400px] overflow-y-auto">
                                <AccountTimeline
                                  domainId={domain.id}
                                  slug={slug}
                                  uuid={uuid}
                                  isOpen={isExpanded}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground text-center">
        Showing {filteredDomains.length} of {domains.length} domains
      </p>
    </div>
  );
}
