import { NextRequest, NextResponse } from 'next/server';
import { getTaskById, updateTaskStatus, resolveDispute } from '@/db/attribution/task-queries';
import type { TaskStatus } from '@/db/attribution/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { status, notes, resolvedBy } = body;

    // Validate status
    const validStatuses: TaskStatus[] = ['APPROVED', 'REJECTED', 'PENDING_INFO'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be APPROVED, REJECTED, or PENDING_INFO' },
        { status: 400 }
      );
    }

    // Get the task
    const task = await getTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if already resolved
    if (task.status === 'APPROVED' || task.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Task is already resolved' },
        { status: 400 }
      );
    }

    // For disputes, use the special resolve function that also updates the domain
    if (task.type === 'DISPUTE' && (status === 'APPROVED' || status === 'REJECTED')) {
      const updatedTask = await resolveDispute(
        taskId,
        status,
        resolvedBy || 'Agency',
        notes
      );

      return NextResponse.json({
        success: true,
        task: updatedTask,
        message: status === 'APPROVED' 
          ? 'Dispute approved - attribution removed from billable'
          : 'Dispute rejected - attribution remains billable',
      });
    }

    // For PENDING_INFO or non-dispute tasks, just update the status
    const updatedTask = await updateTaskStatus(
      taskId,
      status,
      status !== 'PENDING_INFO' ? resolvedBy : undefined,
      notes
    );

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message:
        status === 'PENDING_INFO'
          ? 'Marked as pending additional information'
          : `Task ${status.toLowerCase()}`,
    });
  } catch (error) {
    console.error('Error resolving task:', error);
    return NextResponse.json(
      { error: 'Failed to resolve task' },
      { status: 500 }
    );
  }
}

