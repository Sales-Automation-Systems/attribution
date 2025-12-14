import { getAllTasks, getTasksCountByStatus } from '@/db/attribution/task-queries';
import { getAllClientConfigs } from '@/db/attribution/queries';
import { AgencyTasksView } from '@/components/tasks/agency-tasks-view';

export default async function AgencyTasksPage() {
  // Fetch all tasks across all clients with details
  const [tasks, statusCounts, clients] = await Promise.all([
    getAllTasks(),
    getTasksCountByStatus(),
    getAllClientConfigs(),
  ]);

  // Create a map of client configs for quick lookup
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  // Add client details to tasks
  const tasksWithClientDetails = tasks.map((task) => {
    const client = clientMap.get(task.client_config_id);
    return {
      ...task,
      client_name: task.client_name || client?.client_name || 'Unknown Client',
      client_slug: client?.slug || '',
      client_uuid: client?.access_uuid || '',
    };
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review and resolve client disputes across all accounts
          </p>
        </div>
      </div>

      {/* Tasks View */}
      <AgencyTasksView
        tasks={tasksWithClientDetails}
        statusCounts={statusCounts}
        clients={clients.map((c) => ({
          id: c.id,
          name: c.client_name,
          slug: c.slug,
          uuid: c.access_uuid,
        }))}
      />
    </div>
  );
}

