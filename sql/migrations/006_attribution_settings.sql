-- Add per-client attribution settings
-- Version: 1.0.6
-- Purpose: Allow customizable attribution logic per client

-- Attribution mode settings (per_event or per_domain)
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS sign_ups_mode VARCHAR(20) DEFAULT 'per_event';
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS meetings_mode VARCHAR(20) DEFAULT 'per_event';
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS paying_mode VARCHAR(20) DEFAULT 'per_domain';

-- Global attribution settings
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS attribution_window_days INT DEFAULT 31;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS soft_match_enabled BOOLEAN DEFAULT true;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS exclude_personal_domains BOOLEAN DEFAULT true;

-- Add constraint to ensure valid mode values
ALTER TABLE client_config DROP CONSTRAINT IF EXISTS check_sign_ups_mode;
ALTER TABLE client_config ADD CONSTRAINT check_sign_ups_mode CHECK (sign_ups_mode IN ('per_event', 'per_domain'));

ALTER TABLE client_config DROP CONSTRAINT IF EXISTS check_meetings_mode;
ALTER TABLE client_config ADD CONSTRAINT check_meetings_mode CHECK (meetings_mode IN ('per_event', 'per_domain'));

ALTER TABLE client_config DROP CONSTRAINT IF EXISTS check_paying_mode;
ALTER TABLE client_config ADD CONSTRAINT check_paying_mode CHECK (paying_mode IN ('per_event', 'per_domain'));


