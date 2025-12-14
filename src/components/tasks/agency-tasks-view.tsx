'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Flag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ExternalLink,
  Building2,
} from 'lucide-react';
import type { TaskWithDetails, TaskStatus } from '@/db/attribution/types';
import { CommentThread } from './comment-thread';
import { TaskResolutionForm } from './task-resolution-form';

interface TaskWithClientDetails extends TaskWithDetails {
  client_slug: string;
  client_uuid: string;
}

interface AgencyTasksViewProps {
  tasks: TaskWithClientDetails[];
  statusCounts: Record<TaskStatus, number>;
  clients: Array<{ id: string; name: string; slug: string; uuid: string }>;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ReactNode; color: string }> = {
  OPEN: {
    label: 'Open',
    icon: <Clock className="h-4 w-4" />,
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200',
  },
  PENDING_INFO: {
    label: 'Pending Info',
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200',
  },
  APPROVED: {
    label: 'Approved',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200',
  },
  REJECTED: {
    label: 'Rejected',
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200',
  },
};

function AgencyTaskCard({ task }: { task: TaskWithClientDetails }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const statusConfig = STATUS_CONFIG[task.status];
  const isResolved = task.status === 'APPROVED' || task.status === 'REJECTED';

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleResolutionSuccess = () => {
    router.refresh();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Flag className="h-4 w-4 text-orange-500" />
                <div>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    {task.domain || 'Unknown Domain'}
                    <span className="text-muted-foreground font-normal">·</span>
                    <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {task.client_name}
                    </span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Submitted {formatDate(task.submitted_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(task.comment_count ?? 0) > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {task.comment_count}
                  </div>
                )}
                <Badge variant="outline" className={statusConfig.color}>
                  {statusConfig.icon}
                  <span className="ml-1">{statusConfig.label}</span>
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 border-t">
            <div className="space-y-4 mt-4">
              {/* Dispute Details */}
              <div>
                <h4 className="text-sm font-medium mb-2">Dispute Reason</h4>
                <div className="bg-muted rounded-lg p-3 text-sm">
                  {task.description || 'No description provided'}
                </div>
              </div>

              {/* Links */}
              <div className="flex gap-4">
                {task.domain && task.client_slug && task.client_uuid && (
                  <a
                    href={`/client/${task.client_slug}/${task.client_uuid}?account=${task.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View account timeline
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {task.client_slug && task.client_uuid && (
                  <a
                    href={`/client/${task.client_slug}/${task.client_uuid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View client dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Resolution Form (if not resolved) */}
              {!isResolved && (
                <TaskResolutionForm
                  taskId={task.id}
                  onSuccess={handleResolutionSuccess}
                />
              )}

              {/* Resolution Notes (if resolved) */}
              {task.resolution_notes && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Resolution Notes</h4>
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    {task.resolution_notes}
                  </div>
                  {task.resolved_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Resolved {formatDate(task.resolved_at)} by {task.resolved_by || 'Agency'}
                    </p>
                  )}
                </div>
              )}

              {/* Comment Thread */}
              <CommentThread
                taskId={task.id}
                slug={task.client_slug}
                uuid={task.client_uuid}
                authorType="AGENCY"
                isResolved={isResolved}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function AgencyTasksView({
  tasks,
  statusCounts,
  clients,
}: AgencyTasksViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | TaskStatus>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  const filteredTasks = tasks.filter((t) => {
    const statusMatch = activeTab === 'all' || t.status === activeTab;
    const clientMatch = clientFilter === 'all' || t.client_config_id === clientFilter;
    return statusMatch && clientMatch;
  });

  const openCount = statusCounts.OPEN + statusCounts.PENDING_INFO;

  return (
    <div className="space-y-6">
      {/* Status Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className={openCount > 0 ? 'ring-2 ring-blue-500' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Open</span>
            </div>
            <div className="text-2xl font-bold">{statusCounts.OPEN}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Pending Info</span>
            </div>
            <div className="text-2xl font-bold">{statusCounts.PENDING_INFO}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Approved</span>
            </div>
            <div className="text-2xl font-bold">{statusCounts.APPROVED}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Rejected</span>
            </div>
            <div className="text-2xl font-bold">{statusCounts.REJECTED}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
          <TabsTrigger value="OPEN">
            Open ({statusCounts.OPEN})
            {statusCounts.OPEN > 0 && (
              <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="PENDING_INFO">Pending ({statusCounts.PENDING_INFO})</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved ({statusCounts.APPROVED})</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected ({statusCounts.REJECTED})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Flag className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">No tasks found</h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'all'
                    ? 'No disputes have been submitted yet.'
                    : `No ${STATUS_CONFIG[activeTab as TaskStatus]?.label.toLowerCase()} tasks.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <AgencyTaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

