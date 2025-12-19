import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';
import type { Task } from '@/db/attribution/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string; domainId: string }> }
) {
  try {
    const { slug, uuid, domainId } = await params;

    // Verify the client exists
    const clientResult = await attrPool.query(
      `SELECT id FROM client_config WHERE slug = $1 AND access_uuid = $2`,
      [slug, uuid]
    );

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const clientConfigId = clientResult.rows[0].id;

    // Verify the domain exists and belongs to this client
    const domainResult = await attrPool.query(
      `SELECT id FROM attributed_domain WHERE id = $1 AND client_config_id = $2`,
      [domainId, clientConfigId]
    );

    if (domainResult.rows.length === 0) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    // Fetch task for this domain (most recent if multiple)
    const taskResult = await attrPool.query<Task>(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM task_comment tc WHERE tc.task_id = t.id) as comment_count
       FROM task t
       WHERE t.attributed_domain_id = $1 AND t.client_config_id = $2
       ORDER BY t.submitted_at DESC
       LIMIT 1`,
      [domainId, clientConfigId]
    );

    const task = taskResult.rows[0] || null;

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}



