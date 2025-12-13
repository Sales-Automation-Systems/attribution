'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, MessageSquare, UserPlus, Calendar, DollarSign } from 'lucide-react';

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

export function AccountTimeline({ domainId, slug, uuid, isOpen }: AccountTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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
      if (!response.ok) {
        throw new Error('Failed to fetch timeline');
      }
      const data = await response.json();
      setEvents(data.timeline || []);
      setLoaded(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="py-6 text-center text-sm text-muted-foreground">
        No events found for this account.
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

  // Group events by date
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
                  <div className={`rounded-lg p-3 ${config.bgColor}`}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className={`${config.color} border-current`}>
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(event.date)}
                      </span>
                    </div>

                    {event.email && (
                      <p className="text-sm font-medium mt-1">
                        {event.email}
                      </p>
                    )}

                    {event.subject && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        Subject: {event.subject}
                      </p>
                    )}

                    {event.campaignName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Campaign: {event.campaignName}
                      </p>
                    )}

                    {event.metadata && event.type === 'POSITIVE_REPLY' && typeof event.metadata.category === 'string' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Category: {event.metadata.category}
                      </p>
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
          {events.length} event{events.length !== 1 ? 's' : ''} total
        </p>
      </div>
    </div>
  );
}

