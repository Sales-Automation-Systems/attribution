-- Migration: Add unique constraint to prevent duplicate domain events
-- This allows the worker to safely re-run without creating duplicates

-- Add unique constraint on (attributed_domain_id, event_source, source_id)
-- This ensures each event from source tables is only stored once per domain
ALTER TABLE domain_event 
  ADD CONSTRAINT unique_domain_event 
  UNIQUE (attributed_domain_id, event_source, source_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT unique_domain_event ON domain_event IS 'Prevents duplicate events from being stored during reprocessing';


