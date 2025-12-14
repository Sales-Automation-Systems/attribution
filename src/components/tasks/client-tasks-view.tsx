'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';
import type { Task, TaskStatus } from '@/db/attribution/types';
import { CommentThread } from './comment-thread';

interface TaskWithDetails extends Task {
  domain_name: string | null;
  comment_count: number;
}

interface ClientTasksViewProps {
  tasks: TaskWithDetails[];
  statusCounts: Record<TaskStatus, number>;
  slug: string;
  uuid: string;
  clientName: string;
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

function TaskCard({ task, slug, uuid }: { task: TaskWithDetails; slug: string; uuid: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const statusConfig = STATUS_CONFIG[task.status];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
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
                  <CardTitle className="text-base font-medium">
                    {task.domain_name || 'Unknown Domain'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Submitted {formatDate(task.submitted_at)} at {formatTime(task.submitted_at)}
                    {task.submitted_by && task.submitted_by !== 'client-user@placeholder' && (
                      <span> by {task.submitted_by}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {task.comment_count > 0 && (
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

              {/* Domain Link */}
              {task.domain_name && task.attributed_domain_id && (
                <div>
                  <a
                    href={`/client/${slug}/${uuid}?account=${task.domain_name}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View account timeline
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Resolution Notes (if resolved) */}
              {task.resolution_notes && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Resolution Notes</h4>
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    {task.resolution_notes}
                  </div>
                </div>
              )}

              {/* Comment Thread */}
              <CommentThread
                taskId={task.id}
                slug={slug}
                uuid={uuid}
                authorType="CLIENT"
                isResolved={task.status === 'APPROVED' || task.status === 'REJECTED'}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function ClientTasksView({
  tasks,
  statusCounts,
  slug,
  uuid,
  clientName,
}: ClientTasksViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | TaskStatus>('all');

  const filteredTasks =
    activeTab === 'all' ? tasks : tasks.filter((t) => t.status === activeTab);

  const openCount = statusCounts.OPEN + statusCounts.PENDING_INFO;
  const resolvedCount = statusCounts.APPROVED + statusCounts.REJECTED;

  return (
    <div className="space-y-6">
      {/* Status Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
          <TabsTrigger value="OPEN">Open ({statusCounts.OPEN})</TabsTrigger>
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
                    ? "You haven't submitted any disputes yet."
                    : `No ${STATUS_CONFIG[activeTab as TaskStatus]?.label.toLowerCase()} tasks.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} slug={slug} uuid={uuid} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

