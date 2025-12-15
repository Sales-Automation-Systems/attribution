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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Loader2, DollarSign, Calendar, UserPlus } from 'lucide-react';
import { DefinitionTooltip } from '@/components/ui/definition-tooltip';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  uuid: string;
  revShareRate: number;
  onSuccess?: () => void;
}

type EventType = 'sign_up' | 'meeting_booked' | 'paying_customer';

const EVENT_TYPE_INFO: Record<EventType, { label: string; icon: typeof UserPlus; color: string }> = {
  sign_up: { label: 'Website Sign-Up', icon: UserPlus, color: 'text-blue-600' },
  meeting_booked: { label: 'Meeting Booked', icon: Calendar, color: 'text-yellow-600' },
  paying_customer: { label: 'Paying Customer', icon: DollarSign, color: 'text-green-600' },
};

export function AddEventModal({
  isOpen,
  onClose,
  slug,
  uuid,
  revShareRate,
  onSuccess,
}: AddEventModalProps) {
  const [domain, setDomain] = useState('');
  const [eventType, setEventType] = useState<EventType | ''>('');
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // Validation
    if (!domain.trim()) {
      setError('Domain/Company is required');
      return;
    }
    if (!eventType) {
      setError('Event type is required');
      return;
    }
    if (!eventDate) {
      setError('Event date is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/clients/${slug}/${uuid}/events/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // submittedBy will come from auth session in production
          domain: domain.trim().toLowerCase(),
          eventType,
          eventDate: eventDate ? format(eventDate, 'yyyy-MM-dd') : null,
          contactEmail: contactEmail.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.details || data.error || 'Failed to add event');
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
    setDomain('');
    setEventType('');
    setEventDate(undefined);
    setContactEmail('');
    setNotes('');
    setError(null);
    onClose();
  };

  // Clean domain input (remove protocol, www, etc.)
  const cleanDomain = (input: string) => {
    let cleaned = input.toLowerCase().trim();
    cleaned = cleaned.replace(/^https?:\/\//, '');
    cleaned = cleaned.replace(/^www\./, '');
    cleaned = cleaned.split('/')[0]; // Remove path
    return cleaned;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Event Manually
          </DialogTitle>
          <DialogDescription>
            Manually log an event that will be added to your attribution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Domain */}
          <div className="space-y-2">
            <Label htmlFor="domain">
              Domain / Company <span className="text-red-500">*</span>
            </Label>
            <Input
              id="domain"
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(cleanDomain(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Enter the company domain (e.g., acme.com)
            </p>
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label>
              Event Type <span className="text-red-500">*</span>
            </Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sign_up">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-blue-600" />
                    <DefinitionTooltip term="websiteSignUp" showUnderline={false}>
                      Website Sign-Up
                    </DefinitionTooltip>
                  </div>
                </SelectItem>
                <SelectItem value="meeting_booked">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-yellow-600" />
                    <DefinitionTooltip term="meetingBooked" showUnderline={false}>
                      Meeting Booked
                    </DefinitionTooltip>
                  </div>
                </SelectItem>
                <SelectItem value="paying_customer">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <DefinitionTooltip term="payingCustomer" showUnderline={false}>
                      Paying Customer
                    </DefinitionTooltip>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Event Date */}
          <div className="space-y-2">
            <Label htmlFor="eventDate">
              Event Date <span className="text-red-500">*</span>
            </Label>
            <DatePicker
              value={eventDate}
              onChange={setEventDate}
              placeholder="Select date (YYYY-MM-DD)"
            />
          </div>

          {/* Contact Email (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email (optional)</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="contact@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this event..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px]"
            />
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

