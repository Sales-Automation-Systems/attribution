'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Plus,
  Loader2,
  Search,
  DollarSign,
  Calendar,
  UserPlus,
  MessageSquare,
  Mail,
  CheckCircle2,
  Clock,
  CircleSlash,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

interface AddDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  uuid: string;
  onSuccess?: () => void;
}

interface SearchResult {
  id: string;
  domain: string;
  first_email_sent_at: string | null;
  first_event_at: string | null;
  has_positive_reply: boolean;
  has_sign_up: boolean;
  has_meeting_booked: boolean;
  has_paying_customer: boolean;
  is_within_window: boolean;
  match_type: string | null;
  status: string;
}

interface DomainEvent {
  id: string;
  event_source: string;
  event_time: string;
  email: string | null;
}

export function AddDomainModal({
  isOpen,
  onClose,
  slug,
  uuid,
  onSuccess,
}: AddDomainModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<SearchResult | null>(null);
  const [domainEvents, setDomainEvents] = useState<DomainEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [billingStartDate, setBillingStartDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search for domains
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/domains?search=${encodeURIComponent(searchQuery)}&limit=10`
      );
      if (!response.ok) throw new Error('Failed to search domains');
      const data = await response.json();
      setSearchResults(data.domains || []);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, slug, uuid]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Load domain events when selected
  useEffect(() => {
    if (!selectedDomain) {
      setDomainEvents([]);
      return;
    }

    const loadEvents = async () => {
      setIsLoadingEvents(true);
      try {
        const response = await fetch(
          `/api/clients/${slug}/${uuid}/domains/${selectedDomain.id}/timeline`
        );
        if (!response.ok) throw new Error('Failed to load events');
        const data = await response.json();
        setDomainEvents(data.events || []);
      } catch (err) {
        console.error('Failed to load events:', err);
        setDomainEvents([]);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    loadEvents();
  }, [selectedDomain, slug, uuid]);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedDomain) {
      setError('Please select a domain');
      return;
    }
    if (!billingStartDate) {
      setError('Please select a billing start date');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/reconciliation/add-domain`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domainId: selectedDomain.id,
            billingStartDate: format(billingStartDate, 'yyyy-MM-dd'),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add domain');
      }

      // Show success with details about which periods were added
      const periodsAdded = data.periodsAdded?.length || 0;
      const periodNames = data.periodsAdded?.map((p: { periodName: string }) => p.periodName).join(', ') || '';
      setSuccessMessage(`Added to ${periodsAdded} period${periodsAdded !== 1 ? 's' : ''}: ${periodNames}`);
      
      // Call success callback after a short delay so user can see the message
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedDomain(null);
    setDomainEvents([]);
    setBillingStartDate(undefined);
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  const getStatusBadge = (domain: SearchResult) => {
    if (domain.status === 'CLIENT_PROMOTED') {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 text-xs">
          Manually Attributed
        </Badge>
      );
    }
    if (domain.status === 'DISPUTED') {
      return (
        <Badge variant="outline" className="bg-orange-500/10 text-orange-700 text-xs">
          Disputed
        </Badge>
      );
    }
    if (domain.is_within_window && domain.match_type !== 'NO_MATCH') {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-700 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Attributed
        </Badge>
      );
    }
    if (!domain.is_within_window && domain.match_type !== 'NO_MATCH' && domain.match_type !== null) {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Outside Window
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-500/10 text-gray-600 text-xs">
        <CircleSlash className="h-3 w-3 mr-1" />
        Unattributed
      </Badge>
    );
  };

  const getEventIcon = (eventSource: string) => {
    switch (eventSource) {
      case 'EMAIL_SENT':
        return <Mail className="h-3 w-3 text-slate-500" />;
      case 'POSITIVE_REPLY':
        return <MessageSquare className="h-3 w-3 text-purple-500" />;
      case 'SIGN_UP':
        return <UserPlus className="h-3 w-3 text-blue-500" />;
      case 'MEETING_BOOKED':
        return <Calendar className="h-3 w-3 text-yellow-500" />;
      case 'PAYING_CUSTOMER':
        return <DollarSign className="h-3 w-3 text-green-500" />;
      default:
        return <CheckCircle2 className="h-3 w-3 text-gray-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Domain to Reconciliation
          </DialogTitle>
          <DialogDescription>
            Search for a domain and add it to all applicable billing periods based on the 12-month billing window.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search Domain</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by domain name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && !selectedDomain && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </Label>
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-2 space-y-1">
                  {searchResults.map((domain) => (
                    <button
                      key={domain.id}
                      onClick={() => setSelectedDomain(domain)}
                      className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-left transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{domain.domain}</span>
                        <a
                          href={`https://${domain.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        {domain.has_paying_customer && (
                          <DollarSign className="h-4 w-4 text-green-500" />
                        )}
                        {domain.has_meeting_booked && (
                          <Calendar className="h-4 w-4 text-yellow-500" />
                        )}
                        {domain.has_sign_up && (
                          <UserPlus className="h-4 w-4 text-blue-500" />
                        )}
                        {getStatusBadge(domain)}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Loading */}
          {isSearching && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Selected Domain Preview */}
          {selectedDomain && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{selectedDomain.domain}</span>
                  {getStatusBadge(selectedDomain)}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDomain(null)}
                >
                  Change
                </Button>
              </div>

              {/* Event Icons */}
              <div className="flex items-center gap-2">
                {selectedDomain.has_positive_reply && (
                  <Badge variant="outline" className="bg-purple-500/10">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Reply
                  </Badge>
                )}
                {selectedDomain.has_sign_up && (
                  <Badge variant="outline" className="bg-blue-500/10">
                    <UserPlus className="h-3 w-3 mr-1" />
                    Sign-up
                  </Badge>
                )}
                {selectedDomain.has_meeting_booked && (
                  <Badge variant="outline" className="bg-yellow-500/10">
                    <Calendar className="h-3 w-3 mr-1" />
                    Meeting
                  </Badge>
                )}
                {selectedDomain.has_paying_customer && (
                  <Badge className="bg-green-500">
                    <DollarSign className="h-3 w-3 mr-1" />
                    Paying
                  </Badge>
                )}
              </div>

              {/* Timeline Preview */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Event Timeline</Label>
                {isLoadingEvents ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : domainEvents.length > 0 ? (
                  <ScrollArea className="h-[120px]">
                    <div className="space-y-2">
                      {domainEvents.slice(0, 10).map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          {getEventIcon(event.event_source)}
                          <span className="text-muted-foreground">
                            {format(new Date(event.event_time), 'MMM d, yyyy')}
                          </span>
                          <span>{event.event_source.replace(/_/g, ' ')}</span>
                          {event.email && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              ({event.email})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground">No events found</p>
                )}
              </div>

              {/* Billing Start Date */}
              <div className="space-y-2">
                <Label>
                  Billing Start Date <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  value={billingStartDate}
                  onChange={setBillingStartDate}
                  placeholder="Select when billing starts for this lead"
                />
                <p className="text-xs text-muted-foreground">
                  The domain will be added to all billing periods within 12 months of this date.
                </p>
              </div>
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

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
            disabled={isSubmitting || !selectedDomain || !billingStartDate || !!successMessage}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : successMessage ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Added!
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add to All Periods
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

