import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';
import { logStatusChange } from '@/db/attribution/queries';

/**
 * POST /api/clients/[slug]/[uuid]/domains/[domainId]/review-response
 * 
 * Client responds to a review request from the agency.
 * They can either confirm or reject the attribution.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string; domainId: string }> }
) {
  try {
    const { slug, uuid, domainId } = await params;

    // Parse request body
    const body = await request.json();
    const { response, notes, respondedBy } = body;

    // Validate response
    if (!response || !['CONFIRMED', 'REJECTED'].includes(response)) {
      return NextResponse.json(
        { error: 'response must be "CONFIRMED" or "REJECTED"' },
        { status: 400 }
      );
    }

    // TODO: Get respondedBy from auth session in production
    const reviewResponseBy = respondedBy || 'client-user@placeholder';

    // Verify the client exists
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
      `SELECT id, domain, status, review_sent_at FROM attributed_domain 
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

    // Check if domain is pending review
    if (domain.status !== 'PENDING_CLIENT_REVIEW') {
      return NextResponse.json(
        { error: 'This domain is not pending review' },
        { status: 400 }
      );
    }

    // Determine the new status based on response
    const newStatus = response === 'CONFIRMED' ? 'ATTRIBUTED' : 'CLIENT_REJECTED';

    // Update the domain
    await attrPool.query(
      `UPDATE attributed_domain 
       SET status = $1,
           review_responded_at = NOW(),
           review_response = $2,
           review_response_by = $3,
           review_notes = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [newStatus, response, reviewResponseBy, notes?.trim() || null, domainId]
    );

    // Log the status change
    const action = response === 'CONFIRMED' ? 'REVIEW_CONFIRMED' : 'REVIEW_REJECTED';
    await logStatusChange(domainId, {
      oldStatus: 'PENDING_CLIENT_REVIEW',
      newStatus: newStatus,
      action: action,
      reason: notes || (response === 'CONFIRMED' 
        ? 'Attribution confirmed by client' 
        : 'Attribution rejected by client'),
      changedBy: reviewResponseBy,
    });

    // Update the associated task
    const taskStatus = response === 'CONFIRMED' ? 'APPROVED' : 'REJECTED';
    await attrPool.query(
      `UPDATE task 
       SET status = $1,
           resolved_by = $2,
           resolved_at = NOW(),
           resolution_notes = $3,
           updated_at = NOW()
       WHERE attributed_domain_id = $4 
         AND type = 'REVIEW' 
         AND status = 'OPEN'`,
      [taskStatus, reviewResponseBy, notes || null, domainId]
    );

    return NextResponse.json({
      success: true,
      message: response === 'CONFIRMED' 
        ? 'Attribution confirmed' 
        : 'Attribution rejected',
      domainId,
      domain: domain.domain,
      newStatus,
      respondedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing review response:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

