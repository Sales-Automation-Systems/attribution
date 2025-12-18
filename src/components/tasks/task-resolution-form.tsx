'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TaskResolutionFormProps {
  taskId: string;
  onSuccess?: () => void;
}

type ResolutionAction = 'APPROVED' | 'REJECTED' | 'PENDING_INFO';

export function TaskResolutionForm({ taskId, onSuccess }: TaskResolutionFormProps) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: ResolutionAction | null;
  }>({ isOpen: false, action: null });

  const handleAction = (action: ResolutionAction) => {
    setConfirmDialog({ isOpen: true, action });
  };

  const handleConfirm = async () => {
    if (!confirmDialog.action) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: confirmDialog.action,
          notes: notes.trim() || undefined,
          resolvedBy: 'Agency', // TODO: Use actual user name when auth is added
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resolve task');
      }

      const actionLabel =
        confirmDialog.action === 'APPROVED'
          ? 'approved'
          : confirmDialog.action === 'REJECTED'
          ? 'rejected'
          : 'marked as pending info';

      toast.success(`Dispute ${actionLabel}`);
      setConfirmDialog({ isOpen: false, action: null });
      setNotes('');
      onSuccess?.();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const getDialogContent = () => {
    switch (confirmDialog.action) {
      case 'APPROVED':
        return {
          title: 'Approve Dispute',
          description:
            'This will remove the attribution from billable events. The client will no longer be charged for this lead.',
          actionLabel: 'Approve Dispute',
          actionClass: 'bg-green-600 hover:bg-green-700',
        };
      case 'REJECTED':
        return {
          title: 'Reject Dispute',
          description:
            'This will keep the attribution as billable. The client will continue to be charged for this lead.',
          actionLabel: 'Reject Dispute',
          actionClass: 'bg-red-600 hover:bg-red-700',
        };
      case 'PENDING_INFO':
        return {
          title: 'Request More Information',
          description:
            'Mark this dispute as pending additional information from the client. Add a note explaining what information you need.',
          actionLabel: 'Request Info',
          actionClass: 'bg-amber-600 hover:bg-amber-700',
        };
      default:
        return {
          title: 'Resolve Dispute',
          description: '',
          actionLabel: 'Confirm',
          actionClass: '',
        };
    }
  };

  const dialogContent = getDialogContent();

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <h4 className="text-sm font-medium">Resolution Actions</h4>

      {/* Notes Field */}
      <div className="space-y-2">
        <Label htmlFor="resolution-notes">Notes (optional)</Label>
        <Textarea
          id="resolution-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about your decision..."
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction('APPROVED')}
          className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Approve
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction('REJECTED')}
          className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <XCircle className="h-4 w-4 mr-1.5" />
          Reject
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction('PENDING_INFO')}
          className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950"
        >
          <AlertCircle className="h-4 w-4 mr-1.5" />
          Request Info
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.isOpen}
        onOpenChange={(isOpen) => setConfirmDialog({ isOpen, action: confirmDialog.action })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {notes.trim() && (
            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">Your notes:</p>
              {notes}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={submitting}
              className={dialogContent.actionClass}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                dialogContent.actionLabel
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


