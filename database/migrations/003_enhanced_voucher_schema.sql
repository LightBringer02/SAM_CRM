-- Migration: 003_enhanced_voucher_schema.sql
-- Enhanced voucher schema with all tax invoice details
-- This migration adds comprehensive voucher fields for GST-compliant invoices

-- Add new columns to tally_vouchers table for enhanced invoice details
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS delivery_note VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS mode_of_payment VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS reference_no VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS reference_date DATE;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS other_references TEXT;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS buyers_order_no VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS buyers_order_date DATE;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS dispatch_doc_no VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS delivery_note_date DATE;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS dispatched_through VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS destination VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS terms_of_delivery TEXT;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS eway_bill_no VARCHAR(100);

-- Consignee (Ship to) details
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS consignee_name VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS consignee_address TEXT;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS consignee_gstin VARCHAR(20);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS consignee_state VARCHAR(100);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS consignee_state_code VARCHAR(5);

-- Buyer (Bill to) details
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS buyer_address TEXT;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS buyer_gstin VARCHAR(20);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS buyer_state VARCHAR(100);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS buyer_state_code VARCHAR(5);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS is_buyer_registered BOOLEAN DEFAULT FALSE;

-- Place of supply and GST details
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS party_gstin VARCHAR(20);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS party_state VARCHAR(100);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS party_address TEXT;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS company_gstin VARCHAR(20);

-- GST breakup
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS subtotal DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15, 2) DEFAULT 0;

-- Payment details
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS pay_type VARCHAR(50);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS check_number VARCHAR(100);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS bank_ledger VARCHAR(255);

-- Supplier invoice details (for purchase vouchers)
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS basic_invoice_no VARCHAR(255);
ALTER TABLE tally_vouchers ADD COLUMN IF NOT EXISTS basic_shipping_invoice_no VARCHAR(255);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_vouchers_consignee_name ON tally_vouchers(consignee_name);
CREATE INDEX IF NOT EXISTS idx_vouchers_buyer_name ON tally_vouchers(buyer_name);
CREATE INDEX IF NOT EXISTS idx_vouchers_place_of_supply ON tally_vouchers(place_of_supply);
CREATE INDEX IF NOT EXISTS idx_vouchers_party_gstin ON tally_vouchers(party_gstin);
CREATE INDEX IF NOT EXISTS idx_vouchers_pay_type ON tally_vouchers(pay_type);
CREATE INDEX IF NOT EXISTS idx_vouchers_eway_bill ON tally_vouchers(eway_bill_no);

-- Also update the main vouchers table if it exists
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS delivery_note VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS mode_of_payment VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS reference_no VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS reference_date DATE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS other_references TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS buyers_order_no VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS buyers_order_date DATE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS dispatch_doc_no VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS delivery_note_date DATE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS dispatched_through VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS destination VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS terms_of_delivery TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS eway_bill_no VARCHAR(100);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS consignee_name VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS consignee_address TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS consignee_gstin VARCHAR(20);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS consignee_state VARCHAR(100);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS consignee_state_code VARCHAR(5);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS buyer_address TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS buyer_gstin VARCHAR(20);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS buyer_state VARCHAR(100);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS buyer_state_code VARCHAR(5);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_buyer_registered BOOLEAN DEFAULT FALSE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS party_gstin VARCHAR(20);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS party_state VARCHAR(100);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS party_address TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS company_gstin VARCHAR(20);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS subtotal DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS pay_type VARCHAR(50);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS check_number VARCHAR(100);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS bank_ledger VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS basic_invoice_no VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS basic_shipping_invoice_no VARCHAR(255);

-- Comments for documentation
COMMENT ON COLUMN tally_vouchers.delivery_note IS 'Delivery note number';
COMMENT ON COLUMN tally_vouchers.mode_of_payment IS 'Mode or terms of payment';
COMMENT ON COLUMN tally_vouchers.buyers_order_no IS 'Buyer purchase order number';
COMMENT ON COLUMN tally_vouchers.dispatch_doc_no IS 'Dispatch document number';
COMMENT ON COLUMN tally_vouchers.dispatched_through IS 'Transporter or carrier name';
COMMENT ON COLUMN tally_vouchers.destination IS 'Delivery destination';
COMMENT ON COLUMN tally_vouchers.eway_bill_no IS 'E-Way Bill number for transport';
COMMENT ON COLUMN tally_vouchers.consignee_name IS 'Ship-to party name';
COMMENT ON COLUMN tally_vouchers.buyer_name IS 'Bill-to party name';
COMMENT ON COLUMN tally_vouchers.is_buyer_registered IS 'Whether buyer has valid GSTIN';
COMMENT ON COLUMN tally_vouchers.place_of_supply IS 'Place of supply for GST';
