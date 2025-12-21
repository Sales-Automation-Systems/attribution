import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string; domainId: string }> }
) {
  try {
    const { slug, uuid, domainId } = await params;

    // Parse request body
    const body = await request.json();
    const { reason, evidenceLink, eventTypes } = body;
    
    // TODO: Get submittedBy from auth session in production
    // For now, use placeholder
    const submittedBy = 'client-user@placeholder';

    // Validate required fields
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Reason is required' },
        { status: 400 }
      );
    }

    // Verify the client exists and the domain belongs to them
    const clientResult = await attrPool.query(
      `SELECT id FROM client_config WHERE slug = $1 AND access_uuid = $2`,
      [slug, uuid]
    );

    if (clientResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const clientConfigId = clientResult.rows[0].id;

    // Verify the domain exists and belongs to this client
    const domainResult = await attrPool.query(
      `SELECT id, domain, status FROM attributed_domain 
       WHERE id = $1 AND client_config_id = $2`,
      [domainId, clientConfigId]
    );

    if (domainResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    const domain = domainResult.rows[0];

    // Check if already disputed or pending dispute
    if (domain.status === 'DISPUTED' || domain.status === 'DISPUTE_PENDING') {
      return NextResponse.json(
        { error: 'This domain already has a dispute in progress' },
        { status: 400 }
      );
    }

    // Build the dispute reason with event types
    let fullReason = reason.trim();
    if (eventTypes && Array.isArray(eventTypes) && eventTypes.length > 0) {
      fullReason = `[Events: ${eventTypes.join(', ')}] ${fullReason}`;
    }
    if (evidenceLink && typeof evidenceLink === 'string' && evidenceLink.trim()) {
      fullReason = `${fullReason}\n\nEvidence: ${evidenceLink.trim()}`;
    }

    // Update the domain status to DISPUTE_PENDING (awaiting agency review)
    // Status changes to DISPUTED after agency approves, or back to original if rejected
    await attrPool.query(
      `UPDATE attributed_domain 
       SET status = 'DISPUTE_PENDING',
           dispute_reason = $1,
           dispute_submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [fullReason, domainId]
    );

    // Create a task for the dispute
    const taskResult = await attrPool.query(
      `INSERT INTO task (client_config_id, attributed_domain_id, type, status, title, description, submitted_by)
       VALUES ($1, $2, 'DISPUTE', 'OPEN', $3, $4, $5)
       RETURNING id`,
      [clientConfigId, domainId, `Dispute: ${domain.domain}`, fullReason, submittedBy?.trim() || null]
    );

    const taskId = taskResult.rows[0]?.id;

    return NextResponse.json({
      success: true,
      message: 'Dispute submitted successfully',
      domainId,
      domain: domain.domain,
      taskId,
    });
  } catch (error) {
    console.error('Error submitting dispute:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

