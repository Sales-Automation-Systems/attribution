'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  UserPlus,
  Calendar,
  DollarSign,
  Target,
  CheckCircle2,
  Circle,
} from 'lucide-react';

interface EventBreakdown {
  total: number;
  attributed: number;
  hardMatch: number;
  softMatch: number;
  outsideWindow?: number;
  notMatched?: number;
}

interface AttributionBreakdownProps {
  signUps: EventBreakdown;
  meetings: EventBreakdown;
  paying: EventBreakdown;
}

function EventCard({
  title,
  icon: Icon,
  iconColor,
  data,
}: {
  title: string;
  icon: typeof UserPlus;
  iconColor: string;
  data: EventBreakdown;
}) {
  const percentage = data.total > 0 ? Math.round((data.attributed / data.total) * 100) : 0;
  const hardPercent = data.attributed > 0 ? Math.round((data.hardMatch / data.attributed) * 100) : 0;
  const softPercent = data.attributed > 0 ? Math.round((data.softMatch / data.attributed) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${iconColor}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">
                {data.total.toLocaleString()} total from client
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{percentage}%</div>
            <div className="text-xs text-muted-foreground">ours</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attribution Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Attributed to us</span>
            <span className="font-medium">{data.attributed.toLocaleString()} / {data.total.toLocaleString()}</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        {/* Hard/Soft Breakdown */}
        {data.attributed > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-lg font-semibold text-green-600">{data.hardMatch}</div>
                <div className="text-xs text-muted-foreground">Hard Matches ({hardPercent}%)</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-amber-500" />
              <div>
                <div className="text-lg font-semibold text-amber-600">{data.softMatch}</div>
                <div className="text-xs text-muted-foreground">Soft Matches ({softPercent}%)</div>
              </div>
            </div>
          </div>
        )}

        {/* Not Attributed Breakdown */}
        {(data.outsideWindow || data.notMatched) && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">Not Attributed</div>
            <div className="flex gap-4 text-sm">
              {data.outsideWindow !== undefined && data.outsideWindow > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>{data.outsideWindow} outside window</span>
                </div>
              )}
              {data.notMatched !== undefined && data.notMatched > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>{data.notMatched} no match</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AttributionBreakdown({ signUps, meetings, paying }: AttributionBreakdownProps) {
  // Calculate totals
  const totalAttributed = signUps.attributed + meetings.attributed + paying.attributed;
  const totalHard = signUps.hardMatch + meetings.hardMatch + paying.hardMatch;
  const totalSoft = signUps.softMatch + meetings.softMatch + paying.softMatch;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Our Attribution</div>
            <div className="text-sm text-muted-foreground">Events we're responsible for</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{totalAttributed}</div>
            <div className="text-xs text-muted-foreground">Total Attributed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{totalHard}</div>
            <div className="text-xs text-muted-foreground">Hard Matches</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{totalSoft}</div>
            <div className="text-xs text-muted-foreground">Soft Matches</div>
          </div>
        </div>
      </div>

      {/* Per-Event Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <EventCard
          title="Sign-ups"
          icon={UserPlus}
          iconColor="bg-blue-500/10 text-blue-600"
          data={signUps}
        />
        <EventCard
          title="Meetings"
          icon={Calendar}
          iconColor="bg-purple-500/10 text-purple-600"
          data={meetings}
        />
        <EventCard
          title="Paying Customers"
          icon={DollarSign}
          iconColor="bg-green-500/10 text-green-600"
          data={paying}
        />
      </div>
    </div>
  );
}

