-- Migration: 012_last_event_at.sql
-- Description: Add last_event_at column to track most recent event for each domain

-- Add last_event_at column
ALTER TABLE attributed_domain 
ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMP WITH TIME ZONE;

-- Initially populate from first_event_at (will be updated by worker on next run)
UPDATE attributed_domain 
SET last_event_at = first_event_at 
WHERE last_event_at IS NULL AND first_event_at IS NOT NULL;

-- Add index for sorting by most recent activity
CREATE INDEX IF NOT EXISTS idx_attributed_domain_last_event_at 
ON attributed_domain(last_event_at DESC NULLS LAST);

-- Add comment for documentation
COMMENT ON COLUMN attributed_domain.last_event_at IS 'Timestamp of the most recent event (reply, sign-up, meeting, or paying) for this domain';

