import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';
import { logStatusChange } from '@/db/attribution/queries';

/**
 * POST /api/admin/domains/send-for-review
 * 
 * Bulk send multiple domains for client review.
 * Accepts an array of domain IDs.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domainIds, sentBy, notes } = body;

    if (!domainIds || !Array.isArray(domainIds) || domainIds.length === 0) {
      return NextResponse.json(
        { error: 'domainIds array is required' },
        { status: 400 }
      );
    }

    // TODO: Get sentBy from auth session in production
    const reviewSentBy = sentBy || 'agency-admin@placeholder';

    const results: Array<{
      domainId: string;
      domain: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const domainId of domainIds) {
      try {
        // Verify the domain exists
        const domainResult = await attrPool.query(
          `SELECT id, domain, status, client_config_id FROM attributed_domain WHERE id = $1`,
          [domainId]
        );

        if (domainResult.rows.length === 0) {
          results.push({ domainId, domain: '', success: false, error: 'Domain not found' });
          continue;
        }

        const domain = domainResult.rows[0];

        // Skip if already pending review or rejected
        if (domain.status === 'PENDING_CLIENT_REVIEW') {
          results.push({ domainId, domain: domain.domain, success: false, error: 'Already pending review' });
          continue;
        }

        if (domain.status === 'CLIENT_REJECTED') {
          results.push({ domainId, domain: domain.domain, success: false, error: 'Already rejected by client' });
          continue;
        }

        const oldStatus = domain.status;

        // Update the domain status
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

        // Log the status change
        await logStatusChange(domainId, {
          oldStatus: oldStatus,
          newStatus: 'PENDING_CLIENT_REVIEW',
          action: 'SENT_FOR_REVIEW',
          reason: notes || 'Sent for client review by agency (bulk)',
          changedBy: reviewSentBy,
        });

        // Create a task
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

        results.push({ domainId, domain: domain.domain, success: true });
      } catch (err) {
        results.push({
          domainId,
          domain: '',
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Sent ${successful} domain(s) for review, ${failed} failed`,
      results,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error sending domains for review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

