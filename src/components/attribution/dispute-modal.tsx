'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Flag, AlertTriangle, Loader2 } from 'lucide-react';
import { DefinitionTooltip } from '@/components/ui/definition-tooltip';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainId: string;
  domainName: string;
  slug: string;
  uuid: string;
  hasPositiveReply?: boolean;
  hasSignUp?: boolean;
  hasMeetingBooked?: boolean;
  hasPayingCustomer?: boolean;
  onSuccess?: () => void;
}

export function DisputeModal({
  isOpen,
  onClose,
  domainId,
  domainName,
  slug,
  uuid,
  hasPositiveReply = false,
  hasSignUp = false,
  hasMeetingBooked = false,
  hasPayingCustomer = false,
  onSuccess,
}: DisputeModalProps) {
  const [reason, setReason] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for your dispute.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/domains/${domainId}/dispute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: reason.trim(),
            evidenceLink: evidenceLink.trim() || null,
            eventTypes: Array.from(selectedEvents),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit dispute');
      }

      // Success
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setEvidenceLink('');
    setSelectedEvents(new Set());
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-orange-500" />
            <DefinitionTooltip term="dispute">Dispute Attribution</DefinitionTooltip>
          </DialogTitle>
          <DialogDescription>
            Challenge the attribution for <strong>{domainName}</strong>. Per Section 4.5
            of the agreement, please provide grounds and supporting evidence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Event Type Selection */}
          <div className="space-y-3">
            <Label>Which events are you disputing?</Label>
            <div className="space-y-2">
              {hasPositiveReply && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dispute-reply"
                    checked={selectedEvents.has('positive_reply')}
                    onCheckedChange={() => toggleEvent('positive_reply')}
                  />
                  <label htmlFor="dispute-reply" className="text-sm">
                    Positive Reply
                  </label>
                </div>
              )}
              {hasSignUp && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dispute-signup"
                    checked={selectedEvents.has('sign_up')}
                    onCheckedChange={() => toggleEvent('sign_up')}
                  />
                  <label htmlFor="dispute-signup" className="text-sm">
                    Website Sign-Up
                  </label>
                </div>
              )}
              {hasMeetingBooked && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dispute-meeting"
                    checked={selectedEvents.has('meeting_booked')}
                    onCheckedChange={() => toggleEvent('meeting_booked')}
                  />
                  <label htmlFor="dispute-meeting" className="text-sm">
                    Meeting Booked
                  </label>
                </div>
              )}
              {hasPayingCustomer && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dispute-paying"
                    checked={selectedEvents.has('paying_customer')}
                    onCheckedChange={() => toggleEvent('paying_customer')}
                  />
                  <label htmlFor="dispute-paying" className="text-sm">
                    Paying Customer
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for dispute <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you believe this attribution is incorrect..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Examples: &quot;This lead came from organic search&quot;, &quot;This customer was
              already in our pipeline before your outreach&quot;
            </p>
          </div>

          {/* Evidence Link */}
          <div className="space-y-2">
            <Label htmlFor="evidence">Evidence link (optional)</Label>
            <Input
              id="evidence"
              type="url"
              placeholder="https://..."
              value={evidenceLink}
              onChange={(e) => setEvidenceLink(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Link to CRM record, screenshot, or other supporting documentation
            </p>
          </div>

          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Disputes must be submitted within 30 days of invoice. Our team will review
              your dispute and respond within 5 business days.
            </AlertDescription>
          </Alert>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Flag className="h-4 w-4 mr-2" />
                Submit Dispute
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


