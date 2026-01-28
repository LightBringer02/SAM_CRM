-- Migration: 001_initial_schema.sql
-- Initial schema setup for queue, backup, and CRM tables
-- This migration should be run after init.sql if using incremental migrations

-- Add any additional columns or modifications here

-- Example: Add indexes that weren't in init.sql
CREATE INDEX IF NOT EXISTS idx_queue_jobs_created_by ON queue_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_created_by ON backup_snapshots(created_by);

-- Add queue priorities table for named priority levels
CREATE TABLE IF NOT EXISTS queue_priorities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    level INTEGER NOT NULL,
    description TEXT
);

INSERT INTO queue_priorities (name, level, description) VALUES
    ('critical', 100, 'Critical priority - process immediately'),
    ('high', 75, 'High priority'),
    ('normal', 50, 'Normal priority'),
    ('low', 25, 'Low priority'),
    ('background', 0, 'Background tasks')
ON CONFLICT (name) DO NOTHING;

-- Add fetch_logs table for tracking Tally fetch operations
CREATE TABLE IF NOT EXISTS fetch_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fetch_type VARCHAR(50) NOT NULL,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    items_fetched INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_fetch_logs_type ON fetch_logs(fetch_type);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_started ON fetch_logs(started_at);
