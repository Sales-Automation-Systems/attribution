-- Migration: 014_task_system.sql
-- Description: Create task and task_comment tables for dispute management

-- Core task/dispute table
CREATE TABLE IF NOT EXISTS task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id UUID NOT NULL REFERENCES client_config(id) ON DELETE CASCADE,
  attributed_domain_id UUID REFERENCES attributed_domain(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'DISPUTE' (future: 'RECONCILIATION', 'MANUAL_ATTRIBUTION', etc.)
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'PENDING_INFO', 'APPROVED', 'REJECTED'
  title VARCHAR(255),
  description TEXT, -- Client's dispute reason or task details
  submitted_by VARCHAR(255), -- Client identifier (future: user system)
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_by VARCHAR(255), -- Agency user who resolved
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments/correspondence on tasks
CREATE TABLE IF NOT EXISTS task_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  author_type VARCHAR(20) NOT NULL, -- 'CLIENT' or 'AGENCY'
  author_name VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_task_client_config_id ON task(client_config_id);
CREATE INDEX IF NOT EXISTS idx_task_status ON task(status);
CREATE INDEX IF NOT EXISTS idx_task_type ON task(type);
CREATE INDEX IF NOT EXISTS idx_task_submitted_at ON task(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_attributed_domain_id ON task(attributed_domain_id);
CREATE INDEX IF NOT EXISTS idx_task_comment_task_id ON task_comment(task_id);

-- Comments
COMMENT ON TABLE task IS 'Tasks/tickets for disputes, reconciliation, and other workflows';
COMMENT ON COLUMN task.type IS 'Task type: DISPUTE, RECONCILIATION, MANUAL_ATTRIBUTION, etc.';
COMMENT ON COLUMN task.status IS 'OPEN (new), PENDING_INFO (awaiting client), APPROVED (dispute accepted), REJECTED (dispute denied)';
COMMENT ON TABLE task_comment IS 'Correspondence thread for tasks between client and agency';



