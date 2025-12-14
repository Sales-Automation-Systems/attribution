-- Migration: Persist worker jobs to database
-- Jobs persist across worker restarts

CREATE TABLE IF NOT EXISTS worker_job (
  id VARCHAR(100) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  progress_current INTEGER,
  progress_total INTEGER,
  current_client VARCHAR(255),
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_job_status ON worker_job(status);
CREATE INDEX IF NOT EXISTS idx_worker_job_started_at ON worker_job(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_job_type ON worker_job(type);

COMMENT ON TABLE worker_job IS 'Persists worker job history across restarts';

