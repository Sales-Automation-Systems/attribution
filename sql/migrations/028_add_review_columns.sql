-- Migration: Add review columns for agency-initiated client review workflow
-- This replaces the old dispute flow (client-initiated) with a new review flow (agency-initiated)

-- Add new review columns to attributed_domain
ALTER TABLE attributed_domain
ADD COLUMN IF NOT EXISTS review_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS review_sent_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS review_responded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS review_response VARCHAR(50),
ADD COLUMN IF NOT EXISTS review_response_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Add index for finding domains pending review
CREATE INDEX IF NOT EXISTS idx_attributed_domain_review_pending 
ON attributed_domain (status, review_sent_at) 
WHERE status = 'PENDING_CLIENT_REVIEW';

-- Update any existing DISPUTE_PENDING records to use the new status
-- (This is a one-time migration for existing data)
UPDATE attributed_domain 
SET status = 'PENDING_CLIENT_REVIEW'
WHERE status = 'DISPUTE_PENDING';

-- Update any existing DISPUTED records to CLIENT_REJECTED
-- (Only those that were client-disputed, not system-disputed)
UPDATE attributed_domain 
SET status = 'CLIENT_REJECTED'
WHERE status = 'DISPUTED';

-- Add comment explaining the review workflow
COMMENT ON COLUMN attributed_domain.review_sent_at IS 'When agency sent this domain for client review';
COMMENT ON COLUMN attributed_domain.review_sent_by IS 'Agency user who sent for review';
COMMENT ON COLUMN attributed_domain.review_responded_at IS 'When client responded to the review';
COMMENT ON COLUMN attributed_domain.review_response IS 'CONFIRMED or REJECTED';
COMMENT ON COLUMN attributed_domain.review_response_by IS 'Client user who responded';
COMMENT ON COLUMN attributed_domain.review_notes IS 'Optional notes from client when rejecting';

