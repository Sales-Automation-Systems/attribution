'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventBreakdown {
  eventType: string;
  total: number;
  attributed: number;
  hardMatch: number;
  softMatch: number;
  outsideWindow: number;
  notMatched: number;
}

interface AttributionTableProps {
  positiveReplies: {
    total: number;
    attributed: number;
    hardMatch: number;
    softMatch: number;
  };
  signUps: {
    total: number;
    attributed: number;
    hardMatch: number;
    softMatch: number;
    outsideWindow: number;
    notMatched: number;
  };
  meetings: {
    total: number;
    attributed: number;
    hardMatch: number;
    softMatch: number;
    outsideWindow: number;
    notMatched: number;
  };
  paying: {
    total: number;
    attributed: number;
    hardMatch: number;
    softMatch: number;
    outsideWindow: number;
    notMatched: number;
  };
}

export function AttributionTable({
  positiveReplies,
  signUps,
  meetings,
  paying,
}: AttributionTableProps) {
  const rows: EventBreakdown[] = [
    {
      eventType: 'Positive Replies',
      total: positiveReplies.total,
      attributed: positiveReplies.attributed,
      hardMatch: positiveReplies.hardMatch,
      softMatch: positiveReplies.softMatch,
      outsideWindow: 0, // Positive replies have no window
      notMatched: 0, // Positive replies are always attributed
    },
    {
      eventType: 'Sign-ups',
      total: signUps.total,
      attributed: signUps.attributed,
      hardMatch: signUps.hardMatch,
      softMatch: signUps.softMatch,
      outsideWindow: signUps.outsideWindow,
      notMatched: signUps.notMatched,
    },
    {
      eventType: 'Meetings Booked',
      total: meetings.total,
      attributed: meetings.attributed,
      hardMatch: meetings.hardMatch,
      softMatch: meetings.softMatch,
      outsideWindow: meetings.outsideWindow,
      notMatched: meetings.notMatched,
    },
    {
      eventType: 'Paying Customers',
      total: paying.total,
      attributed: paying.attributed,
      hardMatch: paying.hardMatch,
      softMatch: paying.softMatch,
      outsideWindow: paying.outsideWindow,
      notMatched: paying.notMatched,
    },
  ];

  const getPercentage = (value: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const getPercentageColor = (pct: number): string => {
    if (pct >= 50) return 'text-green-600';
    if (pct >= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Calculate totals
  const totals = rows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      attributed: acc.attributed + row.attributed,
      hardMatch: acc.hardMatch + row.hardMatch,
      softMatch: acc.softMatch + row.softMatch,
      outsideWindow: acc.outsideWindow + row.outsideWindow,
      notMatched: acc.notMatched + row.notMatched,
    }),
    { total: 0, attributed: 0, hardMatch: 0, softMatch: 0, outsideWindow: 0, notMatched: 0 }
  );

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[150px]">Event Type</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">
              <div className="flex items-center justify-end gap-1">
                <span>Attributed</span>
              </div>
            </TableHead>
            <TableHead className="text-right">
              <div className="flex items-center justify-end gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Hard</span>
              </div>
            </TableHead>
            <TableHead className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Clock className="h-3 w-3 text-yellow-500" />
                <span>Soft</span>
              </div>
            </TableHead>
            <TableHead className="text-right">
              <div className="flex items-center justify-end gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-500" />
                <span>Outside Window</span>
              </div>
            </TableHead>
            <TableHead className="text-right">
              <div className="flex items-center justify-end gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span>No Match</span>
              </div>
            </TableHead>
            <TableHead className="text-right w-[100px]">% Ours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const pct = getPercentage(row.attributed, row.total);
            return (
              <TableRow key={row.eventType}>
                <TableCell className="font-medium">{row.eventType}</TableCell>
                <TableCell className="text-right font-semibold">
                  {row.total.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold text-primary">
                    {row.attributed.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="bg-green-500/10 text-green-700">
                    {row.hardMatch.toLocaleString()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700">
                    {row.softMatch.toLocaleString()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {row.outsideWindow > 0 ? (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-700">
                      {row.outsideWindow.toLocaleString()}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {row.notMatched > 0 ? (
                    <Badge variant="outline" className="bg-red-500/10 text-red-700">
                      {row.notMatched.toLocaleString()}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Progress value={pct} className="w-12 h-2" />
                    <span className={cn('font-semibold w-10', getPercentageColor(pct))}>
                      {row.total > 0 ? `${pct}%` : '—'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {/* Totals row */}
          <TableRow className="bg-muted/30 font-semibold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totals.total.toLocaleString()}</TableCell>
            <TableCell className="text-right text-primary">
              {totals.attributed.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className="bg-green-500/10 text-green-700">
                {totals.hardMatch.toLocaleString()}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700">
                {totals.softMatch.toLocaleString()}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className="bg-orange-500/10 text-orange-700">
                {totals.outsideWindow.toLocaleString()}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className="bg-red-500/10 text-red-700">
                {totals.notMatched.toLocaleString()}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <span className={cn('font-semibold', getPercentageColor(getPercentage(totals.attributed, totals.total)))}>
                {totals.total > 0 ? `${getPercentage(totals.attributed, totals.total)}%` : '—'}
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
