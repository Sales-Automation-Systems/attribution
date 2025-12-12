import { notFound } from 'next/navigation';
import { getClientConfigBySlugAndUuid, getAttributedDomains } from '@/db/attribution/queries';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { LeadsView } from './leads-view';

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ slug: string; uuid: string }>;
}) {
  const { slug, uuid } = await params;

  const client = await getClientConfigBySlugAndUuid(slug, uuid);
  if (!client) {
    notFound();
  }

  // Fetch all domains (we'll filter client-side for better UX)
  const domains = await getAttributedDomains(client.id, {
    limit: 500,
  });

  // Serialize dates for client component
  const serializedDomains = domains.map((d) => ({
    ...d,
    first_email_sent_at: d.first_email_sent_at ? new Date(d.first_email_sent_at) : null,
    first_event_at: d.first_event_at ? new Date(d.first_event_at) : null,
  }));

  const settings = {
    sign_ups_mode: client.sign_ups_mode ?? 'per_event',
    meetings_mode: client.meetings_mode ?? 'per_event',
    paying_mode: client.paying_mode ?? 'per_domain',
    attribution_window_days: client.attribution_window_days ?? 31,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/client/${slug}/${uuid}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Attributed Leads</h1>
          <p className="text-muted-foreground">{client.client_name}</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Leads View (Client Component) */}
      <LeadsView
        domains={serializedDomains}
        clientName={client.client_name}
        slug={slug}
        uuid={uuid}
        settings={settings}
      />
    </div>
  );
}
