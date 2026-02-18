-- Migration: Enhanced Ledger Schema
-- Adds additional fields for proper balance handling and GST compliance

-- Add new columns to tally_ledgers table
DO $$ 
BEGIN 
    -- Add raw_closing_balance column (original value from Tally)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'raw_closing_balance') THEN
        ALTER TABLE tally_ledgers ADD COLUMN raw_closing_balance DECIMAL(20, 2) DEFAULT 0;
    END IF;
    
    -- Add on_account_value column (transaction totals)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'on_account_value') THEN
        ALTER TABLE tally_ledgers ADD COLUMN on_account_value DECIMAL(20, 2) DEFAULT 0;
    END IF;
    
    -- Add balance_type column (Dr/Cr indicator)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'balance_type') THEN
        ALTER TABLE tally_ledgers ADD COLUMN balance_type VARCHAR(5) DEFAULT 'Dr';
    END IF;
    
    -- Add is_debit column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'is_debit') THEN
        ALTER TABLE tally_ledgers ADD COLUMN is_debit BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Add is_credit column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'is_credit') THEN
        ALTER TABLE tally_ledgers ADD COLUMN is_credit BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add gst_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'gst_type') THEN
        ALTER TABLE tally_ledgers ADD COLUMN gst_type VARCHAR(50);
    END IF;
    
    -- Add place_of_supply column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'place_of_supply') THEN
        ALTER TABLE tally_ledgers ADD COLUMN place_of_supply VARCHAR(100);
    END IF;
    
    -- Add country column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'country') THEN
        ALTER TABLE tally_ledgers ADD COLUMN country VARCHAR(100) DEFAULT 'India';
    END IF;
    
    -- Add pincode column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'pincode') THEN
        ALTER TABLE tally_ledgers ADD COLUMN pincode VARCHAR(20);
    END IF;
    
    -- Add mailing_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tally_ledgers' AND column_name = 'mailing_name') THEN
        ALTER TABLE tally_ledgers ADD COLUMN mailing_name VARCHAR(255);
    END IF;
END $$;

-- Create index on parent for faster group filtering
CREATE INDEX IF NOT EXISTS idx_ledgers_parent ON tally_ledgers(parent);

-- Create index on gstin for GST lookups
CREATE INDEX IF NOT EXISTS idx_ledgers_gstin ON tally_ledgers(gstin);

-- Comment on columns for documentation
COMMENT ON COLUMN tally_ledgers.raw_closing_balance IS 'Original closing balance from Tally (negative for debit accounts)';
COMMENT ON COLUMN tally_ledgers.closing_balance IS 'Display-friendly closing balance (positive for receivables)';
COMMENT ON COLUMN tally_ledgers.balance_type IS 'Balance type: Dr (Debit) or Cr (Credit)';
COMMENT ON COLUMN tally_ledgers.on_account_value IS 'On account transaction value from Tally';
