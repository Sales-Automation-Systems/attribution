import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';
import { randomUUID } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string }> }
) {
  try {
    const { slug, uuid } = await params;

    // Parse request body
    const body = await request.json();
    const { domain, eventType, eventDate, contactEmail, notes } = body;
    
    // TODO: Get submittedBy from auth session in production
    // For now, use placeholder
    const submittedBy = 'client-user@placeholder';

    // Validate required fields
    if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    if (!eventType || !['email_sent', 'positive_reply', 'sign_up', 'meeting_booked', 'paying_customer'].includes(eventType)) {
      return NextResponse.json({ error: 'Valid event type is required' }, { status: 400 });
    }

    if (!eventDate) {
      return NextResponse.json({ error: 'Event date is required' }, { status: 400 });
    }

    // Verify the client exists
    const clientResult = await attrPool.query(
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
    const existingDomain = await attrPool.query(
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

      // Set the appropriate event flag based on event type
      if (eventType === 'email_sent') {
        // For email_sent, update the first_email_sent_at field
        updateFields.push(`first_email_sent_at = LEAST(first_email_sent_at, $${paramIndex++})`);
        updateValues.push(eventDateParsed);
      } else if (eventType === 'positive_reply') {
        updateFields.push(`has_positive_reply = $${paramIndex++}`);
        updateValues.push(true);
      } else if (eventType === 'sign_up') {
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

      // If not already client-attributed, set to CLIENT_PROMOTED status
      updateFields.push(`status = CASE WHEN status IN ('OUTSIDE_WINDOW', 'UNATTRIBUTED', 'ATTRIBUTED') AND NOT is_within_window THEN 'CLIENT_PROMOTED' ELSE status END`);
      
      // Update attribution fields (columns still named promoted_* for DB compat)
      updateFields.push(`promoted_at = CASE WHEN status IN ('OUTSIDE_WINDOW', 'UNATTRIBUTED') THEN NOW() ELSE promoted_at END`);
      updateFields.push(`promoted_by = CASE WHEN status IN ('OUTSIDE_WINDOW', 'UNATTRIBUTED') THEN $${paramIndex++} ELSE promoted_by END`);
      updateValues.push(submittedBy);
      
      // Update promotion notes
      if (notes) {
        updateFields.push(`promotion_notes = COALESCE(promotion_notes || E'\\n', '') || $${paramIndex++}`);
        updateValues.push(`[Manual ${eventType}] ${notes}`);
      }

      updateFields.push(`updated_at = NOW()`);

      await attrPool.query(
        `UPDATE attributed_domain SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        [...updateValues, domainId]
      );
    } else {
      // Create new domain record
      domainId = randomUUID();
      
      // Determine if this is an email event (sets first_email_sent_at) or a success event (sets first_event_at)
      const isEmailEvent = eventType === 'email_sent';
      const firstEmailSentAt = isEmailEvent ? eventDateParsed : null;
      const firstEventAt = isEmailEvent ? null : eventDateParsed;

      await attrPool.query(
        `INSERT INTO attributed_domain (
          id, client_config_id, domain, first_email_sent_at, first_event_at,
          has_positive_reply, has_sign_up, has_meeting_booked, has_paying_customer,
          is_within_window, match_type, status,
          promoted_at, promoted_by, promotion_notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          false, 'MANUAL', 'CLIENT_PROMOTED',
          NOW(), $10, $11,
          NOW(), NOW()
        )`,
        [
          domainId,
          clientConfigId,
          cleanDomain,
          firstEmailSentAt,
          firstEventAt,
          eventType === 'positive_reply',
          eventType === 'sign_up',
          eventType === 'meeting_booked',
          eventType === 'paying_customer',
          submittedBy,
          notes ? `[Manual ${eventType}] ${notes}` : null,
        ]
      );
    }

    // Also create a domain_event record
    const eventId = randomUUID();
    const eventSourceMap: Record<string, string> = {
      email_sent: 'EMAIL_SENT',
      positive_reply: 'POSITIVE_REPLY',
      sign_up: 'SIGN_UP',
      meeting_booked: 'MEETING_BOOKED',
      paying_customer: 'PAYING_CUSTOMER',
    };
    const eventSource = eventSourceMap[eventType];

    await attrPool.query(
      `INSERT INTO domain_event (
        id, attributed_domain_id, event_source, event_time, email,
        source_id, source_table, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        NULL, 'manual_entry', $6, NOW()
      )`,
      [
        eventId,
        domainId,
        eventSource,
        eventDateParsed,
        contactEmail || null,
        JSON.stringify({ notes, addedBy: submittedBy, manual: true }),
      ]
    );

    // Recalculate attribution for this domain
    // Get the client's attribution window (default 31 days)
    const clientConfigResult = await attrPool.query(
      `SELECT COALESCE(attribution_window_days, 31) as attribution_window_days FROM client_config WHERE id = $1`,
      [clientConfigId]
    );
    const attributionWindowDays = clientConfigResult.rows[0]?.attribution_window_days || 31;

    // Recalculate attribution status based on current domain state
    const attributionResult = await attrPool.query(`
      UPDATE attributed_domain 
      SET 
        -- Recalculate is_within_window based on email sent and first event dates
        is_within_window = CASE 
          WHEN first_email_sent_at IS NOT NULL AND first_event_at IS NOT NULL 
               AND (first_event_at - first_email_sent_at) <= INTERVAL '${attributionWindowDays} days'
          THEN true
          ELSE false
        END,
        -- Recalculate match_type based on whether we have email data
        match_type = CASE 
          WHEN match_type = 'MANUAL' THEN 'MANUAL'  -- Keep manual match type
          WHEN first_email_sent_at IS NOT NULL THEN 'HARD_MATCH'
          ELSE match_type
        END,
        -- Recalculate status based on new is_within_window
        status = CASE
          WHEN status = 'CLIENT_PROMOTED' THEN 'CLIENT_PROMOTED'  -- Keep client-promoted
          WHEN status = 'DISPUTED' THEN 'DISPUTED'  -- Keep disputed
          WHEN first_email_sent_at IS NOT NULL AND first_event_at IS NOT NULL 
               AND (first_event_at - first_email_sent_at) <= INTERVAL '${attributionWindowDays} days'
          THEN 'ATTRIBUTED'
          WHEN first_email_sent_at IS NOT NULL AND first_event_at IS NOT NULL
          THEN 'OUTSIDE_WINDOW'
          WHEN first_email_sent_at IS NULL AND first_event_at IS NOT NULL
          THEN 'UNATTRIBUTED'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING status, is_within_window, match_type
    `, [domainId]);

    const updatedDomain = attributionResult.rows[0];

    return NextResponse.json({
      success: true,
      message: 'Event added successfully',
      domainId,
      domain: cleanDomain,
      eventType,
      eventDate: eventDateParsed.toISOString(),
      attribution: {
        status: updatedDomain?.status,
        isWithinWindow: updatedDomain?.is_within_window,
        matchType: updatedDomain?.match_type,
      },
    });
  } catch (error) {
    console.error('Error adding manual event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}
