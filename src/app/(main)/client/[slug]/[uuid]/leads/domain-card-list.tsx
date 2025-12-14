'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  UserPlus,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { DomainTimeline } from './domain-timeline';

interface Domain {
  id: string;
  client_config_id: string;
  domain: string;
  first_email_sent_at: Date | null;
  first_event_at: Date | null;
  first_attributed_month: string | null;
  has_positive_reply: boolean;
  has_sign_up: boolean;
  has_meeting_booked: boolean;
  has_paying_customer: boolean;
  is_within_window: boolean;
  match_type: string | null;
  status: string;
  dispute_reason: string | null;
  dispute_submitted_at: Date | null;
  dispute_resolved_at: Date | null;
  dispute_resolution_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DomainCardListProps {
  domains: Domain[];
  slug: string;
  uuid: string;
}

export function DomainCardList({ domains, slug, uuid }: DomainCardListProps) {
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set());

  const toggleDomain = (domainId: string) => {
    setOpenDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {domains.map((domain) => {
        const isOpen = openDomains.has(domain.id);

        return (
          <Collapsible key={domain.id} open={isOpen} onOpenChange={() => toggleDomain(domain.id)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <CardTitle className="text-lg">{domain.domain}</CardTitle>
                        <CardDescription>
                          {domain.first_event_at
                            ? `First event: ${domain.first_event_at.toLocaleDateString()}`
                            : 'No events yet'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Event Type Badges */}
                      {domain.has_positive_reply && (
                        <Badge variant="outline" className="bg-purple-500/10">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Reply
                        </Badge>
                      )}
                      {domain.has_sign_up && (
                        <Badge variant="outline" className="bg-blue-500/10">
                          <UserPlus className="h-3 w-3 mr-1" />
                          Sign-up
                        </Badge>
                      )}
                      {domain.has_meeting_booked && (
                        <Badge variant="outline" className="bg-yellow-500/10">
                          <Calendar className="h-3 w-3 mr-1" />
                          Meeting
                        </Badge>
                      )}
                      {domain.has_paying_customer && (
                        <Badge className="bg-green-500">
                          <DollarSign className="h-3 w-3 mr-1" />
                          Paying
                        </Badge>
                      )}

                      {/* Match Type */}
                      <Badge
                        variant={domain.match_type === 'HARD_MATCH' ? 'default' : 'secondary'}
                      >
                        {domain.match_type === 'HARD_MATCH'
                          ? 'Hard Match'
                          : domain.match_type === 'SOFT_MATCH'
                            ? 'Soft Match'
                            : 'No Match'}
                      </Badge>

                      {/* Status */}
                      {domain.status !== 'ATTRIBUTED' && (
                        <Badge
                          variant={
                            domain.status === 'DISPUTED'
                              ? 'destructive'
                              : domain.status === 'CONFIRMED'
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {domain.status}
                        </Badge>
                      )}

                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="border-t pt-4">
                  <div className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">First Email Sent</p>
                        <p className="font-medium">
                          {domain.first_email_sent_at
                            ? domain.first_email_sent_at.toLocaleString()
                            : 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">First Event</p>
                        <p className="font-medium">
                          {domain.first_event_at
                            ? domain.first_event_at.toLocaleString()
                            : 'None'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Attribution Window</p>
                        {domain.is_within_window ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700">
                            Within 31 days
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-700">
                            Outside window
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-4">Event Timeline</h4>
                      <DomainTimeline
                        domainId={domain.id}
                        slug={slug}
                        uuid={uuid}
                        isOpen={isOpen}
                      />
                    </div>

                    {/* Dispute Section */}
                    {domain.status === 'ATTRIBUTED' && (
                      <div className="pt-4 border-t">
                        <Button variant="outline" size="sm">
                          Dispute Attribution
                        </Button>
                      </div>
                    )}
                    {domain.dispute_reason && (
                      <div className="p-3 bg-yellow-500/10 rounded-lg">
                        <p className="text-sm font-medium text-yellow-700">Dispute Reason:</p>
                        <p className="text-sm text-yellow-600">{domain.dispute_reason}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

