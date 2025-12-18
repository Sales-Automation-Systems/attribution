-- Migration: 013_matched_emails_array.sql
-- Description: Add matched_emails array column to support multiple focused contacts per domain

-- Add new array column for multiple matched emails
ALTER TABLE attributed_domain ADD COLUMN IF NOT EXISTS matched_emails TEXT[];

-- Backfill from existing matched_email column
UPDATE attributed_domain 
SET matched_emails = ARRAY[matched_email] 
WHERE matched_email IS NOT NULL AND matched_emails IS NULL;

-- Add GIN index for efficient array queries
CREATE INDEX IF NOT EXISTS idx_attributed_domain_matched_emails 
ON attributed_domain USING GIN(matched_emails);

-- Add comment for documentation
COMMENT ON COLUMN attributed_domain.matched_emails IS 'Array of email addresses that were hard-matched (exact email we contacted had success events)';


