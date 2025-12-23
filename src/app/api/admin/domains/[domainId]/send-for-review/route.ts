import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';
import { logStatusChange } from '@/db/attribution/queries';

/**
 * POST /api/admin/domains/[domainId]/send-for-review
 * 
 * Agency sends a domain for client review.
 * This is part of the agency-initiated review workflow.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;

    // Parse request body
    const body = await request.json();
    const { sentBy, notes } = body;
    
    // TODO: Get sentBy from auth session in production
    const reviewSentBy = sentBy || 'agency-admin@placeholder';

    // Verify the domain exists
    const domainResult = await attrPool.query(
      `SELECT id, domain, status, client_config_id FROM attributed_domain WHERE id = $1`,
      [domainId]
    );

    if (domainResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    const domain = domainResult.rows[0];

    // Check if already pending review
    if (domain.status === 'PENDING_CLIENT_REVIEW') {
      return NextResponse.json(
        { error: 'This domain is already pending client review' },
        { status: 400 }
      );
    }

    // Check if already rejected by client
    if (domain.status === 'CLIENT_REJECTED') {
      return NextResponse.json(
        { error: 'This domain was already rejected by the client. Create a new attribution if needed.' },
        { status: 400 }
      );
    }

    const oldStatus = domain.status;

    // Update the domain status to PENDING_CLIENT_REVIEW
    await attrPool.query(
      `UPDATE attributed_domain 
       SET status = 'PENDING_CLIENT_REVIEW',
           review_sent_at = NOW(),
           review_sent_by = $1,
           review_responded_at = NULL,
           review_response = NULL,
           review_response_by = NULL,
           review_notes = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [reviewSentBy, domainId]
    );

    // Log the status change for timeline audit trail
    await logStatusChange(domainId, {
      oldStatus: oldStatus,
      newStatus: 'PENDING_CLIENT_REVIEW',
      action: 'SENT_FOR_REVIEW',
      reason: notes || 'Sent for client review by agency',
      changedBy: reviewSentBy,
    });

    // Create a task for tracking
    await attrPool.query(
      `INSERT INTO task (client_config_id, attributed_domain_id, type, status, title, description, submitted_by)
       VALUES ($1, $2, 'REVIEW', 'OPEN', $3, $4, $5)`,
      [
        domain.client_config_id,
        domainId,
        `Review: ${domain.domain}`,
        notes || 'Agency sent this domain for client review',
        reviewSentBy,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Domain sent for client review',
      domainId,
      domain: domain.domain,
      newStatus: 'PENDING_CLIENT_REVIEW',
      reviewSentAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    });
  } catch (error) {
    console.error('Error sending domain for review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

