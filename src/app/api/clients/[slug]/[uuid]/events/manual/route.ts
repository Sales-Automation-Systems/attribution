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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'events/manual/route.ts:14',message:'Request body received',data:{domain,eventType,eventDate,contactEmail:contactEmail?'[provided]':null,notes:notes?'[provided]':null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // TODO: Get submittedBy from auth session in production
    // For now, use placeholder
    const submittedBy = 'client-user@placeholder';

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'events/manual/route.ts:61',message:'Date parsed',data:{eventDate,eventDateParsed:eventDateParsed?.toISOString?.(),isValidDate:!isNaN(eventDateParsed.getTime()),existingDomainCount:existingDomain.rows.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'events/manual/route.ts:108',message:'Existing domain updated',data:{domainId,cleanDomain,eventType,branch:'UPDATE'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
      // #endregion
    } else {
      // Create new domain record
      domainId = randomUUID();

      await attrPool.query(
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
          NOW(), $8, $9,
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
          submittedBy,
          notes ? `[Manual ${eventType}] ${notes}` : null,
        ]
      );
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'events/manual/route.ts:140',message:'New domain created',data:{domainId,cleanDomain,eventType,branch:'INSERT'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
      // #endregion
    }

    // Also create a domain_event record
    const eventId = randomUUID();
    const eventSource =
      eventType === 'sign_up'
        ? 'SIGN_UP'
        : eventType === 'meeting_booked'
          ? 'MEETING_BOOKED'
          : 'PAYING_CUSTOMER';

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'events/manual/route.ts:158',message:'About to insert domain_event',data:{eventId,domainId,eventSource,eventDateParsed:eventDateParsed?.toISOString?.()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'events/manual/route.ts:180',message:'domain_event inserted successfully',data:{eventId,domainId,eventSource},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion

    return NextResponse.json({
      success: true,
      message: 'Event added successfully',
      domainId,
      domain: cleanDomain,
      eventType,
      eventDate: eventDateParsed.toISOString(),
    });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'events/manual/route.ts:catch',message:'Error in manual event handler',data:{error:error instanceof Error ? error.message : String(error),stack:error instanceof Error ? error.stack : null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    console.error('Error adding manual event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}
