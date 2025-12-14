import { notFound } from 'next/navigation';
import { getClientConfigBySlugAndUuid } from '@/db/attribution/queries';
import { getTasksByClient, getTaskComments, getTasksCountByStatus } from '@/db/attribution/task-queries';
import { ClientTasksView } from '@/components/tasks/client-tasks-view';

export default async function ClientTasksPage({
  params,
}: {
  params: Promise<{ slug: string; uuid: string }>;
}) {
  const { slug, uuid } = await params;

  const client = await getClientConfigBySlugAndUuid(slug, uuid);
  if (!client) {
    notFound();
  }

  // Fetch tasks for this client
  const [tasks, statusCounts] = await Promise.all([
    getTasksByClient(client.id),
    getTasksCountByStatus(client.id),
  ]);

  // Fetch domain names for each task
  const tasksWithDomains = await Promise.all(
    tasks.map(async (task) => {
      let domainName: string | null = null;
      if (task.attributed_domain_id) {
        const { attrQuery } = await import('@/db');
        const domainResult = await attrQuery<{ domain: string }>(
          'SELECT domain FROM attributed_domain WHERE id = $1',
          [task.attributed_domain_id]
        );
        domainName = domainResult[0]?.domain || null;
      }
      
      // Fetch comments count
      const comments = await getTaskComments(task.id);
      
      return {
        ...task,
        domain_name: domainName,
        comment_count: comments.length,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage your disputes and other tasks
          </p>
        </div>
      </div>

      {/* Tasks View */}
      <ClientTasksView
        tasks={tasksWithDomains}
        statusCounts={statusCounts}
        slug={slug}
        uuid={uuid}
        clientName={client.client_name}
      />
    </div>
  );
}

