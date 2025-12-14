'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, MessageSquare, UserPlus, Calendar, DollarSign, ChevronDown, ChevronUp, User, Briefcase, Focus } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'EMAIL_SENT' | 'POSITIVE_REPLY' | 'SIGN_UP' | 'MEETING_BOOKED' | 'PAYING_CUSTOMER';
  date: string;
  email?: string;
  subject?: string;
  campaignName?: string;
  metadata?: Record<string, unknown>;
}

interface AccountTimelineProps {
  domainId: string;
  slug: string;
  uuid: string;
  isOpen: boolean;
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
        className="mt-1 text-sm bg-background/50 rounded p-2 whitespace-pre-wrap font-mono text-xs max-h-[400px] overflow-y-auto"
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

export function AccountTimeline({ domainId, slug, uuid, isOpen }: AccountTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasDetailedEvents, setHasDetailedEvents] = useState(false);
  const [matchType, setMatchType] = useState<string | null>(null);
  const [matchedEmail, setMatchedEmail] = useState<string | null>(null);
  const [focusView, setFocusView] = useState(false);

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
      setMatchedEmail(data.domain?.matchedEmail || null);
      setLoaded(true);
    } catch (err) {
      console.error('Timeline fetch error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Determine which events should be dimmed (not hidden) in Focus View
  const getDimmedStatus = (event: TimelineEvent): boolean => {
    if (!focusView || !matchedEmail) return false;
    if (event.type !== 'EMAIL_SENT') return false;
    // Dim EMAIL_SENT events that aren't to the matched contact
    return event.email?.toLowerCase() !== matchedEmail.toLowerCase();
  };

  // Count how many events are dimmed
  const dimmedCount = useMemo(() => {
    if (!focusView || !matchedEmail) return 0;
    return events.filter(event => 
      event.type === 'EMAIL_SENT' && 
      event.email?.toLowerCase() !== matchedEmail.toLowerCase()
    ).length;
  }, [events, focusView, matchedEmail]);
  const isDirectMatch = matchType === 'HARD_MATCH';
  const canUseFocusView = isDirectMatch && matchedEmail;

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

  // Group events by date (using all events, not filtered)
  const eventsByDate = events.reduce((acc, event) => {
    const dateKey = new Date(event.date).toDateString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  return (
    <div className="space-y-4">
      {/* Focus View Header - only show for direct matches with matched email */}
      {canUseFocusView && (
        <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Focus className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  Direct Match: {matchedEmail}
                </p>
                {focusView && dimmedCount > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
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

      {Object.entries(eventsByDate).map(([dateKey, dateEvents]) => (
        <div key={dateKey} className="relative">
          {/* Date Header */}
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2 mb-2">
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
              
              // Check if this event is from the matched contact
              const isFocusedContact = matchedEmail && event.email?.toLowerCase() === matchedEmail.toLowerCase();
              
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

                    {/* Email address */}
                    {renderField('To', event.email, 'text-sm mt-1')}

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
          {!hasDetailedEvents && events.length > 0 && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400">
              Showing summary view • Full history available after next sync
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

