-- Fix domains in reconciliation that are missing PAYING_CUSTOMER domain_event records
-- These would have been added via "Add to Reconciliation" before the fix was implemented

-- Create PAYING_CUSTOMER events for line items where:
-- 1. The attributed_domain exists
-- 2. There's no existing PAYING_CUSTOMER event for that domain
-- 3. The line item has a paying_customer_date

INSERT INTO domain_event (
  id,
  attributed_domain_id,
  event_source,
  event_time,
  email,
  source_id,
  source_table,
  metadata,
  created_at
)
SELECT 
  gen_random_uuid(),
  rli.attributed_domain_id,
  'PAYING_CUSTOMER',
  rli.paying_customer_date,
  NULL,
  NULL,
  'manual_entry',
  jsonb_build_object(
    'manual', true,
    'addedBy', 'migration-025',
    'note', 'Created by migration to fix domains added to reconciliation before PAYING_CUSTOMER event was auto-created'
  ),
  NOW()
FROM reconciliation_line_item rli
WHERE rli.attributed_domain_id IS NOT NULL
  AND rli.paying_customer_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM domain_event de
    WHERE de.attributed_domain_id = rli.attributed_domain_id
      AND de.event_source = 'PAYING_CUSTOMER'
  )
GROUP BY rli.attributed_domain_id, rli.paying_customer_date;

-- Also ensure has_paying_customer flag is set on these domains
UPDATE attributed_domain ad
SET has_paying_customer = true,
    updated_at = NOW()
WHERE ad.id IN (
  SELECT DISTINCT attributed_domain_id 
  FROM reconciliation_line_item 
  WHERE attributed_domain_id IS NOT NULL
)
AND has_paying_customer = false;

