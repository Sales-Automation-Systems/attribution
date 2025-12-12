-- Add top-level stats columns to client_config
-- Version: 1.0.3
-- Purpose: Store aggregated attribution stats per client

-- Total counts from production
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS total_emails_sent BIGINT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS total_positive_replies INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS total_sign_ups INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS total_meetings_booked INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS total_paying_customers INT DEFAULT 0;

-- Attributed counts (matched to our emails)
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS attributed_positive_replies INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS attributed_sign_ups INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS attributed_meetings_booked INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS attributed_paying_customers INT DEFAULT 0;

-- Processing timestamp
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMP;




