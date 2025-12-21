// Task/Dispute System Queries
import { attrQuery } from '../index';
import { logStatusChange } from './queries';
import type { Task, TaskComment, TaskWithDetails, TaskType, TaskStatus, TaskAuthorType } from './types';

// ============ Task Queries ============

export async function createTask(data: {
  client_config_id: string;
  attributed_domain_id?: string;
  type: TaskType;
  title?: string;
  description?: string;
  submitted_by?: string;
}): Promise<Task> {
  const rows = await attrQuery<Task>(`
    INSERT INTO task (client_config_id, attributed_domain_id, type, title, description, submitted_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    data.client_config_id,
    data.attributed_domain_id || null,
    data.type,
    data.title || null,
    data.description || null,
    data.submitted_by || null,
  ]);
  return rows[0];
}

export async function getTaskById(id: string): Promise<Task | null> {
  const rows = await attrQuery<Task>('SELECT * FROM task WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getTasksByClient(
  clientConfigId: string,
  options?: {
    status?: TaskStatus;
    type?: TaskType;
    limit?: number;
    offset?: number;
  }
): Promise<Task[]> {
  let query = 'SELECT * FROM task WHERE client_config_id = $1';
  const params: unknown[] = [clientConfigId];
  let paramIndex = 2;

  if (options?.status) {
    query += ` AND status = $${paramIndex}`;
    params.push(options.status);
    paramIndex++;
  }

  if (options?.type) {
    query += ` AND type = $${paramIndex}`;
    params.push(options.type);
    paramIndex++;
  }

  query += ' ORDER BY submitted_at DESC';

  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
    paramIndex++;
  }

  if (options?.offset) {
    query += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
  }

  return attrQuery<Task>(query, params);
}

export async function getAllTasks(options?: {
  status?: TaskStatus;
  type?: TaskType;
  clientConfigId?: string;
  limit?: number;
  offset?: number;
}): Promise<TaskWithDetails[]> {
  let query = `
    SELECT t.*, 
           cc.client_name,
           ad.domain,
           (SELECT COUNT(*) FROM task_comment tc WHERE tc.task_id = t.id) as comment_count
    FROM task t
    LEFT JOIN client_config cc ON t.client_config_id = cc.id
    LEFT JOIN attributed_domain ad ON t.attributed_domain_id = ad.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.status) {
    query += ` AND t.status = $${paramIndex}`;
    params.push(options.status);
    paramIndex++;
  }

  if (options?.type) {
    query += ` AND t.type = $${paramIndex}`;
    params.push(options.type);
    paramIndex++;
  }

  if (options?.clientConfigId) {
    query += ` AND t.client_config_id = $${paramIndex}`;
    params.push(options.clientConfigId);
    paramIndex++;
  }

  query += ' ORDER BY t.submitted_at DESC';

  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
    paramIndex++;
  }

  if (options?.offset) {
    query += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
  }

  return attrQuery<TaskWithDetails>(query, params);
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  resolvedBy?: string,
  resolutionNotes?: string
): Promise<Task | null> {
  const isResolved = status === 'APPROVED' || status === 'REJECTED';
  
  const rows = await attrQuery<Task>(`
    UPDATE task
    SET status = $2,
        resolved_by = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE resolved_by END,
        resolved_at = CASE WHEN $4::boolean THEN NOW() ELSE resolved_at END,
        resolution_notes = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE resolution_notes END,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, status, resolvedBy || null, isResolved, resolutionNotes || null]);
  
  return rows[0] || null;
}

export async function getTasksCountByStatus(clientConfigId?: string): Promise<Record<TaskStatus, number>> {
  let query = `
    SELECT status, COUNT(*) as count
    FROM task
  `;
  const params: unknown[] = [];
  
  if (clientConfigId) {
    query += ' WHERE client_config_id = $1';
    params.push(clientConfigId);
  }
  
  query += ' GROUP BY status';
  
  const rows = await attrQuery<{ status: TaskStatus; count: string }>(query, params);
  
  const counts: Record<TaskStatus, number> = {
    OPEN: 0,
    PENDING_INFO: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  
  for (const row of rows) {
    counts[row.status] = parseInt(row.count, 10);
  }
  
  return counts;
}

// ============ Task Comment Queries ============

export async function createTaskComment(data: {
  task_id: string;
  author_type: TaskAuthorType;
  author_name?: string;
  content: string;
}): Promise<TaskComment> {
  const rows = await attrQuery<TaskComment>(`
    INSERT INTO task_comment (task_id, author_type, author_name, content)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [
    data.task_id,
    data.author_type,
    data.author_name || null,
    data.content,
  ]);
  return rows[0];
}

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  return attrQuery<TaskComment>(
    'SELECT * FROM task_comment WHERE task_id = $1 ORDER BY created_at ASC',
    [taskId]
  );
}

// ============ Dispute-Specific Helpers ============

export async function createDispute(data: {
  client_config_id: string;
  attributed_domain_id: string;
  reason: string;
  submitted_by?: string;
}): Promise<Task> {
  // Create the task
  const task = await createTask({
    client_config_id: data.client_config_id,
    attributed_domain_id: data.attributed_domain_id,
    type: 'DISPUTE',
    title: 'Dispute',
    description: data.reason,
    submitted_by: data.submitted_by,
  });
  
  // Update the attributed_domain status to DISPUTED
  await attrQuery(`
    UPDATE attributed_domain
    SET status = 'DISPUTED',
        dispute_reason = $2,
        dispute_submitted_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
  `, [data.attributed_domain_id, data.reason]);
  
  return task;
}

export async function resolveDispute(
  taskId: string,
  resolution: 'APPROVED' | 'REJECTED',
  resolvedBy: string,
  notes?: string
): Promise<Task | null> {
  // Get the task first
  const task = await getTaskById(taskId);
  if (!task || !task.attributed_domain_id) return null;
  
  // Update task status
  const updatedTask = await updateTaskStatus(taskId, resolution, resolvedBy, notes);
  
  // Update the attributed_domain based on resolution
  if (resolution === 'APPROVED') {
    // Dispute approved = remove from billable
    await attrQuery(`
      UPDATE attributed_domain
      SET status = 'DISPUTED',
          dispute_resolved_at = NOW(),
          dispute_resolution_notes = $2,
          is_within_window = false,
          updated_at = NOW()
      WHERE id = $1
    `, [task.attributed_domain_id, notes || 'Dispute approved']);

    // Log status change for timeline audit trail
    await logStatusChange(task.attributed_domain_id, {
      oldStatus: 'DISPUTE_PENDING',
      newStatus: 'DISPUTED',
      action: 'DISPUTE_APPROVED',
      reason: notes || 'Dispute approved - attribution removed',
      changedBy: resolvedBy,
    });
  } else {
    // Dispute rejected = keep as billable, restore to ATTRIBUTED status
    await attrQuery(`
      UPDATE attributed_domain
      SET status = 'ATTRIBUTED',
          dispute_resolved_at = NOW(),
          dispute_resolution_notes = $2,
          updated_at = NOW()
      WHERE id = $1
    `, [task.attributed_domain_id, notes || 'Dispute rejected - attribution confirmed']);

    // Log status change for timeline audit trail
    await logStatusChange(task.attributed_domain_id, {
      oldStatus: 'DISPUTE_PENDING',
      newStatus: 'ATTRIBUTED',
      action: 'DISPUTE_REJECTED',
      reason: notes || 'Dispute rejected - attribution confirmed',
      changedBy: resolvedBy,
    });
  }
  
  return updatedTask;
}




