'use client';

import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, UserPlus, Calendar, DollarSign, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DomainBreakdownProps {
  domainsWithReplies: number;
  domainsWithSignups: number;
  domainsWithMeetings: number;
  domainsWithPaying: number;
  domainsWithMultiple: number;
  totalDomains: number;
}

export function DomainBreakdown({
  domainsWithReplies,
  domainsWithSignups,
  domainsWithMeetings,
  domainsWithPaying,
  domainsWithMultiple,
  totalDomains,
}: DomainBreakdownProps) {
  const items = [
    {
      label: 'With Positive Replies',
      value: domainsWithReplies,
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'With Sign-ups',
      value: domainsWithSignups,
      icon: <UserPlus className="h-4 w-4" />,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500/10',
    },
    {
      label: 'With Meetings',
      value: domainsWithMeetings,
      icon: <Calendar className="h-4 w-4" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'With Paying Customers',
      value: domainsWithPaying,
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'With Multiple Events',
      value: domainsWithMultiple,
      icon: <Layers className="h-4 w-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((item) => (
        <Card key={item.label} className={cn('border-0', item.bgColor)}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={item.color}>{item.icon}</span>
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <div className="text-xl font-bold">
              {item.value.toLocaleString()}
              <span className="text-xs text-muted-foreground font-normal ml-1">
                / {totalDomains}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


