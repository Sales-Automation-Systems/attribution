-- Migration: Store domain timeline events in attribution DB
-- This allows Vercel to display timelines without needing production DB access

CREATE TABLE IF NOT EXISTS domain_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attributed_domain_id UUID NOT NULL REFERENCES attributed_domain(id) ON DELETE CASCADE,
  client_config_id UUID NOT NULL REFERENCES client_config(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- EMAIL_SENT, POSITIVE_REPLY, SIGN_UP, MEETING_BOOKED, PAYING_CUSTOMER
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  email VARCHAR(255),
  subject TEXT,
  campaign_name VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_domain_event_attributed_domain ON domain_event(attributed_domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_event_client_config ON domain_event(client_config_id);
CREATE INDEX IF NOT EXISTS idx_domain_event_type ON domain_event(event_type);
CREATE INDEX IF NOT EXISTS idx_domain_event_date ON domain_event(event_date);

-- Add comment for documentation
COMMENT ON TABLE domain_event IS 'Timeline events for attributed domains, populated by the worker service';




