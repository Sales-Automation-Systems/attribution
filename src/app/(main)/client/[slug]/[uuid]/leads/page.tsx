import { notFound } from 'next/navigation';
import { getClientConfigBySlugAndUuid, getAttributedDomains, getDomainEvents } from '@/db/attribution/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Target,
  Download,
  Search,
  ChevronDown,
  Mail,
  MessageSquare,
  UserPlus,
  Calendar,
  DollarSign,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; uuid: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug, uuid } = await params;
  const search = await searchParams;

  const client = await getClientConfigBySlugAndUuid(slug, uuid);
  if (!client) {
    notFound();
  }

  // Parse filters
  const matchType = (search.matchType as string) || undefined;
  const status = (search.status as string) || undefined;

  const domains = await getAttributedDomains(client.id, {
    matchType,
    status,
    limit: 100,
  });

  // Group by status for summary
  const attributed = domains.filter((d) => d.is_within_window);
  const withPaying = domains.filter((d) => d.has_paying_customer);

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

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-primary/5">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{domains.length}</div>
            <p className="text-xs text-muted-foreground">Total Domains</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{attributed.length}</div>
            <p className="text-xs text-muted-foreground">Attributed (Within Window)</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{withPaying.length}</div>
            <p className="text-xs text-muted-foreground">Paying Customers</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {domains.filter((d) => d.status === 'DISPUTED').length}
            </div>
            <p className="text-xs text-muted-foreground">Disputed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search domains..." className="pl-8" />
        </div>
        <Select defaultValue={matchType || 'all'}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Match Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Matches</SelectItem>
            <SelectItem value="HARD_MATCH">Hard Match</SelectItem>
            <SelectItem value="SOFT_MATCH">Soft Match</SelectItem>
            <SelectItem value="NO_MATCH">No Match</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue={status || 'all'}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ATTRIBUTED">Attributed</SelectItem>
            <SelectItem value="DISPUTED">Disputed</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Domain Cards */}
      <div className="space-y-4">
        {domains.length > 0 ? (
          domains.map((domain) => (
            <DomainCard key={domain.id} domain={domain} slug={slug} uuid={uuid} />
          ))
        ) : (
          <Card className="p-8 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Leads Found</h3>
            <p className="text-muted-foreground">
              No attributed leads match your current filters.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

// Domain Card Component
function DomainCard({
  domain,
  slug,
  uuid,
}: {
  domain: Awaited<ReturnType<typeof getAttributedDomains>>[0];
  slug: string;
  uuid: string;
}) {
  return (
    <Collapsible>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle className="text-lg">{domain.domain}</CardTitle>
                  <CardDescription>
                    {domain.first_event_at
                      ? `First event: ${new Date(domain.first_event_at).toLocaleDateString()}`
                      : 'No events yet'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Event Type Badges */}
                {domain.has_positive_reply && (
                  <Badge variant="outline" className="bg-purple-500/10">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Reply
                  </Badge>
                )}
                {domain.has_sign_up && (
                  <Badge variant="outline" className="bg-blue-500/10">
                    <UserPlus className="h-3 w-3 mr-1" />
                    Sign-up
                  </Badge>
                )}
                {domain.has_meeting_booked && (
                  <Badge variant="outline" className="bg-yellow-500/10">
                    <Calendar className="h-3 w-3 mr-1" />
                    Meeting
                  </Badge>
                )}
                {domain.has_paying_customer && (
                  <Badge className="bg-green-500">
                    <DollarSign className="h-3 w-3 mr-1" />
                    Paying
                  </Badge>
                )}

                {/* Match Type */}
                <Badge
                  variant={domain.match_type === 'HARD_MATCH' ? 'default' : 'secondary'}
                >
                  {domain.match_type === 'HARD_MATCH'
                    ? 'Hard Match'
                    : domain.match_type === 'SOFT_MATCH'
                      ? 'Soft Match'
                      : 'No Match'}
                </Badge>

                {/* Status */}
                {domain.status !== 'ATTRIBUTED' && (
                  <Badge
                    variant={
                      domain.status === 'DISPUTED'
                        ? 'destructive'
                        : domain.status === 'CONFIRMED'
                          ? 'default'
                          : 'secondary'
                    }
                  >
                    {domain.status}
                  </Badge>
                )}

                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t pt-4">
            <div className="space-y-4">
              {/* Timeline would go here - requires client-side fetching */}
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>First Email Sent:</strong>{' '}
                  {domain.first_email_sent_at
                    ? new Date(domain.first_email_sent_at).toLocaleString()
                    : 'Unknown'}
                </p>
                <p>
                  <strong>First Event:</strong>{' '}
                  {domain.first_event_at
                    ? new Date(domain.first_event_at).toLocaleString()
                    : 'None'}
                </p>
                <p>
                  <strong>Attribution Month:</strong>{' '}
                  {domain.first_attributed_month || 'N/A'}
                </p>
                {domain.is_within_window ? (
                  <Badge variant="outline" className="mt-2 bg-green-500/10 text-green-700">
                    Within 31-day window
                  </Badge>
                ) : (
                  <Badge variant="outline" className="mt-2 bg-red-500/10 text-red-700">
                    Outside window
                  </Badge>
                )}
              </div>

              {/* Dispute Section */}
              {domain.status === 'ATTRIBUTED' && (
                <div className="pt-4 border-t">
                  <Button variant="outline" size="sm">
                    Dispute Attribution
                  </Button>
                </div>
              )}
              {domain.dispute_reason && (
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-sm font-medium text-yellow-700">Dispute Reason:</p>
                  <p className="text-sm text-yellow-600">{domain.dispute_reason}</p>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

