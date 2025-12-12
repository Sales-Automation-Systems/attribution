-- Add outside_window breakdown columns
-- Version: 1.0.5
-- Purpose: Separate "outside 31-day window" from "never emailed"

-- Outside window counts (we emailed them, but event > 31 days after)
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS outside_window_sign_ups INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS outside_window_meetings INT DEFAULT 0;
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS outside_window_paying INT DEFAULT 0;




