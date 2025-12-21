// Reconciliation Database Queries

import { attrPool } from '@/db';
import type {
  ClientBillingConfig,
  ReconciliationPeriod,
  ReconciliationLineItem,
  ReconciliationPeriodWithClient,
  CreatePeriodInput,
  BillingConfigInput,
  PeriodStatus,
  LineItemStatus,
  MotionType,
} from './reconciliation-types';

// ============ Client Billing Config ============

export async function getBillingConfig(clientConfigId: string): Promise<ClientBillingConfig | null> {
  const result = await attrPool.query<ClientBillingConfig>(
    `SELECT * FROM client_billing_config WHERE client_config_id = $1`,
    [clientConfigId]
  );
  return result.rows[0] || null;
}

export async function upsertBillingConfig(
  clientConfigId: string,
  config: BillingConfigInput
): Promise<ClientBillingConfig> {
  const result = await attrPool.query<ClientBillingConfig>(
    `INSERT INTO client_billing_config (
      client_config_id, billing_model, flat_revshare_rate, plg_revshare_rate,
      sales_revshare_rate, fee_per_signup, fee_per_meeting, default_period_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (client_config_id) DO UPDATE SET
      billing_model = EXCLUDED.billing_model,
      flat_revshare_rate = EXCLUDED.flat_revshare_rate,
      plg_revshare_rate = EXCLUDED.plg_revshare_rate,
      sales_revshare_rate = EXCLUDED.sales_revshare_rate,
      fee_per_signup = EXCLUDED.fee_per_signup,
      fee_per_meeting = EXCLUDED.fee_per_meeting,
      default_period_type = EXCLUDED.default_period_type,
      updated_at = NOW()
    RETURNING *`,
    [
      clientConfigId,
      config.billing_model,
      config.flat_revshare_rate ?? null,
      config.plg_revshare_rate ?? null,
      config.sales_revshare_rate ?? null,
      config.fee_per_signup ?? 0,
      config.fee_per_meeting ?? 0,
      config.default_period_type ?? 'monthly',
    ]
  );
  return result.rows[0];
}

// ============ Reconciliation Periods ============

export async function createPeriod(input: CreatePeriodInput): Promise<ReconciliationPeriod> {
  const result = await attrPool.query<ReconciliationPeriod>(
    `INSERT INTO reconciliation_period (
      client_config_id, period_start, period_end, period_label
    ) VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [input.client_config_id, input.period_start, input.period_end, input.period_label || null]
  );
  return result.rows[0];
}

export async function getPeriod(periodId: string): Promise<ReconciliationPeriod | null> {
  const result = await attrPool.query<ReconciliationPeriod>(
    `SELECT * FROM reconciliation_period WHERE id = $1`,
    [periodId]
  );
  return result.rows[0] || null;
}

export async function getPeriodWithClient(periodId: string): Promise<ReconciliationPeriodWithClient | null> {
  const result = await attrPool.query<ReconciliationPeriodWithClient>(
    `SELECT rp.*, cc.client_name, cc.slug as client_slug
     FROM reconciliation_period rp
     JOIN client_config cc ON rp.client_config_id = cc.id
     WHERE rp.id = $1`,
    [periodId]
  );
  return result.rows[0] || null;
}

export async function getPeriodsForClient(clientConfigId: string): Promise<ReconciliationPeriod[]> {
  const result = await attrPool.query<ReconciliationPeriod>(
    `SELECT * FROM reconciliation_period 
     WHERE client_config_id = $1 
     ORDER BY period_start DESC`,
    [clientConfigId]
  );
  return result.rows;
}

export async function getAllPeriods(status?: PeriodStatus): Promise<ReconciliationPeriodWithClient[]> {
  let query = `
    SELECT rp.*, cc.client_name, cc.slug as client_slug
    FROM reconciliation_period rp
    JOIN client_config cc ON rp.client_config_id = cc.id
  `;
  const params: string[] = [];
  
  if (status) {
    query += ` WHERE rp.status = $1`;
    params.push(status);
  }
  
  query += ` ORDER BY rp.created_at DESC`;
  
  const result = await attrPool.query<ReconciliationPeriodWithClient>(query, params);
  return result.rows;
}

export async function updatePeriodStatus(
  periodId: string,
  status: PeriodStatus,
  additionalFields?: {
    sent_to_client_at?: Date;
    client_submitted_at?: Date;
    finalized_at?: Date;
    finalized_by?: string;
  }
): Promise<ReconciliationPeriod> {
  const updates: string[] = ['status = $2', 'updated_at = NOW()'];
  const params: (string | Date)[] = [periodId, status];
  let paramIndex = 3;

  if (additionalFields?.sent_to_client_at) {
    updates.push(`sent_to_client_at = $${paramIndex++}`);
    params.push(additionalFields.sent_to_client_at);
  }
  if (additionalFields?.client_submitted_at) {
    updates.push(`client_submitted_at = $${paramIndex++}`);
    params.push(additionalFields.client_submitted_at);
  }
  if (additionalFields?.finalized_at) {
    updates.push(`finalized_at = $${paramIndex++}`);
    params.push(additionalFields.finalized_at);
  }
  if (additionalFields?.finalized_by) {
    updates.push(`finalized_by = $${paramIndex++}`);
    params.push(additionalFields.finalized_by);
  }

  const result = await attrPool.query<ReconciliationPeriod>(
    `UPDATE reconciliation_period SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function updatePeriodTotals(
  periodId: string,
  totals: {
    total_revenue_submitted: number;
    total_amount_owed: number;
    total_signups_billed: number;
    total_meetings_billed: number;
    total_paying_customers: number;
  }
): Promise<void> {
  await attrPool.query(
    `UPDATE reconciliation_period SET
      total_revenue_submitted = $2,
      total_amount_owed = $3,
      total_signups_billed = $4,
      total_meetings_billed = $5,
      total_paying_customers = $6,
      updated_at = NOW()
     WHERE id = $1`,
    [
      periodId,
      totals.total_revenue_submitted,
      totals.total_amount_owed,
      totals.total_signups_billed,
      totals.total_meetings_billed,
      totals.total_paying_customers,
    ]
  );
}

export async function deletePeriod(periodId: string): Promise<void> {
  await attrPool.query(`DELETE FROM reconciliation_period WHERE id = $1`, [periodId]);
}

// ============ Line Items ============

export async function getLineItems(periodId: string): Promise<ReconciliationLineItem[]> {
  const result = await attrPool.query<ReconciliationLineItem>(
    `SELECT * FROM reconciliation_line_item 
     WHERE reconciliation_period_id = $1 
     ORDER BY domain`,
    [periodId]
  );
  return result.rows;
}

export async function getLineItem(lineItemId: string): Promise<ReconciliationLineItem | null> {
  const result = await attrPool.query<ReconciliationLineItem>(
    `SELECT * FROM reconciliation_line_item WHERE id = $1`,
    [lineItemId]
  );
  return result.rows[0] || null;
}

export async function createLineItem(
  periodId: string,
  item: {
    attributed_domain_id: string;
    domain: string;
    motion_type: MotionType | null;
    has_signup: boolean;
    has_meeting: boolean;
    has_paying_customer: boolean;
    paying_customer_date: Date | null;
  }
): Promise<ReconciliationLineItem> {
  const result = await attrPool.query<ReconciliationLineItem>(
    `INSERT INTO reconciliation_line_item (
      reconciliation_period_id, attributed_domain_id, domain, motion_type,
      has_signup, has_meeting, has_paying_customer, paying_customer_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (reconciliation_period_id, domain) DO UPDATE SET
      attributed_domain_id = EXCLUDED.attributed_domain_id,
      motion_type = EXCLUDED.motion_type,
      has_signup = EXCLUDED.has_signup,
      has_meeting = EXCLUDED.has_meeting,
      has_paying_customer = EXCLUDED.has_paying_customer,
      paying_customer_date = EXCLUDED.paying_customer_date,
      updated_at = NOW()
    RETURNING *`,
    [
      periodId,
      item.attributed_domain_id,
      item.domain,
      item.motion_type,
      item.has_signup,
      item.has_meeting,
      item.has_paying_customer,
      item.paying_customer_date,
    ]
  );
  return result.rows[0];
}

export async function updateLineItemRevenue(
  lineItemId: string,
  revenue_collected: number,
  revenue_notes?: string
): Promise<ReconciliationLineItem> {
  const result = await attrPool.query<ReconciliationLineItem>(
    `UPDATE reconciliation_line_item SET
      revenue_collected = $2,
      revenue_notes = $3,
      status = 'SUBMITTED',
      updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [lineItemId, revenue_collected, revenue_notes || null]
  );
  return result.rows[0];
}

export async function updateLineItemCalculation(
  lineItemId: string,
  calculated_fee: number,
  applied_rate: number | null
): Promise<void> {
  await attrPool.query(
    `UPDATE reconciliation_line_item SET
      calculated_fee = $2,
      applied_rate = $3,
      updated_at = NOW()
     WHERE id = $1`,
    [lineItemId, calculated_fee, applied_rate]
  );
}

export async function updateLineItemStatus(
  lineItemId: string,
  status: LineItemStatus,
  disputeReason?: string
): Promise<ReconciliationLineItem> {
  const result = await attrPool.query<ReconciliationLineItem>(
    `UPDATE reconciliation_line_item SET
      status = $2,
      dispute_reason = $3,
      updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [lineItemId, status, disputeReason || null]
  );
  return result.rows[0];
}

export async function resolveLineItemDispute(
  lineItemId: string,
  status: 'CONFIRMED' | 'PENDING',
  resolutionNotes: string
): Promise<ReconciliationLineItem> {
  const result = await attrPool.query<ReconciliationLineItem>(
    `UPDATE reconciliation_line_item SET
      status = $2,
      dispute_resolved_at = NOW(),
      dispute_resolution_notes = $3,
      updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [lineItemId, status, resolutionNotes]
  );
  return result.rows[0];
}

// ============ Populate Line Items from Attributed Domains ============

export async function populateLineItemsFromDomains(
  periodId: string,
  clientConfigId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  // Get all attributed domains that had events in this period
  const result = await attrPool.query<{
    id: string;
    domain: string;
    has_sign_up: boolean;
    has_meeting_booked: boolean;
    has_paying_customer: boolean;
    first_event_at: Date | null;
  }>(
    `SELECT id, domain, has_sign_up, has_meeting_booked, has_paying_customer, first_event_at
     FROM attributed_domain
     WHERE client_config_id = $1
       AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED')
       AND (has_sign_up = true OR has_meeting_booked = true OR has_paying_customer = true)
       AND first_event_at >= $2
       AND first_event_at <= $3`,
    [clientConfigId, periodStart, periodEnd]
  );

  // Insert each as a line item
  for (const domain of result.rows) {
    const motionType: MotionType | null = domain.has_paying_customer
      ? (domain.has_meeting_booked ? 'SALES' : 'PLG')
      : null;

    await createLineItem(periodId, {
      attributed_domain_id: domain.id,
      domain: domain.domain,
      motion_type: motionType,
      has_signup: domain.has_sign_up,
      has_meeting: domain.has_meeting_booked,
      has_paying_customer: domain.has_paying_customer,
      paying_customer_date: domain.has_paying_customer ? domain.first_event_at : null,
    });
  }

  return result.rows.length;
}

// ============ Calculation Helpers ============

/**
 * Calculate the fee for a line item based on the client's billing configuration.
 * 
 * Supports multiple billing models:
 * 1. flat_revshare: Single rev share rate applied to all paying customers
 * 2. plg_sales_split: Different rev share rates for PLG vs Sales motion types
 * 
 * Additionally supports per-event fees:
 * - fee_per_signup: Multiplied by signup_count for each signup in the period
 * - fee_per_meeting: Multiplied by meeting_count for each meeting in the period
 * 
 * Total fee = (revenue × revshare_rate) + (signup_count × fee_per_signup) + (meeting_count × fee_per_meeting)
 */
export async function calculateAndUpdateLineItemFee(
  lineItem: ReconciliationLineItem,
  billingConfig: ClientBillingConfig
): Promise<number> {
  let calculatedFee = 0;
  let appliedRate: number | null = null;

  // 1. Calculate RevShare fee (only for paying customers with submitted revenue)
  if (lineItem.has_paying_customer && lineItem.revenue_collected) {
    if (billingConfig.billing_model === 'flat_revshare' && billingConfig.flat_revshare_rate) {
      appliedRate = billingConfig.flat_revshare_rate;
      calculatedFee += lineItem.revenue_collected * appliedRate;
    } else if (billingConfig.billing_model === 'plg_sales_split') {
      if (lineItem.motion_type === 'PLG' && billingConfig.plg_revshare_rate) {
        appliedRate = billingConfig.plg_revshare_rate;
        calculatedFee += lineItem.revenue_collected * appliedRate;
      } else if (lineItem.motion_type === 'SALES' && billingConfig.sales_revshare_rate) {
        appliedRate = billingConfig.sales_revshare_rate;
        calculatedFee += lineItem.revenue_collected * appliedRate;
      }
    }
  }

  // 2. Add per-signup fees (multiply fee by signup count)
  // Use signup_count if available, otherwise fall back to has_signup boolean
  if (billingConfig.fee_per_signup > 0) {
    const signupCount = (lineItem as { signup_count?: number }).signup_count;
    if (signupCount && signupCount > 0) {
      calculatedFee += billingConfig.fee_per_signup * signupCount;
    } else if (lineItem.has_signup) {
      // Fallback for legacy line items without signup_count
      calculatedFee += billingConfig.fee_per_signup;
    }
  }

  // 3. Add per-meeting fees (multiply fee by meeting count)
  // Use meeting_count if available, otherwise fall back to has_meeting boolean
  if (billingConfig.fee_per_meeting > 0) {
    const meetingCount = (lineItem as { meeting_count?: number }).meeting_count;
    if (meetingCount && meetingCount > 0) {
      calculatedFee += billingConfig.fee_per_meeting * meetingCount;
    } else if (lineItem.has_meeting) {
      // Fallback for legacy line items without meeting_count
      calculatedFee += billingConfig.fee_per_meeting;
    }
  }

  // Update the line item with calculated values
  await updateLineItemCalculation(lineItem.id, calculatedFee, appliedRate);

  return calculatedFee;
}

export async function recalculatePeriodTotals(periodId: string): Promise<void> {
  const lineItems = await getLineItems(periodId);
  
  const totals = {
    total_revenue_submitted: 0,
    total_amount_owed: 0,
    total_signups_billed: 0,
    total_meetings_billed: 0,
    total_paying_customers: 0,
  };

  for (const item of lineItems) {
    if (item.revenue_collected) {
      totals.total_revenue_submitted += item.revenue_collected;
    }
    totals.total_amount_owed += item.calculated_fee || 0;
    
    // Use count fields if available, otherwise fall back to boolean flags
    const itemWithCounts = item as { signup_count?: number; meeting_count?: number };
    if (itemWithCounts.signup_count && itemWithCounts.signup_count > 0) {
      totals.total_signups_billed += itemWithCounts.signup_count;
    } else if (item.has_signup) {
      totals.total_signups_billed++;
    }
    
    if (itemWithCounts.meeting_count && itemWithCounts.meeting_count > 0) {
      totals.total_meetings_billed += itemWithCounts.meeting_count;
    } else if (item.has_meeting) {
      totals.total_meetings_billed++;
    }
    
    if (item.has_paying_customer) {
      totals.total_paying_customers++;
    }
  }

  await updatePeriodTotals(periodId, totals);
}

