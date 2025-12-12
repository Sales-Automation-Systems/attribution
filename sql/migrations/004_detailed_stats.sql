-- Add detailed hard/soft breakdown per event type
-- Version: 1.0.4
-- Purpose: Track attribution match type breakdown for each event category

-- Hard match counts per event type
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS hard_match_positive_replies INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS hard_match_sign_ups INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS hard_match_meetings INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS hard_match_paying INT DEFAULT 0;

-- Soft match counts per event type
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS soft_match_positive_replies INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS soft_match_sign_ups INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS soft_match_meetings INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS soft_match_paying INT DEFAULT 0;

-- Not matched counts (events that happened but we can't attribute)
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS not_matched_sign_ups INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS not_matched_meetings INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS not_matched_paying INT DEFAULT 0;

-- Domain breakdown counts
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS domains_with_replies INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS domains_with_signups INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS domains_with_meetings INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS domains_with_paying INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS domains_with_multiple_events INT DEFAULT 0;

