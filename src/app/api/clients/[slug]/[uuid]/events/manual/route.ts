import { NextRequest, NextResponse } from 'next/server';
import { attributionPool } from '@/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string }> }
) {
  try {
    const { slug, uuid } = await params;

    // Parse request body
    const body = await request.json();
    const { domain, eventType, eventDate, contactEmail, notes } = body;

    // Validate required fields
    if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    if (!eventType || !['sign_up', 'meeting_booked', 'paying_customer'].includes(eventType)) {
      return NextResponse.json({ error: 'Valid event type is required' }, { status: 400 });
    }

    if (!eventDate) {
      return NextResponse.json({ error: 'Event date is required' }, { status: 400 });
    }

    // Verify the client exists
    const clientResult = await attributionPool.query(
      `SELECT id FROM client_config WHERE slug = $1 AND access_uuid = $2`,
      [slug, uuid]
    );

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const clientConfigId = clientResult.rows[0].id;

    // Clean the domain
    let cleanDomain = domain.toLowerCase().trim();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
    cleanDomain = cleanDomain.replace(/^www\./, '');
    cleanDomain = cleanDomain.split('/')[0];

    // Check if domain already exists for this client
    const existingDomain = await attributionPool.query(
      `SELECT id FROM attributed_domain WHERE client_config_id = $1 AND domain = $2`,
      [clientConfigId, cleanDomain]
    );

    let domainId: string;
    const eventDateParsed = new Date(eventDate);

    if (existingDomain.rows.length > 0) {
      // Domain exists - update it
      domainId = existingDomain.rows[0].id;

      // Update the existing domain record with the new event
      const updateFields: string[] = [];
      const updateValues: (string | boolean | Date)[] = [];
      let paramIndex = 1;

      // Set the appropriate event flag
      if (eventType === 'sign_up') {
        updateFields.push(`has_sign_up = $${paramIndex++}`);
        updateValues.push(true);
      } else if (eventType === 'meeting_booked') {
        updateFields.push(`has_meeting_booked = $${paramIndex++}`);
        updateValues.push(true);
      } else if (eventType === 'paying_customer') {
        updateFields.push(`has_paying_customer = $${paramIndex++}`);
        updateValues.push(true);
      }

      // Update first_event_at if this is earlier
      updateFields.push(`first_event_at = LEAST(first_event_at, $${paramIndex++})`);
      updateValues.push(eventDateParsed);

      // If not already promoted or attributed, set to CLIENT_PROMOTED
      updateFields.push(`status = CASE WHEN status IN ('OUTSIDE_WINDOW', 'UNATTRIBUTED', 'ATTRIBUTED') AND NOT is_within_window THEN 'CLIENT_PROMOTED' ELSE status END`);
      
      // Update promoted_at and promoted_by if promoting
      updateFields.push(`promoted_at = CASE WHEN status IN ('OUTSIDE_WINDOW', 'UNATTRIBUTED') THEN NOW() ELSE promoted_at END`);
      updateFields.push(`promoted_by = CASE WHEN status IN ('OUTSIDE_WINDOW', 'UNATTRIBUTED') THEN 'client' ELSE promoted_by END`);
      
      // Update promotion notes
      if (notes) {
        updateFields.push(`promotion_notes = COALESCE(promotion_notes || E'\\n', '') || $${paramIndex++}`);
        updateValues.push(`[Manual ${eventType}] ${notes}`);
      }

      updateFields.push(`updated_at = NOW()`);

      await attributionPool.query(
        `UPDATE attributed_domain SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        [...updateValues, domainId]
      );
    } else {
      // Create new domain record
      domainId = uuidv4();

      await attributionPool.query(
        `INSERT INTO attributed_domain (
          id, client_config_id, domain, first_event_at,
          has_positive_reply, has_sign_up, has_meeting_booked, has_paying_customer,
          is_within_window, match_type, status,
          promoted_at, promoted_by, promotion_notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          false, $5, $6, $7,
          false, 'MANUAL', 'CLIENT_PROMOTED',
          NOW(), 'client', $8,
          NOW(), NOW()
        )`,
        [
          domainId,
          clientConfigId,
          cleanDomain,
          eventDateParsed,
          eventType === 'sign_up',
          eventType === 'meeting_booked',
          eventType === 'paying_customer',
          notes ? `[Manual ${eventType}] ${notes}` : null,
        ]
      );
    }

    // Also create a domain_event record
    const eventId = uuidv4();
    const eventSource =
      eventType === 'sign_up'
        ? 'SIGN_UP'
        : eventType === 'meeting_booked'
          ? 'MEETING_BOOKED'
          : 'PAYING_CUSTOMER';

    await attributionPool.query(
      `INSERT INTO domain_event (
        id, attributed_domain_id, event_source, event_time, email,
        source_id, source_table, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        'manual', 'manual_entry', $6, NOW()
      )`,
      [
        eventId,
        domainId,
        eventSource,
        eventDateParsed,
        contactEmail || null,
        JSON.stringify({ notes, addedBy: 'client', manual: true }),
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Event added successfully',
      domainId,
      domain: cleanDomain,
      eventType,
      eventDate: eventDateParsed.toISOString(),
    });
  } catch (error) {
    console.error('Error adding manual event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

