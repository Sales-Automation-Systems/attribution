-- Migration: 011_client_actions.sql
-- Description: Add support for client actions (disputes, manual attribution, manual events)
-- 
-- New status values:
--   - CLIENT_PROMOTED: Client manually attributed this (UI calls this "Client-Attributed")
--   - OUTSIDE_WINDOW: Event matched but outside 31-day window (replaces using is_within_window)
--   - UNATTRIBUTED: No email match found (replaces NO_MATCH status)
--
-- New match_type value:
--   - MANUAL: Client manually added this event
--
-- New fields for tracking client attributions:
-- (DB columns named promoted_* for historical reasons, UI shows as "attributed")
--   - promoted_at: When the client attributed this domain
--   - promoted_by: Who attributed it (email or user ID)
--   - promotion_notes: Optional notes from the client

-- Add promotion tracking fields to attributed_domain
ALTER TABLE attributed_domain 
ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS promoted_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS promotion_notes TEXT;

-- Add index for finding promoted domains
CREATE INDEX IF NOT EXISTS idx_attributed_domain_promoted_at 
ON attributed_domain(promoted_at) 
WHERE promoted_at IS NOT NULL;

-- Add index for filtering by status (useful for the new multi-status filters)
CREATE INDEX IF NOT EXISTS idx_attributed_domain_status 
ON attributed_domain(status);

-- Add composite index for client + status queries
CREATE INDEX IF NOT EXISTS idx_attributed_domain_client_status 
ON attributed_domain(client_config_id, status);

-- Add comments for documentation
COMMENT ON COLUMN attributed_domain.promoted_at IS 'Timestamp when client promoted this domain to attributed status';
COMMENT ON COLUMN attributed_domain.promoted_by IS 'Email or user ID of who promoted this domain';
COMMENT ON COLUMN attributed_domain.promotion_notes IS 'Optional notes provided when promoting';

-- Note: PostgreSQL doesn't have true ENUMs that can be easily extended.
-- The status and match_type columns are VARCHAR, so we can use any values.
-- The application code enforces the valid values through TypeScript types.
-- 
-- Valid status values after this migration:
--   'ATTRIBUTED' - Within 31-day window, billable
--   'OUTSIDE_WINDOW' - Matched but outside window, not billable unless manually attributed
--   'UNATTRIBUTED' - No email match, not billable unless manually attributed
--   'CLIENT_PROMOTED' - Client manually attributed, billable (UI shows as "Client-Attributed")
--   'DISPUTED' - Client disputed, pending review
--   'REJECTED' - Dispute rejected, still billable
--   'CONFIRMED' - Manually confirmed attribution
--
-- Valid match_type values after this migration:
--   'HARD_MATCH' - Exact email match
--   'SOFT_MATCH' - Domain match only
--   'NO_MATCH' - No match found (legacy, use UNATTRIBUTED status instead)
--   'MANUAL' - Client manually added

