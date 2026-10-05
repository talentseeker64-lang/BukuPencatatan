-- Migration: 001_phase2_init.sql
-- Description: Core Phase 2 tables (Organizations, Users, Vendors, POs, Items, Documents, Application Events, Blockchain Transactions)

CREATE TYPE "Role" AS ENUM (
  'ADMIN',
  'VENDOR',
  'PROCUREMENT_OFFICER',
  'PPK',
  'FINANCE',
  'AUTHORIZED_OFFICER',
  'PAYMENT_SYSTEM',
  'AUDITOR'
);

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'VERIFIED', 'CANCELLED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED');
CREATE TYPE "BlockchainTxStatus" AS ENUM ('SUBMITTED', 'CONFIRMED', 'FAILED');

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) UNIQUE NOT NULL,
    address TEXT,
    contact_email VARCHAR(255),
    status "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role "Role" NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    refresh_token_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_org ON users(organization_id);

-- Vendors table
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_code VARCHAR(64) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(64) NOT NULL,
    address TEXT NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_vendor_code_org UNIQUE (organization_id, vendor_code)
);
CREATE INDEX idx_vendors_org ON vendors(organization_id);

-- Purchase Orders table
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(64) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    buyer_organization_id UUID NOT NULL REFERENCES organizations(id),
    description TEXT NOT NULL,
    total_amount NUMERIC(20, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    issue_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status "POStatus" NOT NULL DEFAULT 'DRAFT',
    blockchain_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_po_number_org UNIQUE (buyer_organization_id, po_number)
);
CREATE INDEX idx_po_buyer_org ON purchase_orders(buyer_organization_id);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_status ON purchase_orders(status);

-- Purchase Order Items table
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(20, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(20, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_po_items_po ON purchase_order_items(po_id);

-- Documents metadata table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_path TEXT NOT NULL,
    sha256_hash CHAR(64) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_documents_entity ON documents(entity_id, entity_type);

-- Application Events (Outbox) table
CREATE TABLE application_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    actor_id UUID,
    organization_id UUID,
    payload JSONB NOT NULL,
    status "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    attempt_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_app_events_status_created ON application_events(status, created_at);
CREATE INDEX idx_app_events_entity ON application_events(entity_id, entity_type);

-- Blockchain Transactions table
CREATE TABLE blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_event_id UUID NOT NULL REFERENCES application_events(id) ON DELETE CASCADE,
    transaction_id VARCHAR(128) UNIQUE NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    status "BlockchainTxStatus" NOT NULL DEFAULT 'CONFIRMED',
    error_message TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_bc_tx_event ON blockchain_transactions(application_event_id);
CREATE INDEX idx_bc_tx_entity ON blockchain_transactions(entity_id);
