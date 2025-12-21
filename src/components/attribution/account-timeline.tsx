'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, MessageSquare, UserPlus, Calendar, DollarSign, ChevronDown, ChevronUp, User, Briefcase, Focus, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  type: 'EMAIL_SENT' | 'POSITIVE_REPLY' | 'SIGN_UP' | 'MEETING_BOOKED' | 'PAYING_CUSTOMER' | 'STATUS_CHANGE';
  date: string;
  email?: string;
  subject?: string;
  campaignName?: string;
  metadata?: Record<string, unknown>;
}

// Event types that can be filtered from the dialog
type FilterableEventType = 'POSITIVE_REPLY' | 'SIGN_UP' | 'MEETING_BOOKED' | 'PAYING_CUSTOMER';

interface AccountTimelineProps {
  domainId: string;
  slug: string;
  uuid: string;
  isOpen: boolean;
  eventTypeFilters?: Set<FilterableEventType>;
}

const EVENT_CONFIG: Record<string, { 
  icon: React.ReactNode; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  EMAIL_SENT: { 
    icon: <Mail className="h-4 w-4" />, 
    label: 'Email Sent',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  POSITIVE_REPLY: { 
    icon: <MessageSquare className="h-4 w-4" />, 
    label: 'Positive Reply',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  SIGN_UP: { 
    icon: <UserPlus className="h-4 w-4" />, 
    label: 'Sign Up',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  MEETING_BOOKED: { 
    icon: <Calendar className="h-4 w-4" />, 
    label: 'Meeting Booked',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  PAYING_CUSTOMER: { 
    icon: <DollarSign className="h-4 w-4" />, 
    label: 'Paying Customer',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  STATUS_CHANGE: { 
    icon: <History className="h-4 w-4" />, 
    label: 'Status Changed',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
};

function EmailBodyDisplay({ body, label }: { body: string; label: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const preview = body.length > 200 ? body.substring(0, 200) + '...' : body;
  const needsTruncation = body.length > 200;
  
  return (
    <div className="mt-2 border-t border-current/10 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {needsTruncation && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Expand
              </>
            )}
          </Button>
        )}
      </div>
      <div 
        className="mt-1 text-sm bg-muted rounded p-2 whitespace-pre-wrap font-mono text-xs max-h-[400px] overflow-y-auto"
        style={{ wordBreak: 'break-word' }}
      >
        {isExpanded || !needsTruncation ? body : preview}
      </div>
    </div>
  );
}

function ContactInfo({ name, title }: { name?: string | null; title?: string | null }) {
  if (!name && !title) return null;
  
  return (
    <div className="flex items-center gap-2 mt-1 text-sm">
      <User className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{name}</span>
      {title && (
        <>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            {title}
          </span>
        </>
      )}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function renderField(label: string, value: unknown, className?: string): React.ReactNode {
  if (value === null || value === undefined || value === '') return null;
  return (
    <p className={className || "text-sm text-muted-foreground mt-1"}>
      <span className="font-medium">{label}:</span> {String(value)}
    </p>
  );
}

export function AccountTimeline({ domainId, slug, uuid, isOpen, eventTypeFilters }: AccountTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasDetailedEvents, setHasDetailedEvents] = useState(false);
  const [matchType, setMatchType] = useState<string | null>(null);
  const [matchedEmails, setMatchedEmails] = useState<string[]>([]);
  const [focusView, setFocusView] = useState(false);
  const [domainStatus, setDomainStatus] = useState<string | null>(null);
  const [domainName, setDomainName] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !loaded) {
      fetchTimeline();
    }
  }, [isOpen, loaded, domainId, slug, uuid]);

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${slug}/${uuid}/domains/${domainId}/timeline`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to fetch timeline');
      }
      setEvents(data.timeline || []);
      setHasDetailedEvents(data.hasDetailedEvents || false);
      setMatchType(data.domain?.matchType || null);
      setDomainStatus(data.domain?.status || null);
      setDomainName(data.domain?.name || null);
      // Use new array format, fall back to legacy single email
      const emails = data.domain?.matchedEmails || [];
      if (emails.length === 0 && data.domain?.matchedEmail) {
        setMatchedEmails([data.domain.matchedEmail]);
      } else {
        setMatchedEmails(emails);
      }
      setLoaded(true);
    } catch (err) {
      console.error('Timeline fetch error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if an email is in the matched emails list
  const isEmailFocused = (email: string | undefined): boolean => {
    if (!email || matchedEmails.length === 0) return false;
    const emailLower = email.toLowerCase();
    return matchedEmails.some(m => m.toLowerCase() === emailLower);
  };

  // Determine which events should be dimmed (not hidden) in Focus View
  const getDimmedStatus = (event: TimelineEvent): boolean => {
    // First check: event type filter dimming (like Focus View but for event types)
    if (eventTypeFilters && eventTypeFilters.size > 0) {
      // If filters are active, dim events that don't match the selected types
      if (!eventTypeFilters.has(event.type as FilterableEventType)) {
        return true;
      }
    }
    
    // Second check: Focus View email dimming
    if (!focusView || matchedEmails.length === 0) return false;
    if (event.type !== 'EMAIL_SENT') return false;
    // Dim EMAIL_SENT events that aren't to ANY of the matched contacts
    return !isEmailFocused(event.email);
  };

  // Count how many events are dimmed
  const dimmedCount = useMemo(() => {
    if (!focusView || matchedEmails.length === 0) return 0;
    return events.filter(event => 
      event.type === 'EMAIL_SENT' && 
      !isEmailFocused(event.email)
    ).length;
  }, [events, focusView, matchedEmails]);
  const isDirectMatch = matchType === 'HARD_MATCH';
  const canUseFocusView = isDirectMatch && matchedEmails.length > 0;

  // IMPORTANT: All useMemo hooks MUST be called before any early returns (React Rules of Hooks)
  // Show all events - dimming is handled by getDimmedStatus instead of filtering
  const filteredEvents = useMemo(() => {
    return events; // Always show all events, dimming handles the "focus" effect
  }, [events]);

  // Count of dimmed events when event type filter is active
  const eventFilterDimmedCount = useMemo(() => {
    if (!eventTypeFilters || eventTypeFilters.size === 0) return 0;
    return events.filter(event => !eventTypeFilters.has(event.type as FilterableEventType)).length;
  }, [events, eventTypeFilters]);

  // Group events by date (must be before early returns)
  const eventsByDate = useMemo(() => {
    return filteredEvents.reduce((acc, event) => {
      const dateKey = new Date(event.date).toDateString();
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(event);
      return acc;
    }, {} as Record<string, TimelineEvent[]>);
  }, [filteredEvents]);

  // Format functions (pure, no hooks)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // NOW safe to have early returns - all hooks have been called
  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-red-500">
        Error loading timeline: {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">No events found for this account.</p>
        <p className="text-xs text-muted-foreground">
          This could mean the data hasn&apos;t been synced yet or the domain format doesn&apos;t match.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-background">
      {/* Focus View Header - only show for direct matches with matched emails */}
      {/* Sticky so it stays visible when scrolling through long timelines */}
      {canUseFocusView && (
        <div className="sticky top-0 z-20 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Focus className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  {matchedEmails.length === 1 
                    ? `Focused Contact: ${matchedEmails[0]}`
                    : `Focused Contacts (${matchedEmails.length}):`
                  }
                </p>
                {matchedEmails.length > 1 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {matchedEmails.join(', ')}
                  </p>
                )}
                {focusView && dimmedCount > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    {dimmedCount} other email{dimmedCount !== 1 ? 's' : ''} dimmed
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="focus-view" className="text-sm text-emerald-700 dark:text-emerald-300 cursor-pointer">
                Focus View
              </Label>
              <Switch
                id="focus-view"
                checked={focusView}
                onCheckedChange={setFocusView}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Event Type Filter Message */}
      {/* Also sticky, positioned below the Focus View Header if present */}
      {eventTypeFilters && eventTypeFilters.size > 0 && eventFilterDimmedCount > 0 && (
        <div className={cn(
          "sticky z-20 flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 shadow-sm",
          canUseFocusView ? "top-[60px]" : "top-0"
        )}>
          <Focus className="h-3.5 w-3.5" />
          <span>
            Focused on {events.length - eventFilterDimmedCount} event{events.length - eventFilterDimmedCount !== 1 ? 's' : ''} 
            {' '}({eventFilterDimmedCount} other{eventFilterDimmedCount !== 1 ? 's' : ''} dimmed)
          </span>
        </div>
      )}

      {Object.entries(eventsByDate).map(([dateKey, dateEvents]) => (
        <div key={dateKey} className="relative">
          {/* Date Header */}
          <div className="sticky top-0 bg-background z-10 py-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">
              {formatDate(dateEvents[0].date)}
            </p>
          </div>

          {/* Events for this date */}
          <div className="space-y-2 pl-2 border-l-2 border-muted ml-2">
            {dateEvents.map((event) => {
              const config = EVENT_CONFIG[event.type];
              const meta = event.metadata || {};
              const isDimmed = getDimmedStatus(event);
              
              // Check if this event is from any of the matched contacts
              const isFocusedContact = isEmailFocused(event.email);
              
              // DIMMED VIEW: Condensed single-line for non-focused emails
              if (isDimmed) {
                return (
                  <div
                    key={event.id}
                    className="relative pl-6 pb-1 opacity-40 hover:opacity-60 transition-opacity duration-200"
                  >
                    {/* Smaller timeline dot */}
                    <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <Mail className="h-2 w-2 text-slate-400 dark:text-slate-500" />
                    </div>

                    {/* Condensed single-line content */}
                    <div className="flex items-center gap-3 py-1 px-2 rounded bg-slate-100/50 dark:bg-slate-800/30 text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums shrink-0">
                        {formatTime(event.date)}
                      </span>
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        → {event.email}
                      </span>
                    </div>
                  </div>
                );
              }
              
              // FULL VIEW: Normal expanded event card
              // Email sent metadata
              const emailBody = meta.body as string | undefined;
              const fromEmail = meta.fromEmail as string | undefined;
              const campaignName = meta.campaignName as string | undefined;
              const stepNumber = meta.stepNumber as number | undefined;
              const recipientName = meta.recipientName as string | undefined;
              const recipientTitle = meta.recipientTitle as string | undefined;
              
              // Positive reply metadata
              const replyBody = meta.replyBody as string | undefined;
              const replySubject = meta.replySubject as string | undefined;
              const contactName = meta.contactName as string | undefined;
              const jobTitle = meta.jobTitle as string | undefined;
              const companyName = meta.companyName as string | undefined;
              
              // Attribution event metadata (deal value, meeting title, etc.)
              const dealValue = meta.deal_value || meta.dealValue || meta.value || meta.amount;
              const meetingTitle = meta.meeting_title || meta.meetingTitle || meta.title;
              const planType = meta.plan_type || meta.planType || meta.plan;
              const productName = meta.product_name || meta.productName || meta.product;
              const source = meta.source;
              
              // Manual event metadata
              const isManualEvent = meta.manual === true;
              const addedBy = meta.addedBy as string | undefined;
              
              // Status change metadata (supports both old and new format)
              const statusFrom = (meta.oldStatus || meta.from || meta.previousStatus) as string | undefined;
              const statusTo = (meta.newStatus || meta.to) as string | undefined;
              const statusAction = meta.action as string | undefined;
              const statusReason = meta.reason as string | undefined;
              const statusChangedBy = meta.changedBy as string | undefined;
              
              return (
                <div
                  key={event.id}
                  className="relative pl-6 pb-3"
                >
                  {/* Timeline dot */}
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ${config.bgColor} flex items-center justify-center`}>
                    <div className={config.color}>
                      {config.icon}
                    </div>
                  </div>

                  {/* Event content */}
                  <div className={`rounded-lg p-3 ${config.bgColor} ${isFocusedContact && isDirectMatch ? 'ring-2 ring-emerald-400 dark:ring-emerald-600' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${config.color} border-current`}>
                          {config.label}
                        </Badge>
                        {stepNumber && (
                          <span className="text-xs text-muted-foreground">
                            Step {stepNumber}
                          </span>
                        )}
                        {isFocusedContact && isDirectMatch && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
                            Focused Contact
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(event.date)}
                      </span>
                    </div>

                    {/* Contact info for emails */}
                    {event.type === 'EMAIL_SENT' && (recipientName || recipientTitle) && (
                      <ContactInfo name={recipientName} title={recipientTitle} />
                    )}

                    {/* Contact info for positive replies */}
                    {event.type === 'POSITIVE_REPLY' && (contactName || jobTitle) && (
                      <ContactInfo name={contactName} title={jobTitle} />
                    )}

                    {/* Email address - or domain indicator if no email */}
                    {event.email ? (
                      renderField('To', event.email, 'text-sm mt-1')
                    ) : (
                      // For events without a specific email (common for PAYING_CUSTOMER from CRM)
                      ['PAYING_CUSTOMER', 'SIGN_UP', 'MEETING_BOOKED'].includes(event.type) && domainName && (
                        <p className="text-sm mt-1">
                          <span className="text-muted-foreground">Account:</span>{' '}
                          <span className="font-medium">{domainName}</span>
                        </p>
                      )
                    )}

                    {/* Sender email */}
                    {renderField('From', fromEmail, 'text-sm')}

                    {/* Subject line */}
                    {renderField('Subject', event.subject)}

                    {/* Reply subject for positive replies */}
                    {event.type === 'POSITIVE_REPLY' && renderField('Reply Subject', replySubject)}

                    {/* Campaign name */}
                    {renderField('Campaign', campaignName, 'text-xs text-muted-foreground mt-1')}

                    {/* Reply category */}
                    {event.type === 'POSITIVE_REPLY' && renderField('Category', meta.category, 'text-xs text-muted-foreground mt-1')}

                    {/* Company name (for positive replies) */}
                    {renderField('Company', companyName, 'text-xs text-muted-foreground mt-1')}

                    {/* Deal value for paying customers */}
                    {typeof dealValue === 'number' && dealValue > 0 && (
                      <p className="text-sm font-semibold text-green-600 mt-2">
                        Deal Value: {formatCurrency(dealValue)}
                      </p>
                    )}

                    {/* Meeting title */}
                    {renderField('Meeting', meetingTitle, 'text-sm mt-1')}

                    {/* Plan type for sign-ups/paying */}
                    {renderField('Plan', planType, 'text-xs text-muted-foreground mt-1')}

                    {/* Product name */}
                    {renderField('Product', productName, 'text-xs text-muted-foreground mt-1')}

                    {/* Source */}
                    {renderField('Source', source, 'text-xs text-muted-foreground mt-1')}

                    {/* Manual event indicator */}
                    {isManualEvent && (
                      <div className="mt-2 pt-2 border-t border-current/10 flex items-center gap-1">
                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                          Manually Added
                        </Badge>
                        {addedBy && addedBy !== 'client-user@placeholder' && (
                          <span className="text-xs text-muted-foreground">by {addedBy}</span>
                        )}
                      </div>
                    )}

                    {/* Status change - detailed display */}
                    {event.type === 'STATUS_CHANGE' && (statusFrom || statusTo) && (
                      <div className="space-y-1">
                        {/* Action label - format nicely based on action type */}
                        {statusAction && (
                          <p className={cn(
                            "text-xs font-medium",
                            statusAction === 'SYSTEM_UPDATE' && statusTo === 'ATTRIBUTED'
                              ? "text-green-600 dark:text-green-400"
                              : statusAction === 'DISPUTE_SUBMITTED'
                              ? "text-amber-600 dark:text-amber-400"
                              : statusAction === 'DISPUTE_APPROVED'
                              ? "text-red-600 dark:text-red-400"
                              : statusAction === 'DISPUTE_REJECTED'
                              ? "text-green-600 dark:text-green-400"
                              : "text-orange-600 dark:text-orange-400"
                          )}>
                            {statusAction === 'SYSTEM_UPDATE' && statusTo === 'ATTRIBUTED'
                              ? '✓ Attribution Confirmed'
                              : statusAction === 'DISPUTE_SUBMITTED'
                              ? '⚠ Dispute Submitted'
                              : statusAction === 'DISPUTE_APPROVED'
                              ? '✗ Dispute Approved (Removed)'
                              : statusAction === 'DISPUTE_REJECTED'
                              ? '✓ Dispute Rejected (Confirmed)'
                              : statusAction === 'MANUAL_ATTRIBUTION'
                              ? '↑ Manually Attributed'
                              : statusAction.replace(/_/g, ' ')
                            }
                          </p>
                        )}
                        {/* Status transition - hide for system attribution where it's redundant */}
                        {!(statusAction === 'SYSTEM_UPDATE' && statusTo === 'ATTRIBUTED' && !statusFrom) && (
                          <p className="text-xs text-muted-foreground">
                            {statusFrom && (
                              <>
                                <span className="line-through opacity-60">{statusFrom}</span>
                                <span className="mx-1">→</span>
                              </>
                            )}
                            <span className="font-medium">{statusTo}</span>
                          </p>
                        )}
                        {/* Reason - hide for system attribution as it's verbose */}
                        {statusReason && statusAction !== 'SYSTEM_UPDATE' && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            &quot;{statusReason}&quot;
                          </p>
                        )}
                        {/* Changed by */}
                        {statusChangedBy && statusChangedBy !== 'client-user@placeholder' && statusChangedBy !== 'System' && (
                          <p className="text-xs text-muted-foreground opacity-70">
                            by {statusChangedBy}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Email body for sent emails */}
                    {emailBody && event.type === 'EMAIL_SENT' && (
                      <EmailBodyDisplay body={emailBody} label="Email Copy" />
                    )}

                    {/* Reply body for positive replies */}
                    {replyBody && event.type === 'POSITIVE_REPLY' && (
                      <EmailBodyDisplay body={replyBody} label="Reply Content" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="pt-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          {events.length} event{events.length !== 1 ? 's' : ''}
          {focusView && dimmedCount > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400"> • {dimmedCount} dimmed</span>
          )}
          {!hasDetailedEvents && events.length > 0 && domainStatus !== 'MANUAL' && domainStatus !== 'CLIENT_PROMOTED' && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400">
              Showing summary view • Full history available after next sync
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

