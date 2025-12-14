'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AccountsTable, type AccountDomain } from './accounts-table';
import { DisputeModal } from './dispute-modal';
import { AttributeModal } from './attribute-modal';
import { AddEventModal } from './add-event-modal';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';

interface ClientDashboardWrapperProps {
  domains: AccountDomain[];
  totalCount: number;
  slug: string;
  uuid: string;
  attributionWindowDays: number;
  revShareRate: number;
}

export function ClientDashboardWrapper({
  domains,
  totalCount,
  slug,
  uuid,
  attributionWindowDays,
  revShareRate,
}: ClientDashboardWrapperProps) {
  const router = useRouter();
  
  // Modal state
  const [disputeModal, setDisputeModal] = useState<{
    isOpen: boolean;
    domainId: string;
    domainName: string;
    domain?: AccountDomain;
  }>({ isOpen: false, domainId: '', domainName: '' });

  const [attributeModal, setAttributeModal] = useState<{
    isOpen: boolean;
    domainId: string;
    domainName: string;
    currentStatus: 'outside_window' | 'unattributed';
  }>({ isOpen: false, domainId: '', domainName: '', currentStatus: 'unattributed' });

  const [addEventModal, setAddEventModal] = useState(false);

  // Find domain by ID
  const findDomain = useCallback(
    (domainId: string) => domains.find((d) => d.id === domainId),
    [domains]
  );

  // Handle dispute
  const handleDispute = useCallback(
    (domainId: string) => {
      const domain = findDomain(domainId);
      if (domain) {
        setDisputeModal({
          isOpen: true,
          domainId,
          domainName: domain.domain,
          domain,
        });
      }
    },
    [findDomain]
  );

  // Handle attribute (manually attribute an outside-window or unattributed domain)
  const handleAttribute = useCallback(
    (domainId: string) => {
      const domain = findDomain(domainId);
      if (domain) {
        const currentStatus =
          domain.is_within_window === false &&
          (domain.match_type === 'HARD_MATCH' || domain.match_type === 'SOFT_MATCH')
            ? 'outside_window'
            : 'unattributed';
        setAttributeModal({
          isOpen: true,
          domainId,
          domainName: domain.domain,
          currentStatus,
        });
      }
    },
    [findDomain]
  );

  // Handle success (refresh data)
  const handleSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    // Build CSV content
    const headers = [
      'Domain',
      'Status',
      'Match Type',
      'Has Reply',
      'Has Sign-up',
      'Has Meeting',
      'Has Paying',
      'First Email',
      'First Event',
    ];

    const rows = domains.map((d) => [
      d.domain,
      d.status,
      d.match_type || 'NONE',
      d.has_positive_reply ? 'Yes' : 'No',
      d.has_sign_up ? 'Yes' : 'No',
      d.has_meeting_booked ? 'Yes' : 'No',
      d.has_paying_customer ? 'Yes' : 'No',
      d.first_email_sent_at ? new Date(d.first_email_sent_at).toISOString() : '',
      d.first_event_at ? new Date(d.first_event_at).toISOString() : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attribution-${slug}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [domains, slug]);

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button size="sm" onClick={() => setAddEventModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {/* Accounts Table */}
      <AccountsTable
        domains={domains}
        totalCount={totalCount}
        slug={slug}
        uuid={uuid}
        attributionWindowDays={attributionWindowDays}
        onDispute={handleDispute}
        onAttribute={handleAttribute}
      />

      {/* Modals */}
      <DisputeModal
        isOpen={disputeModal.isOpen}
        onClose={() => setDisputeModal({ isOpen: false, domainId: '', domainName: '' })}
        domainId={disputeModal.domainId}
        domainName={disputeModal.domainName}
        slug={slug}
        uuid={uuid}
        hasPositiveReply={disputeModal.domain?.has_positive_reply}
        hasSignUp={disputeModal.domain?.has_sign_up}
        hasMeetingBooked={disputeModal.domain?.has_meeting_booked}
        hasPayingCustomer={disputeModal.domain?.has_paying_customer}
        onSuccess={handleSuccess}
      />

      <AttributeModal
        isOpen={attributeModal.isOpen}
        onClose={() =>
          setAttributeModal({ isOpen: false, domainId: '', domainName: '', currentStatus: 'unattributed' })
        }
        domainId={attributeModal.domainId}
        domainName={attributeModal.domainName}
        slug={slug}
        uuid={uuid}
        revShareRate={revShareRate}
        currentStatus={attributeModal.currentStatus}
        onSuccess={handleSuccess}
      />

      <AddEventModal
        isOpen={addEventModal}
        onClose={() => setAddEventModal(false)}
        slug={slug}
        uuid={uuid}
        revShareRate={revShareRate}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
