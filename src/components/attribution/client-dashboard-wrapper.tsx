'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AccountsTable, type AccountDomain } from './accounts-table';
import { AddEventModal } from './add-event-modal';
import { DisputeSidePanel } from '@/components/tasks/dispute-side-panel';
import { AttributeSidePanel } from '@/components/tasks/attribute-side-panel';
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
  
  const [addEventModal, setAddEventModal] = useState(false);

  // Side panel state for disputes
  const [disputePanel, setDisputePanel] = useState<{
    isOpen: boolean;
    domain: AccountDomain | null;
  }>({ isOpen: false, domain: null });

  // Side panel state for attribution
  const [attributePanel, setAttributePanel] = useState<{
    isOpen: boolean;
    domain: AccountDomain | null;
  }>({ isOpen: false, domain: null });

  // Find domain by ID
  const findDomain = useCallback(
    (domainId: string) => domains.find((d) => d.id === domainId),
    [domains]
  );

  // Handle attribute (manually attribute an outside-window or unattributed domain)
  const handleAttribute = useCallback(
    (domainId: string) => {
      const domain = findDomain(domainId);
      if (domain) {
        setAttributePanel({ isOpen: true, domain });
      }
    },
    [findDomain]
  );

  // Handle opening the dispute side panel
  const handleOpenDisputePanel = useCallback(
    (domain: AccountDomain) => {
      setDisputePanel({ isOpen: true, domain });
    },
    []
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
    <div className="space-y-3">
      {/* Header Row - Title, Description, and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">All Accounts</h2>
          <span className="text-sm text-muted-foreground">· Click any row for full history</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setAddEventModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Accounts Table */}
      <AccountsTable
        domains={domains}
        totalCount={totalCount}
        slug={slug}
        uuid={uuid}
        attributionWindowDays={attributionWindowDays}
        onAttribute={handleAttribute}
        onOpenDisputePanel={handleOpenDisputePanel}
      />

      {/* Attribute Side Panel */}
      <AttributeSidePanel
        isOpen={attributePanel.isOpen}
        onClose={() => setAttributePanel({ isOpen: false, domain: null })}
        domain={attributePanel.domain}
        slug={slug}
        uuid={uuid}
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

      {/* Dispute Side Panel */}
      <DisputeSidePanel
        isOpen={disputePanel.isOpen}
        onClose={() => setDisputePanel({ isOpen: false, domain: null })}
        domain={disputePanel.domain}
        slug={slug}
        uuid={uuid}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
