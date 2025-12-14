import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';

/**
 * POST /api/clients/[slug]/[uuid]/domains/[domainId]/attribute
 * 
 * Manually attribute a domain that is either:
 * - OUTSIDE_WINDOW (we emailed them but event happened after 31 days)
 * - UNATTRIBUTED (no email match found)
 * 
 * This changes the status to CLIENT_PROMOTED (client-attributed)
 * which makes it billable at the client's revenue share rate.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string; domainId: string }> }
) {
  try {
    const { slug, uuid, domainId } = await params;

    // Parse request body
    const body = await request.json();
    const { notes } = body;
    
    // TODO: Get submittedBy from auth session in production
    // For now, use placeholder
    const submittedBy = 'client-user@placeholder';

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
      `SELECT id, domain, status, is_within_window, match_type FROM attributed_domain 
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

    // Check if already client-attributed
    if (domain.status === 'CLIENT_PROMOTED') {
      return NextResponse.json(
        { error: 'This domain has already been client-attributed' },
        { status: 400 }
      );
    }

    // Check if already auto-attributed (within window)
    if (domain.status === 'ATTRIBUTED' && domain.is_within_window) {
      return NextResponse.json(
        { error: 'This domain is already attributed (within attribution window)' },
        { status: 400 }
      );
    }

    // Use user from auth session (placeholder for now)
    const attributedBy = submittedBy;

    // Update the domain status to CLIENT_PROMOTED
    // Note: We keep the database column names as promoted_* for backward compatibility
    await attrPool.query(
      `UPDATE attributed_domain 
       SET status = 'CLIENT_PROMOTED',
           promoted_at = NOW(),
           promoted_by = $1,
           promotion_notes = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [attributedBy, notes?.trim() || null, domainId]
    );

    return NextResponse.json({
      success: true,
      message: 'Domain attributed successfully',
      domainId,
      domain: domain.domain,
      previousStatus: domain.status,
      newStatus: 'CLIENT_PROMOTED',
    });
  } catch (error) {
    console.error('Error attributing domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

