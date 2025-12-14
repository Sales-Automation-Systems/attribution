import { notFound } from 'next/navigation';
import { getClientConfigBySlugAndUuid, getAttributedDomains } from '@/db/attribution/queries';
import { Card, CardContent } from '@/components/ui/card';
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
  Target,
  Download,
  Search,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { DomainCardList } from './domain-card-list';

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
  const withReplies = domains.filter((d) => d.has_positive_reply);

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
      <div className="grid gap-4 md:grid-cols-5">
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
        <Card className="bg-purple-500/10">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{withReplies.length}</div>
            <p className="text-xs text-muted-foreground">With Positive Replies</p>
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

      {/* Domain Cards (Client Component for interactivity) */}
      {domains.length > 0 ? (
        <DomainCardList domains={domains} slug={slug} uuid={uuid} />
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
  );
}
