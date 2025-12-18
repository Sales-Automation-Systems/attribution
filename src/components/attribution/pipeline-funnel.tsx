'use client';

import { Mail, MessageSquare, UserPlus, Calendar, DollarSign, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunnelStage {
  label: string;
  total: number;
  attributed: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface PipelineFunnelProps {
  emailsSent: number;
  positiveReplies: number;
  attributedReplies: number;
  signUps: number;
  attributedSignUps: number;
  meetings: number;
  attributedMeetings: number;
  paying: number;
  attributedPaying: number;
}

export function PipelineFunnel({
  emailsSent,
  positiveReplies,
  attributedReplies,
  signUps,
  attributedSignUps,
  meetings,
  attributedMeetings,
  paying,
  attributedPaying,
}: PipelineFunnelProps) {
  const stages: FunnelStage[] = [
    {
      label: 'Emails Sent',
      total: emailsSent,
      attributed: emailsSent, // All emails are "ours"
      icon: <Mail className="h-5 w-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Positive Replies',
      total: positiveReplies,
      attributed: attributedReplies,
      icon: <MessageSquare className="h-5 w-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Sign-ups',
      total: signUps,
      attributed: attributedSignUps,
      icon: <UserPlus className="h-5 w-5" />,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500/10',
    },
    {
      label: 'Meetings',
      total: meetings,
      attributed: attributedMeetings,
      icon: <Calendar className="h-5 w-5" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Paying',
      total: paying,
      attributed: attributedPaying,
      icon: <DollarSign className="h-5 w-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
  ];

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getAttributionPercentage = (attributed: number, total: number): string => {
    if (total === 0) return '—';
    const pct = Math.round((attributed / total) * 100);
    return `${pct}%`;
  };

  const getPercentageColor = (attributed: number, total: number): string => {
    if (total === 0) return 'text-muted-foreground';
    const pct = (attributed / total) * 100;
    if (pct >= 50) return 'text-green-600';
    if (pct >= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="w-full">
      {/* Desktop: Horizontal funnel */}
      <div className="hidden md:flex items-center justify-between gap-2">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex items-center flex-1">
            <div
              className={cn(
                'flex-1 rounded-lg p-4 text-center transition-all hover:shadow-md',
                stage.bgColor
              )}
            >
              <div className={cn('flex justify-center mb-2', stage.color)}>
                {stage.icon}
              </div>
              <div className="text-2xl font-bold">{formatNumber(stage.total)}</div>
              <div className="text-xs text-muted-foreground mb-1">{stage.label}</div>
              {index > 0 && (
                <div
                  className={cn(
                    'text-sm font-semibold',
                    getPercentageColor(stage.attributed, stage.total)
                  )}
                >
                  {getAttributionPercentage(stage.attributed, stage.total)} ours
                </div>
              )}
            </div>
            {index < stages.length - 1 && (
              <ArrowRight className="h-5 w-5 text-muted-foreground/50 mx-1 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Mobile: Vertical funnel */}
      <div className="md:hidden space-y-3">
        {stages.map((stage, index) => (
          <div key={stage.label} className="relative">
            <div
              className={cn(
                'rounded-lg p-4 flex items-center gap-4',
                stage.bgColor
              )}
            >
              <div className={cn('flex-shrink-0', stage.color)}>{stage.icon}</div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">{stage.label}</div>
                <div className="text-xl font-bold">{formatNumber(stage.total)}</div>
              </div>
              {index > 0 && (
                <div
                  className={cn(
                    'text-sm font-semibold',
                    getPercentageColor(stage.attributed, stage.total)
                  )}
                >
                  {getAttributionPercentage(stage.attributed, stage.total)} ours
                </div>
              )}
            </div>
            {index < stages.length - 1 && (
              <div className="flex justify-center -my-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


