import { notFound } from 'next/navigation';
import {
  getClientConfigBySlugAndUuid,
  getAttributedDomains,
  getAttributedDomainsCount,
} from '@/db/attribution/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  MessageSquare,
  UserPlus,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { AttributionBreakdown } from '@/components/attribution/attribution-breakdown';
import { ClientDashboardWrapper } from '@/components/attribution/client-dashboard-wrapper';
import { ClientNav } from '@/components/attribution/client-nav';
import { DefinitionTooltip } from '@/components/ui/definition-tooltip';
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

      {/* Section 1: Client's Pipeline */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Client&apos;s Pipeline</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Total events from {client.client_name}&apos;s outreach
        </p>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Card className="bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-slate-500" />
                <DefinitionTooltip term="emailsSent" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Emails Sent</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold">
                {Number(client.total_emails_sent || 0).toLocaleString('en-US')}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <DefinitionTooltip term="positiveReply" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Positive Replies</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {Number(client.total_positive_replies || 0).toLocaleString('en-US')}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                {client.attributed_positive_replies && client.total_emails_sent ? (
                  <span>
                    {Number(Math.round(Number(client.total_emails_sent) / Number(client.attributed_positive_replies))).toLocaleString('en-US')}:1 email-to-attributed-reply ratio
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="h-4 w-4 text-blue-500" />
                <DefinitionTooltip term="websiteSignUp" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Sign-ups</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {Number(client.total_sign_ups || 0).toLocaleString('en-US')}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {client.attributed_sign_ups && client.total_emails_sent ? (
                  <span>
                    {Number(Math.round(Number(client.total_emails_sent) / Number(client.attributed_sign_ups))).toLocaleString('en-US')}:1 email-to-attributed-signup ratio
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-amber-500" />
                <DefinitionTooltip term="meetingBooked" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Meetings</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {Number(client.total_meetings_booked || 0).toLocaleString('en-US')}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {client.attributed_meetings_booked && client.total_emails_sent ? (
                  <span>
                    {Number(Math.round(Number(client.total_emails_sent) / Number(client.attributed_meetings_booked))).toLocaleString('en-US')}:1 email-to-attributed-meeting ratio
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-green-500" />
                <DefinitionTooltip term="payingCustomer" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Paying Customers</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {Number(client.total_paying_customers || 0).toLocaleString('en-US')}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                {client.attributed_paying_customers && client.total_emails_sent ? (
                  <span>
                    {Number(Math.round(Number(client.total_emails_sent) / Number(client.attributed_paying_customers))).toLocaleString('en-US')}:1 email-to-attributed-customer ratio
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: Attribution Breakdown by Status */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Attribution Breakdown</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Events by attribution status
        </p>
        <AttributionBreakdown
          signUps={{
            total: client.total_sign_ups || 0,
            attributed: client.attributed_sign_ups || 0,
            outsideWindow: client.outside_window_sign_ups || 0,
            unattributed: client.not_matched_sign_ups || 0,
          }}
          meetings={{
            total: client.total_meetings_booked || 0,
            attributed: client.attributed_meetings_booked || 0,
            outsideWindow: client.outside_window_meetings || 0,
            unattributed: client.not_matched_meetings || 0,
          }}
          paying={{
            total: client.total_paying_customers || 0,
            attributed: client.attributed_paying_customers || 0,
            outsideWindow: client.outside_window_paying || 0,
            unattributed: client.not_matched_paying || 0,
          }}
        />
      </div>

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
