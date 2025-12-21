'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Flag,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { CommentThread } from './comment-thread';
import type { Task, TaskStatus } from '@/db/attribution/types';

interface DisputeSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  domain: {
    id: string;
    domain: string;
    status: string;
    has_positive_reply?: boolean;
    has_sign_up?: boolean;
    has_meeting_booked?: boolean;
    has_paying_customer?: boolean;
  } | null;
  slug: string;
  uuid: string;
  onSuccess?: () => void;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ReactNode; color: string }> = {
  OPEN: {
    label: 'Open',
    icon: <Clock className="h-4 w-4" />,
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200',
  },
  PENDING_INFO: {
    label: 'Pending Info',
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200',
  },
  APPROVED: {
    label: 'Approved',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200',
  },
  REJECTED: {
    label: 'Rejected',
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200',
  },
};

export function DisputeSidePanel({
  isOpen,
  onClose,
  domain,
  slug,
  uuid,
  onSuccess,
}: DisputeSidePanelProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'submit'>('view');

  // Submit form state
  const [reason, setReason] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch task when panel opens
  useEffect(() => {
    if (isOpen && domain) {
      fetchTask();
    }
  }, [isOpen, domain?.id]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setTask(null);
      setMode('view');
      setReason('');
      setEvidenceLink('');
      setSelectedEvents(new Set());
      setError(null);
    }
  }, [isOpen]);

  const fetchTask = async () => {
    if (!domain) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/domains/${domain.id}/task`
      );
      if (response.ok) {
        const data = await response.json();
        setTask(data.task || null);
        setMode(data.task ? 'view' : 'submit');
      } else {
        setMode('submit');
      }
    } catch (error) {
      console.error('Failed to fetch task:', error);
      setMode('submit');
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!domain || !reason.trim()) {
      setError('Please provide a reason for your dispute.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/domains/${domain.id}/dispute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // submittedBy will come from auth session in production
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

      toast.success('Dispute submitted successfully');
      onSuccess?.();
      
      // Refresh to show the new dispute
      fetchTask();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!domain) return null;

  const isResolved = task?.status === 'APPROVED' || task?.status === 'REJECTED';

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-orange-500" />
            <SheetTitle>Dispute</SheetTitle>
          </div>
          <SheetDescription className="flex items-center gap-2">
            <span className="font-medium">{domain.domain}</span>
            {task && (
              <Badge variant="outline" className={STATUS_CONFIG[task.status].color}>
                {STATUS_CONFIG[task.status].icon}
                <span className="ml-1">{STATUS_CONFIG[task.status].label}</span>
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mode === 'view' && task ? (
              // View existing dispute
              <div className="space-y-6">
                {/* Dispute Details */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Dispute Reason</h4>
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    {task.description || 'No description provided'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted {formatDate(task.submitted_at)}
                    {task.submitted_by && task.submitted_by !== 'client-user@placeholder' && (
                      <span> by {task.submitted_by}</span>
                    )}
                  </p>
                </div>

                {/* Resolution Notes (if resolved) */}
                {task.resolution_notes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Resolution Notes</h4>
                    <div className="bg-muted rounded-lg p-3 text-sm">
                      {task.resolution_notes}
                    </div>
                    {task.resolved_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Resolved {formatDate(task.resolved_at)}
                      </p>
                    )}
                  </div>
                )}

                {/* Status Info */}
                {task.status === 'PENDING_INFO' && (
                  <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                      Additional information has been requested. Please check the
                      correspondence below and respond.
                    </AlertDescription>
                  </Alert>
                )}

                {isResolved && (
                  <Alert className={task.status === 'APPROVED' 
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800'
                  }>
                    {task.status === 'APPROVED' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className={`text-sm ${
                      task.status === 'APPROVED' 
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {task.status === 'APPROVED'
                        ? 'This dispute has been approved. The attribution has been removed from your billable events.'
                        : 'This dispute has been rejected. The attribution remains billable.'}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Allow re-submitting a dispute after rejection */}
                {task.status === 'REJECTED' && (
                  <Button
                    variant="outline"
                    className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                    onClick={() => {
                      setMode('submit');
                      setReason('');
                      setEvidenceLink('');
                      setSelectedEvents(new Set());
                      setError(null);
                    }}
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Submit New Dispute
                  </Button>
                )}

                <Separator />

                {/* Comments */}
                <CommentThread
                  taskId={task.id}
                  slug={slug}
                  uuid={uuid}
                  authorType="CLIENT"
                  isResolved={isResolved}
                />

                {/* Link to tasks page */}
                <div className="pt-4">
                  <a
                    href={`/client/${slug}/${uuid}/tasks`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View all tasks
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              // Submit new dispute
              <div className="space-y-4">
                {/* Event Type Selection */}
                <div className="space-y-3">
                  <Label>Which events are you disputing?</Label>
                  <div className="space-y-2">
                    {domain.has_positive_reply && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="panel-dispute-reply"
                          checked={selectedEvents.has('positive_reply')}
                          onCheckedChange={() => toggleEvent('positive_reply')}
                        />
                        <label htmlFor="panel-dispute-reply" className="text-sm">
                          Positive Reply
                        </label>
                      </div>
                    )}
                    {domain.has_sign_up && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="panel-dispute-signup"
                          checked={selectedEvents.has('sign_up')}
                          onCheckedChange={() => toggleEvent('sign_up')}
                        />
                        <label htmlFor="panel-dispute-signup" className="text-sm">
                          Website Sign-Up
                        </label>
                      </div>
                    )}
                    {domain.has_meeting_booked && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="panel-dispute-meeting"
                          checked={selectedEvents.has('meeting_booked')}
                          onCheckedChange={() => toggleEvent('meeting_booked')}
                        />
                        <label htmlFor="panel-dispute-meeting" className="text-sm">
                          Meeting Booked
                        </label>
                      </div>
                    )}
                    {domain.has_paying_customer && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="panel-dispute-paying"
                          checked={selectedEvents.has('paying_customer')}
                          onCheckedChange={() => toggleEvent('paying_customer')}
                        />
                        <label htmlFor="panel-dispute-paying" className="text-sm">
                          Paying Customer
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="panel-reason">
                    Reason for dispute <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="panel-reason"
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
                  <Label htmlFor="panel-evidence">Evidence link (optional)</Label>
                  <Input
                    id="panel-evidence"
                    type="url"
                    placeholder="https://..."
                    value={evidenceLink}
                    onChange={(e) => setEvidenceLink(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Link to CRM record, screenshot, or other supporting documentation
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !reason.trim()}
                  className="w-full bg-orange-600 hover:bg-orange-700"
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
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

