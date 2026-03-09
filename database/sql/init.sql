-- =====================================================
-- CRM Database Initialization Script
-- Creates all required tables for queue, backup, and data storage
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- QUEUE SYSTEM TABLES
-- =====================================================

-- Queue Jobs Table - Stores all queued jobs
CREATE TABLE IF NOT EXISTS queue_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result JSONB,
    created_by VARCHAR(100),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Queue Job Logs - Detailed execution logs
CREATE TABLE IF NOT EXISTS queue_job_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES queue_jobs(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for queue performance
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status ON queue_jobs(status);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_scheduled ON queue_jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_queue_jobs_task_type ON queue_jobs(task_type);
CREATE INDEX IF NOT EXISTS idx_queue_job_logs_job_id ON queue_job_logs(job_id);

-- =====================================================
-- BACKUP SYSTEM TABLES
-- =====================================================

-- Backup Snapshots Table
CREATE TABLE IF NOT EXISTS backup_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    backup_type VARCHAR(50) NOT NULL DEFAULT 'full',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    size_bytes BIGINT DEFAULT 0,
    tables_included TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_backup_type CHECK (backup_type IN ('full', 'incremental', 'differential')),
    CONSTRAINT valid_backup_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'deleted'))
);

-- Backup Data Table - Stores actual backup data as JSONB
CREATE TABLE IF NOT EXISTS backup_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES backup_snapshots(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL,
    row_data JSONB NOT NULL,
    row_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backup Schedule Table
CREATE TABLE IF NOT EXISTS backup_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    schedule_cron VARCHAR(100) NOT NULL,
    backup_type VARCHAR(50) NOT NULL DEFAULT 'full',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Create indexes for backup tables
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_status ON backup_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_created ON backup_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_data_snapshot ON backup_data(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedule_active ON backup_schedule(is_active) WHERE is_active = true;

-- =====================================================
-- CRM DATA TABLES
-- =====================================================

-- Inventory Items Table
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    alias VARCHAR(255),
    item_group VARCHAR(255),
    category VARCHAR(255),
    hsn_code VARCHAR(50),
    gst_rate DECIMAL(5, 2),
    rate DECIMAL(15, 2),
    quantity DECIMAL(15, 3) DEFAULT 0,
    unit VARCHAR(50),
    stock_value DECIMAL(15, 2) DEFAULT 0,
    purchase_rate DECIMAL(15, 2) DEFAULT 0,
    selling_rate DECIMAL(15, 2) DEFAULT 0,
    opening_balance DECIMAL(15, 3) DEFAULT 0,
    opening_value DECIMAL(15, 2) DEFAULT 0,
    closing_value DECIMAL(15, 2) DEFAULT 0,
    tally_guid VARCHAR(100) UNIQUE,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vouchers Table
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_number VARCHAR(100),
    voucher_type VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    party_ledger VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    narration TEXT,
    reference VARCHAR(255),
    due_date DATE,
    is_paid BOOLEAN DEFAULT false,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    unpaid_amount DECIMAL(15, 2) DEFAULT 0,
    tally_guid VARCHAR(100) UNIQUE,
    tally_master_id VARCHAR(100),
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ledgers Table
CREATE TABLE IF NOT EXISTS ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    alias VARCHAR(255),
    parent_group VARCHAR(255),
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    closing_balance DECIMAL(15, 2) DEFAULT 0,
    credit_period INTEGER DEFAULT 0,
    address TEXT,
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    gstin VARCHAR(20),
    pan VARCHAR(20),
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    tally_guid VARCHAR(100) UNIQUE,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync History Table
CREATE TABLE IF NOT EXISTS sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type VARCHAR(50) NOT NULL,
    source VARCHAR(50) NOT NULL,
    destination VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    items_synced INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(100)
);

-- Create indexes for CRM data tables
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tally_guid ON inventory_items(tally_guid);
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(date);
CREATE INDEX IF NOT EXISTS idx_vouchers_type ON vouchers(voucher_type);
CREATE INDEX IF NOT EXISTS idx_vouchers_party ON vouchers(party_ledger);
CREATE INDEX IF NOT EXISTS idx_vouchers_tally_guid ON vouchers(tally_guid);
CREATE INDEX IF NOT EXISTS idx_ledgers_name ON ledgers(name);
CREATE INDEX IF NOT EXISTS idx_ledgers_tally_guid ON ledgers(tally_guid);
CREATE INDEX IF NOT EXISTS idx_sync_history_type ON sync_history(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON sync_history(status);

-- =====================================================
-- SYSTEM CONFIG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100)
);

-- Insert default config values
INSERT INTO system_config (key, value, description) VALUES
    ('backup_retention_days', '30', 'Number of days to retain backups'),
    ('queue_max_retries', '3', 'Maximum retry attempts for failed queue jobs'),
    ('sync_batch_size', '100', 'Number of records to sync per batch'),
    ('auto_backup_enabled', 'true', 'Whether automatic backups are enabled')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DO $$
BEGIN
    -- queue_jobs trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_queue_jobs_updated_at') THEN
        CREATE TRIGGER update_queue_jobs_updated_at
            BEFORE UPDATE ON queue_jobs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- inventory_items trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_inventory_items_updated_at') THEN
        CREATE TRIGGER update_inventory_items_updated_at
            BEFORE UPDATE ON inventory_items
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- vouchers trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_vouchers_updated_at') THEN
        CREATE TRIGGER update_vouchers_updated_at
            BEFORE UPDATE ON vouchers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- ledgers trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ledgers_updated_at') THEN
        CREATE TRIGGER update_ledgers_updated_at
            BEFORE UPDATE ON ledgers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- =====================================================
-- CLEANUP OLD DATA FUNCTION
-- =====================================================

-- Function to clean up old queue jobs and logs
CREATE OR REPLACE FUNCTION cleanup_old_queue_data(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM queue_jobs 
    WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old backups
CREATE OR REPLACE FUNCTION cleanup_old_backups(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Mark old backups as deleted
    UPDATE backup_snapshots 
    SET status = 'deleted'
    WHERE status = 'completed'
    AND created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Actually delete very old snapshots
    DELETE FROM backup_snapshots 
    WHERE status = 'deleted'
    AND created_at < NOW() - ((retention_days * 2) || ' days')::INTERVAL;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================


COMMENT ON TABLE queue_jobs IS 'Persistent queue for async job processing';
COMMENT ON TABLE backup_snapshots IS 'Metadata for database backups';
COMMENT ON TABLE backup_data IS 'Actual backup data stored as JSONB';
COMMENT ON TABLE inventory_items IS 'Synced inventory from Tally';
COMMENT ON TABLE vouchers IS 'Synced vouchers from Tally';
COMMENT ON TABLE ledgers IS 'Synced ledgers from Tally';
COMMENT ON TABLE sync_history IS 'History of all sync operations';

-- =====================================================
-- TALLY SYNC & QUEUE SYSTEM TABLES (for robust integration)
-- =====================================================

-- Task Queue Table
CREATE TABLE IF NOT EXISTS task_queue (
    id VARCHAR(50) PRIMARY KEY,
    task_type VARCHAR(100) NOT NULL,
    task_data TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3
);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status, priority DESC, created_at ASC);

-- Tally Ledgers Table
CREATE TABLE IF NOT EXISTS tally_ledgers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    parent VARCHAR(255),
    opening_balance DECIMAL(20, 2) DEFAULT 0,
    closing_balance DECIMAL(20, 2) DEFAULT 0,
    raw_closing_balance DECIMAL(20, 2) DEFAULT 0,
    on_account_value DECIMAL(20, 2) DEFAULT 0,
    balance_type VARCHAR(5) DEFAULT 'Dr',
    is_debit BOOLEAN DEFAULT TRUE,
    is_credit BOOLEAN DEFAULT FALSE,
    address TEXT,
    email VARCHAR(255),
    phone VARCHAR(50),
    gstin VARCHAR(20),
    gst_type VARCHAR(50),
    place_of_supply VARCHAR(100),
    pan VARCHAR(20),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(20),
    mailing_name VARCHAR(255),
    tally_guid VARCHAR(100),
    pending_tally_sync BOOLEAN DEFAULT FALSE,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ledgers_name ON tally_ledgers(name);
CREATE INDEX IF NOT EXISTS idx_ledgers_parent ON tally_ledgers(parent);
CREATE INDEX IF NOT EXISTS idx_ledgers_gstin ON tally_ledgers(gstin);

-- Tally Stock Items Table
CREATE TABLE IF NOT EXISTS tally_stock_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    alias VARCHAR(255),
    parent VARCHAR(255),
    category VARCHAR(255),
    opening_qty DECIMAL(20, 4) DEFAULT 0,
    opening_rate DECIMAL(20, 4) DEFAULT 0,
    opening_value DECIMAL(20, 2) DEFAULT 0,
    closing_qty DECIMAL(20, 4) DEFAULT 0,
    closing_rate DECIMAL(20, 4) DEFAULT 0,
    closing_value DECIMAL(20, 2) DEFAULT 0,
    unit VARCHAR(50),
    gst_rate DECIMAL(5, 2) DEFAULT 0,
    hsn_code VARCHAR(20),
    tally_guid VARCHAR(100),
    pending_tally_sync BOOLEAN DEFAULT FALSE,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Add alias column if it doesn't exist (for existing installations)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_stock_items' AND column_name = 'alias') THEN
        ALTER TABLE tally_stock_items ADD COLUMN alias VARCHAR(255);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_stock_items_name ON tally_stock_items(name);

-- Tally Vouchers Table
CREATE TABLE IF NOT EXISTS tally_vouchers (
    id SERIAL PRIMARY KEY,
    voucher_number VARCHAR(100),
    voucher_type VARCHAR(100),
    date DATE,
    party_name VARCHAR(255),
    amount DECIMAL(20, 2) DEFAULT 0,
    narration TEXT,
    is_invoice BOOLEAN DEFAULT FALSE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    reference_number VARCHAR(100),
    other_references VARCHAR(255),
    tally_guid VARCHAR(100),
    voucher_data TEXT,
    pending_tally_sync BOOLEAN DEFAULT FALSE,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(voucher_number, voucher_type)
);
-- Add other_references column if it doesn't exist (for existing installations)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_vouchers' AND column_name = 'other_references') THEN
        ALTER TABLE tally_vouchers ADD COLUMN other_references VARCHAR(255);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON tally_vouchers(date);
CREATE INDEX IF NOT EXISTS idx_vouchers_party ON tally_vouchers(party_name);
CREATE INDEX IF NOT EXISTS idx_vouchers_other_ref ON tally_vouchers(other_references);

-- Tally Groups Table
CREATE TABLE IF NOT EXISTS tally_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    parent VARCHAR(255),
    is_revenue BOOLEAN DEFAULT FALSE,
    is_deemedpositive BOOLEAN DEFAULT FALSE,
    affects_gross_profit BOOLEAN DEFAULT FALSE,
    tally_guid VARCHAR(100),
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tally Sync Status Table
CREATE TABLE IF NOT EXISTS tally_sync_status (
    id SERIAL PRIMARY KEY,
    sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ledgers_synced INTEGER DEFAULT 0,
    stock_items_synced INTEGER DEFAULT 0,
    vouchers_synced INTEGER DEFAULT 0,
    groups_synced INTEGER DEFAULT 0,
    status VARCHAR(50),
    errors TEXT
);

-- Sync Queue Table (for changes made in database mode)
CREATE TABLE IF NOT EXISTS sync_queue (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100),
    record_id INTEGER,
    operation VARCHAR(20),
    data TEXT,
    synced_to_tally BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- EMPLOYEE DEALS / SALES TRACKING TABLE
-- Stores voucher amount + employee name (other_references) for target tracking
-- Populated during voucher sync - tracks which employee cracked which deal
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_deals (
    id SERIAL PRIMARY KEY,
    voucher_number VARCHAR(100) NOT NULL,
    voucher_type VARCHAR(100) NOT NULL,
    party_name VARCHAR(255),
    amount DECIMAL(20, 2) DEFAULT 0,
    employee_name VARCHAR(255) NOT NULL,
    date DATE,
    narration TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(voucher_number, voucher_type, employee_name)
);
CREATE INDEX IF NOT EXISTS idx_employee_deals_employee ON employee_deals(employee_name);
CREATE INDEX IF NOT EXISTS idx_employee_deals_date ON employee_deals(date);
CREATE INDEX IF NOT EXISTS idx_employee_deals_type ON employee_deals(voucher_type);
