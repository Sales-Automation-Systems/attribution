'use client';

import React, { useState, useCallback, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AccountsTable, type AccountDomain } from './accounts-table';
import { AddEventModal } from './add-event-modal';
import { DisputeSidePanel } from '@/components/tasks/dispute-side-panel';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';

// #region agent log - GLOBAL ERROR HANDLER
if (typeof window !== 'undefined') {
  window.onerror = (msg, src, line, col, err) => {
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GLOBAL:window.onerror',message:'UNCAUGHT ERROR',data:{msg:String(msg),src,line,col,stack:err?.stack},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'CRASH'})}).catch(()=>{});
  };
  window.onunhandledrejection = (e) => {
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GLOBAL:unhandledrejection',message:'UNHANDLED PROMISE REJECTION',data:{reason:String(e.reason),stack:e.reason?.stack},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'CRASH'})}).catch(()=>{});
  };
}
// #endregion

// #region React Error Boundary to catch render crashes
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DashboardErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ErrorBoundary:getDerivedStateFromError',message:'REACT RENDER ERROR CAUGHT',data:{errorMessage:error.message,errorName:error.name,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'CRASH'})}).catch(()=>{});
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ErrorBoundary:componentDidCatch',message:'REACT ERROR WITH COMPONENT STACK',data:{errorMessage:error.message,componentStack:errorInfo.componentStack},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'CRASH'})}).catch(()=>{});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 border border-red-400 rounded">
          <h2 className="text-red-700 font-bold">Something went wrong</h2>
          <pre className="text-xs text-red-600 mt-2 overflow-auto">
            {this.state.error?.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
// #endregion

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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client-dashboard-wrapper.tsx:render',message:'ClientDashboardWrapper RENDER v2',data:{domainsCount:domains?.length,totalCount,slug,uuid,version:'v2-error-boundary'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
  // #endregion

  const router = useRouter();
  
  const [addEventModal, setAddEventModal] = useState(false);

  // Side panel state for disputes
  const [disputePanel, setDisputePanel] = useState<{
    isOpen: boolean;
    domain: AccountDomain | null;
  }>({ isOpen: false, domain: null });

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

      {/* Accounts Table - wrapped in error boundary */}
      <DashboardErrorBoundary>
        <AccountsTable
          domains={domains}
          totalCount={totalCount}
          slug={slug}
          uuid={uuid}
          attributionWindowDays={attributionWindowDays}
          onOpenDisputePanel={handleOpenDisputePanel}
        />
      </DashboardErrorBoundary>

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
