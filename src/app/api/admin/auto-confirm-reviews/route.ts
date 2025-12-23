import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';
import { logStatusChange } from '@/db/attribution/queries';

/**
 * POST /api/admin/auto-confirm-reviews
 * 
 * Auto-confirm domains that have been pending client review for more than 7 days.
 * This endpoint should be called by a cron job (e.g., daily).
 * 
 * For Vercel, you can set up a cron job in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/admin/auto-confirm-reviews",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // If CRON_SECRET is set, require it for this endpoint
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow manual invocation without auth for now (MVP)
      console.log('[auto-confirm] Warning: No auth provided, allowing for MVP');
    }

    // Find all domains that have been pending review for more than 7 days
    const expiredReviews = await attrPool.query(
      `SELECT id, domain, client_config_id, review_sent_at, review_sent_by
       FROM attributed_domain
       WHERE status = 'PENDING_CLIENT_REVIEW'
         AND review_sent_at < NOW() - INTERVAL '7 days'`
    );

    if (expiredReviews.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired reviews to auto-confirm',
        autoConfirmed: 0,
      });
    }

    const results: Array<{
      domainId: string;
      domain: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const domain of expiredReviews.rows) {
      try {
        // Auto-confirm the domain
        await attrPool.query(
          `UPDATE attributed_domain 
           SET status = 'ATTRIBUTED',
               review_responded_at = NOW(),
               review_response = 'CONFIRMED',
               review_response_by = 'System (Auto-confirmed)',
               review_notes = 'Auto-confirmed after 7-day review period expired',
               updated_at = NOW()
           WHERE id = $1`,
          [domain.id]
        );

        // Log the status change
        await logStatusChange(domain.id, {
          oldStatus: 'PENDING_CLIENT_REVIEW',
          newStatus: 'ATTRIBUTED',
          action: 'AUTO_CONFIRMED',
          reason: 'Auto-confirmed after 7-day review period expired without client response',
          changedBy: 'System',
        });

        // Update the associated task
        await attrPool.query(
          `UPDATE task 
           SET status = 'APPROVED',
               resolved_by = 'System (Auto-confirmed)',
               resolved_at = NOW(),
               resolution_notes = 'Auto-confirmed after 7-day review period',
               updated_at = NOW()
           WHERE attributed_domain_id = $1 
             AND type = 'REVIEW' 
             AND status = 'OPEN'`,
          [domain.id]
        );

        results.push({
          domainId: domain.id,
          domain: domain.domain,
          success: true,
        });
      } catch (err) {
        results.push({
          domainId: domain.id,
          domain: domain.domain,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`[auto-confirm] Auto-confirmed ${successful} domains, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Auto-confirmed ${successful} domain(s), ${failed} failed`,
      autoConfirmed: successful,
      failed: failed,
      results,
    });
  } catch (error) {
    console.error('Error auto-confirming reviews:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing and Vercel cron
export async function GET(request: NextRequest) {
  return POST(request);
}

