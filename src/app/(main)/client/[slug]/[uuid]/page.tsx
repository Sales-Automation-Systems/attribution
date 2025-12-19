import { notFound } from 'next/navigation';
import {
  getClientConfigBySlugAndUuid,
  getAttributedDomains,
  getAttributedDomainsCount,
} from '@/db/attribution/queries';
import { Badge } from '@/components/ui/badge';
import { ClientDashboardWrapper } from '@/components/attribution/client-dashboard-wrapper';
import { ClientNav } from '@/components/attribution/client-nav';
import { ClientStatsSection } from '@/components/attribution/client-stats-section';
import type { AccountDomain } from '@/components/attribution/accounts-table';

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ slug: string; uuid: string }>;
}) {
  const { slug, uuid } = await params;

  const client = await getClientConfigBySlugAndUuid(slug, uuid);
  if (!client) {
    notFound();
  }

  // Fetch all domains for the unified view (no limit for now, paginate later if needed)
  const [domains, totalCount] = await Promise.all([
    getAttributedDomains(client.id),
    getAttributedDomainsCount(client.id),
  ]);

  // Serialize dates for client component
  const serializedDomains: AccountDomain[] = domains.map((d) => ({
    id: d.id,
    domain: d.domain,
    first_email_sent_at: d.first_email_sent_at ? new Date(d.first_email_sent_at) : null,
    first_event_at: d.first_event_at ? new Date(d.first_event_at) : null,
    last_event_at: d.last_event_at ? new Date(d.last_event_at) : null,
    has_positive_reply: d.has_positive_reply,
    has_sign_up: d.has_sign_up,
    has_meeting_booked: d.has_meeting_booked,
    has_paying_customer: d.has_paying_customer,
    is_within_window: d.is_within_window,
    match_type: d.match_type,
    status: d.status,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Navigation */}
      <ClientNav slug={slug} uuid={uuid} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.client_name}</h1>
          {client.last_processed_at && (
            <p className="text-muted-foreground text-sm">
              Last updated: {new Date(client.last_processed_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {client.slug}
        </Badge>
      </div>

      {/* Stats Section with Date Filter */}
      <ClientStatsSection
        slug={slug}
        uuid={uuid}
        clientName={client.client_name}
        initialStats={{
          totalEmailsSent: Number(client.total_emails_sent || 0),
          attributedPositiveReplies: Number(client.attributed_positive_replies || 0),
          attributedSignUps: Number(client.attributed_sign_ups || 0),
          attributedMeetings: Number(client.attributed_meetings_booked || 0),
          attributedPaying: Number(client.attributed_paying_customers || 0),
          hardMatchPositiveReplies: Number(client.hard_match_positive_replies || 0),
          hardMatchSignUps: Number(client.hard_match_sign_ups || 0),
          hardMatchMeetings: Number(client.hard_match_meetings || 0),
          hardMatchPaying: Number(client.hard_match_paying || 0),
          softMatchPositiveReplies: Number(client.soft_match_positive_replies || 0),
          softMatchSignUps: Number(client.soft_match_sign_ups || 0),
          softMatchMeetings: Number(client.soft_match_meetings || 0),
          softMatchPaying: Number(client.soft_match_paying || 0),
          outsideWindowSignUps: Number(client.outside_window_sign_ups || 0),
          outsideWindowMeetings: Number(client.outside_window_meetings || 0),
          outsideWindowPaying: Number(client.outside_window_paying || 0),
          notMatchedSignUps: Number(client.not_matched_sign_ups || 0),
          notMatchedMeetings: Number(client.not_matched_meetings || 0),
          notMatchedPaying: Number(client.not_matched_paying || 0),
        }}
      />

      {/* Section 3: All Accounts Table with Actions */}
      <div>
        <ClientDashboardWrapper
          domains={serializedDomains}
          totalCount={totalCount}
          slug={slug}
          uuid={uuid}
          attributionWindowDays={client.attribution_window_days || 31}
          revShareRate={client.rev_share_rate}
        />
      </div>
    </div>
  );
}
