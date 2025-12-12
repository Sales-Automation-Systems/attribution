'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, MessageSquare, UserPlus, Calendar, DollarSign, MailOpen } from 'lucide-react';

interface DomainEvent {
  id: string;
  attributed_domain_id: string;
  event_source: string;
  event_time: string;
  email: string | null;
  source_id: string | null;
  source_table: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface DomainTimelineProps {
  domainId: string;
  slug: string;
  uuid: string;
  isOpen: boolean;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  EMAIL_SENT: <Mail className="h-4 w-4 text-blue-500" />,
  EMAIL_RECEIVED: <MailOpen className="h-4 w-4 text-green-500" />,
  POSITIVE_REPLY: <MessageSquare className="h-4 w-4 text-purple-500" />,
  SIGN_UP: <UserPlus className="h-4 w-4 text-blue-600" />,
  MEETING_BOOKED: <Calendar className="h-4 w-4 text-yellow-600" />,
  PAYING_CUSTOMER: <DollarSign className="h-4 w-4 text-green-600" />,
};

const EVENT_LABELS: Record<string, string> = {
  EMAIL_SENT: 'Email Sent',
  EMAIL_RECEIVED: 'Email Received',
  POSITIVE_REPLY: 'Positive Reply',
  SIGN_UP: 'Sign Up',
  MEETING_BOOKED: 'Meeting Booked',
  PAYING_CUSTOMER: 'Paying Customer',
};

export function DomainTimeline({ domainId, slug, uuid, isOpen }: DomainTimelineProps) {
  const [events, setEvents] = useState<DomainEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !loaded) {
      fetchEvents();
    }
  }, [isOpen, loaded]);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${slug}/${uuid}/domains/${domainId}/events`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data.events || []);
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center text-red-500">
        Error loading timeline: {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-4 text-center text-muted-foreground">
        No detailed events recorded yet. Events will appear here as they&apos;re processed.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {events.map((event, index) => (
          <div key={event.id} className="relative flex items-start gap-4 pl-10">
            {/* Timeline dot */}
            <div className="absolute left-2 w-5 h-5 rounded-full bg-background border-2 border-primary flex items-center justify-center">
              {EVENT_ICONS[event.event_source] || <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>

            {/* Event content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">
                  {EVENT_LABELS[event.event_source] || event.event_source}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.event_time).toLocaleString()}
                </span>
              </div>

              {event.email && (
                <p className="text-sm text-muted-foreground">
                  {event.email}
                </p>
              )}

              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {'subject' in event.metadata && event.metadata.subject && (
                    <p>Subject: {String(event.metadata.subject)}</p>
                  )}
                  {'campaign_name' in event.metadata && event.metadata.campaign_name && (
                    <p>Campaign: {String(event.metadata.campaign_name)}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

