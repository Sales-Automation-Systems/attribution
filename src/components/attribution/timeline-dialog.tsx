'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  MessageSquare,
  UserPlus,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  CircleSlash,
  Flag,
  ArrowUpCircle,
} from 'lucide-react';
import { AccountTimeline } from './account-timeline';
import { DefinitionTooltip, SimpleTooltip } from '@/components/ui/definition-tooltip';
import type { DomainStatus, MatchType } from '@/db/attribution/types';

export interface TimelineDomain {
  id: string;
  domain: string;
  first_email_sent_at: Date | null;
  first_event_at: Date | null;
  has_positive_reply: boolean;
  has_sign_up: boolean;
  has_meeting_booked: boolean;
  has_paying_customer: boolean;
  is_within_window: boolean;
  match_type: MatchType;
  status: DomainStatus;
}

interface TimelineDialogProps {
  domain: TimelineDomain | null;
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  uuid: string;
}

// Map domain status to filter types for consistent display
function getStatusType(domain: TimelineDomain): 'attributed' | 'outside_window' | 'unattributed' | 'disputed' | 'client_attributed' {
  if (domain.status === 'CLIENT_PROMOTED') return 'client_attributed';
  if (domain.status === 'DISPUTED') return 'disputed';
  if (domain.status === 'OUTSIDE_WINDOW' || (!domain.is_within_window && domain.match_type !== 'NO_MATCH' && domain.match_type !== null)) return 'outside_window';
  if (domain.status === 'UNATTRIBUTED' || domain.match_type === 'NO_MATCH' || domain.match_type === null) return 'unattributed';
  return 'attributed';
}

export function TimelineDialog({ domain, isOpen, onClose, slug, uuid }: TimelineDialogProps) {
  if (!domain) return null;

  const statusType = getStatusType(domain);

  const renderStatusBadge = () => {
    switch (statusType) {
      case 'attributed':
        return (
          <DefinitionTooltip term="attributed" showUnderline={false}>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Attributed
            </Badge>
          </DefinitionTooltip>
        );
      case 'outside_window':
        return (
          <DefinitionTooltip term="outsideWindow" showUnderline={false}>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
              <Clock className="h-3 w-3 mr-1" />
              Outside Window
            </Badge>
          </DefinitionTooltip>
        );
      case 'unattributed':
        return (
          <DefinitionTooltip term="unattributed" showUnderline={false}>
            <Badge variant="outline" className="bg-gray-500/10 text-gray-600 dark:text-gray-400">
              <CircleSlash className="h-3 w-3 mr-1" />
              Unattributed
            </Badge>
          </DefinitionTooltip>
        );
      case 'disputed':
        return (
          <DefinitionTooltip term="disputed" showUnderline={false}>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
              <Flag className="h-3 w-3 mr-1" />
              Disputed
            </Badge>
          </DefinitionTooltip>
        );
      case 'client_attributed':
        return (
          <DefinitionTooltip term="clientAttributed" showUnderline={false}>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
              <ArrowUpCircle className="h-3 w-3 mr-1" />
              Client-Attributed
            </Badge>
          </DefinitionTooltip>
        );
    }
  };

  // #region agent log
  if (typeof window !== 'undefined' && isOpen) {
    setTimeout(() => {
      const dialog = document.querySelector('[data-slot="dialog-content"]');
      if (dialog) {
        const styles = window.getComputedStyle(dialog);
        fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline-dialog.tsx:113',message:'Dialog computed styles',data:{width:styles.width,maxWidth:styles.maxWidth,gap:styles.gap,rowGap:styles.rowGap},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-1',hypothesisId:'A,B,C'})}).catch(()=>{});
      }
    }, 500);
  }
  // #endregion

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] md:w-[calc(100vw-8rem)] lg:w-[calc(100vw-16rem)] max-w-none sm:max-w-none md:max-w-none lg:max-w-none max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 bg-background">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                {domain.domain}
                <a
                  href={`https://${domain.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                Full event history and attribution details
              </DialogDescription>
            </div>
            
            {/* Status and Match Type Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {renderStatusBadge()}
              {domain.match_type && domain.match_type !== 'NO_MATCH' && (
                <DefinitionTooltip
                  term={domain.match_type === 'HARD_MATCH' ? 'hardMatch' : 'softMatch'}
                  showUnderline={false}
                >
                  <Badge variant="secondary">
                    {domain.match_type === 'HARD_MATCH' ? 'Focused Match' : 'Company Match'}
                  </Badge>
                </DefinitionTooltip>
              )}
            </div>
          </div>

          {/* Event Type Icons */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground mr-1">Events:</span>
            {domain.has_positive_reply && (
              <SimpleTooltip content="Positive Reply">
                <Badge variant="outline" className="bg-purple-500/10 text-xs px-2 py-0.5">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Reply
                </Badge>
              </SimpleTooltip>
            )}
            {domain.has_sign_up && (
              <SimpleTooltip content="Website Sign-Up">
                <Badge variant="outline" className="bg-blue-500/10 text-xs px-2 py-0.5">
                  <UserPlus className="h-3 w-3 mr-1" />
                  Sign-Up
                </Badge>
              </SimpleTooltip>
            )}
            {domain.has_meeting_booked && (
              <SimpleTooltip content="Meeting Booked">
                <Badge variant="outline" className="bg-yellow-500/10 text-xs px-2 py-0.5">
                  <Calendar className="h-3 w-3 mr-1" />
                  Meeting
                </Badge>
              </SimpleTooltip>
            )}
            {domain.has_paying_customer && (
              <SimpleTooltip content="Paying Customer">
                <Badge className="bg-green-500 text-xs px-2 py-0.5">
                  <DollarSign className="h-3 w-3 mr-1" />
                  Paying
                </Badge>
              </SimpleTooltip>
            )}
            {!domain.has_positive_reply && !domain.has_sign_up && !domain.has_meeting_booked && !domain.has_paying_customer && (
              <span className="text-xs text-muted-foreground italic">No events recorded</span>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Timeline Body */}
        <div className="flex-1 overflow-y-auto bg-background isolate">
          <div className="px-6 py-4">
            <AccountTimeline
              domainId={domain.id}
              slug={slug}
              uuid={uuid}
              isOpen={isOpen}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

