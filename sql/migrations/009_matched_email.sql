-- Migration: Add matched_email column to attributed_domain
-- This stores the specific email address that was hard-matched for Focus View filtering

ALTER TABLE attributed_domain ADD COLUMN IF NOT EXISTS matched_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_attributed_domain_matched_email ON attributed_domain(matched_email);

COMMENT ON COLUMN attributed_domain.matched_email IS 'The specific email address that was hard-matched (for Focus View filtering)';




