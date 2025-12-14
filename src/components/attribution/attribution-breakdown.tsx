'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  UserPlus,
  Calendar,
  DollarSign,
  Target,
  CheckCircle2,
  Clock,
  CircleSlash,
} from 'lucide-react';
import { DefinitionTooltip } from '@/components/ui/definition-tooltip';

interface EventBreakdown {
  total: number;
  attributed: number;
  outsideWindow: number;
  unattributed: number;
  // Legacy fields - kept for backward compatibility
  hardMatch?: number;
  softMatch?: number;
  notMatched?: number;
}

interface AttributionBreakdownProps {
  signUps: EventBreakdown;
  meetings: EventBreakdown;
  paying: EventBreakdown;
}

function EventCard({
  title,
  tooltipTerm,
  icon: Icon,
  iconColor,
  data,
}: {
  title: string;
  tooltipTerm: 'websiteSignUp' | 'meetingBooked' | 'payingCustomer';
  icon: typeof UserPlus;
  iconColor: string;
  data: EventBreakdown;
}) {
  const attributedPercent = data.total > 0 ? Math.round((data.attributed / data.total) * 100) : 0;
  const outsidePercent = data.total > 0 ? Math.round((data.outsideWindow / data.total) * 100) : 0;
  const unattributedPercent = data.total > 0 ? Math.round((data.unattributed / data.total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${iconColor}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">
                <DefinitionTooltip term={tooltipTerm} showUnderline={false}>
                  {title}
                </DefinitionTooltip>
              </CardTitle>
              <CardDescription className="text-xs">
                {data.total.toLocaleString('en-US')} total from client
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attributed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <DefinitionTooltip term="attributed">
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  {data.attributed.toLocaleString('en-US')} Attributed
                </span>
              </DefinitionTooltip>
            </div>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">
              {attributedPercent}%
            </span>
          </div>
          <Progress 
            value={attributedPercent} 
            className="h-2 bg-muted [&>div]:bg-green-500" 
          />
        </div>

        {/* Status Breakdown */}
        <div className="flex items-center gap-4 pt-2 border-t text-sm">
          {/* Outside Window */}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-yellow-500" />
            <DefinitionTooltip term="outsideWindow" showUnderline={false}>
              <span className="text-yellow-600 dark:text-yellow-400">
                {data.outsideWindow.toLocaleString('en-US')}
              </span>
            </DefinitionTooltip>
            <span className="text-muted-foreground text-xs">
              ({outsidePercent}%)
            </span>
          </div>

          {/* Unattributed */}
          <div className="flex items-center gap-1.5">
            <CircleSlash className="h-3.5 w-3.5 text-gray-400" />
            <DefinitionTooltip term="unattributed" showUnderline={false}>
              <span className="text-gray-500 dark:text-gray-400">
                {data.unattributed.toLocaleString('en-US')}
              </span>
            </DefinitionTooltip>
            <span className="text-muted-foreground text-xs">
              ({unattributedPercent}%)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AttributionBreakdown({ signUps, meetings, paying }: AttributionBreakdownProps) {
  // Calculate totals
  const totalAttributed = signUps.attributed + meetings.attributed + paying.attributed;
  const totalOutsideWindow = signUps.outsideWindow + meetings.outsideWindow + paying.outsideWindow;
  const totalUnattributed = signUps.unattributed + meetings.unattributed + paying.unattributed;
  const grandTotal = totalAttributed + totalOutsideWindow + totalUnattributed;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Attribution Summary</div>
            <div className="text-sm text-muted-foreground">
              <DefinitionTooltip term="successMetric" showUnderline={false}>
                Success Metrics breakdown by status
              </DefinitionTooltip>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <DefinitionTooltip term="attributed" showUnderline={false}>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {totalAttributed.toLocaleString('en-US')}
              </div>
            </DefinitionTooltip>
            <div className="text-xs text-muted-foreground">Attributed</div>
          </div>
          <div className="text-center">
            <DefinitionTooltip term="outsideWindow" showUnderline={false}>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {totalOutsideWindow.toLocaleString('en-US')}
              </div>
            </DefinitionTooltip>
            <div className="text-xs text-muted-foreground">Outside Window</div>
          </div>
          <div className="text-center">
            <DefinitionTooltip term="unattributed" showUnderline={false}>
              <div className="text-2xl font-bold text-gray-500 dark:text-gray-400">
                {totalUnattributed.toLocaleString('en-US')}
              </div>
            </DefinitionTooltip>
            <div className="text-xs text-muted-foreground">Unattributed</div>
          </div>
        </div>
      </div>

      {/* Per-Event Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <EventCard
          title="Sign-ups"
          tooltipTerm="websiteSignUp"
          icon={UserPlus}
          iconColor="bg-blue-500/10 text-blue-600"
          data={signUps}
        />
        <EventCard
          title="Meetings"
          tooltipTerm="meetingBooked"
          icon={Calendar}
          iconColor="bg-purple-500/10 text-purple-600"
          data={meetings}
        />
        <EventCard
          title="Paying Customers"
          tooltipTerm="payingCustomer"
          icon={DollarSign}
          iconColor="bg-green-500/10 text-green-600"
          data={paying}
        />
      </div>
    </div>
  );
}
