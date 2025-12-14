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

    // Check if already disputed
    if (domain.status === 'DISPUTED') {
      return NextResponse.json(
        { error: 'This domain has already been disputed' },
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

    // Update the domain status to DISPUTED
    await attrPool.query(
      `UPDATE attributed_domain 
       SET status = 'DISPUTED',
           dispute_reason = $1,
           dispute_submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [fullReason, domainId]
    );

    return NextResponse.json({
      success: true,
      message: 'Dispute submitted successfully',
      domainId,
      domain: domain.domain,
    });
  } catch (error) {
    console.error('Error submitting dispute:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

