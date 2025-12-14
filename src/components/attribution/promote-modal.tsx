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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowUpCircle, AlertTriangle, Loader2, DollarSign } from 'lucide-react';
import { DefinitionTooltip } from '@/components/ui/definition-tooltip';

interface PromoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainId: string;
  domainName: string;
  slug: string;
  uuid: string;
  revShareRate: number;
  currentStatus: 'outside_window' | 'unattributed';
  onSuccess?: () => void;
}

export function PromoteModal({
  isOpen,
  onClose,
  domainId,
  domainName,
  slug,
  uuid,
  revShareRate,
  currentStatus,
  onSuccess,
}: PromoteModalProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async () => {
    if (!confirmed) {
      setError('Please confirm that you understand this will be billable.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/domains/${domainId}/promote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: notes.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to promote domain');
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
    setNotes('');
    setError(null);
    setConfirmed(false);
    onClose();
  };

  const statusLabel = currentStatus === 'outside_window' ? 'Outside Window' : 'Unattributed';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-blue-500" />
            <DefinitionTooltip term="promote">Attribute This Account</DefinitionTooltip>
          </DialogTitle>
          <DialogDescription>
            Add <strong>{domainName}</strong> to your billable attribution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Status</span>
              <span className="font-medium">{statusLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">New Status</span>
              <span className="font-medium text-blue-600">Client-Attributed</span>
            </div>
          </div>

          {/* Billing Warning */}
          <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800">
            <DollarSign className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
              <strong>This will be billable.</strong> Attributing this account will add it
              to your billable events at your current revenue share rate of{' '}
              <strong>{(revShareRate * 100).toFixed(0)}%</strong>.
            </AlertDescription>
          </Alert>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about why you're attributing this account..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start space-x-3 p-3 rounded-lg border">
            <input
              type="checkbox"
              id="confirm-promote"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="confirm-promote" className="text-sm">
              I understand that attributing this account will make it billable at my
              current revenue share rate, and this action cannot be easily undone.
            </label>
          </div>

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
            disabled={isSubmitting || !confirmed}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Attributing...
              </>
            ) : (
              <>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Confirm Attribution
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

