import { NextRequest, NextResponse } from 'next/server';
import { attributionPool } from '@/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string; domainId: string }> }
) {
  try {
    const { slug, uuid, domainId } = await params;

    // Parse request body
    const body = await request.json();
    const { notes } = body;

    // Verify the client exists and the domain belongs to them
    const clientResult = await attributionPool.query(
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
    const domainResult = await attributionPool.query(
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

    // Check if already promoted or attributed
    if (domain.status === 'CLIENT_PROMOTED') {
      return NextResponse.json(
        { error: 'This domain has already been promoted' },
        { status: 400 }
      );
    }

    if (domain.status === 'ATTRIBUTED' && domain.is_within_window) {
      return NextResponse.json(
        { error: 'This domain is already attributed' },
        { status: 400 }
      );
    }

    // Determine who is promoting (in a real app, this would come from auth)
    const promotedBy = 'client'; // Could be user email from session

    // Update the domain status to CLIENT_PROMOTED
    await attributionPool.query(
      `UPDATE attributed_domain 
       SET status = 'CLIENT_PROMOTED',
           promoted_at = NOW(),
           promoted_by = $1,
           promotion_notes = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [promotedBy, notes?.trim() || null, domainId]
    );

    return NextResponse.json({
      success: true,
      message: 'Domain promoted successfully',
      domainId,
      domain: domain.domain,
      previousStatus: domain.status,
      newStatus: 'CLIENT_PROMOTED',
    });
  } catch (error) {
    console.error('Error promoting domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

