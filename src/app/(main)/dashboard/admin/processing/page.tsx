import { SyncClientsButton, ProcessAllButton, ProcessSingleClientButton } from './actions';
import { WorkerJobsDisplay } from './worker-jobs';

export const dynamic = 'force-dynamic';

export default function ProcessingJobsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processing Jobs</h1>
          <p className="text-muted-foreground">Monitor and manage attribution processing</p>
        </div>
        <div className="flex gap-2">
          <SyncClientsButton />
          <ProcessAllButton />
        </div>
      </div>

      {/* Single Client Processing */}
      <div className="p-4 border rounded-lg bg-muted/30">
        <h3 className="text-sm font-medium mb-3">Process Single Client</h3>
        <ProcessSingleClientButton />
      </div>

      {/* Worker Jobs Display (client component with auto-refresh) */}
      <WorkerJobsDisplay />
    </div>
  );
}
