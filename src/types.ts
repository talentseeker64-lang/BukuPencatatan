export type Role =
  | 'ADMIN'
  | 'VENDOR'
  | 'PROCUREMENT_OFFICER'
  | 'PPK'
  | 'FINANCE'
  | 'AUTHORIZED_OFFICER'
  | 'PAYMENT_SYSTEM'
  | 'AUDITOR';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type VendorStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type POStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'VERIFIED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization: {
    id: string;
    name: string;
    code: string;
    address?: string;
  };
}

export interface Vendor {
  id: string;
  vendor_code: string;
  legal_name: string;
  tax_id: string;
  address: string;
  contact_email: string;
  organization_id: string;
  status: VendorStatus;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  total_price: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  buyer_organization_id: string;
  description: string;
  total_amount: string;
  currency: string;
  issue_date: string | null;
  due_date: string;
  status: POStatus;
  blockchain_status: string;
  document_hash?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  vendor?: {
    id: string;
    vendor_code: string;
    legal_name: string;
  };
  buyer_organization?: {
    id: string;
    name: string;
    code: string;
  };
  created_by_user?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  items?: PurchaseOrderItem[];
  audit_events?: ApplicationEvent[];
  blockchain_transactions?: BlockchainTransaction[];
}

export interface ApplicationEvent {
  id: string;
  event_type: string;
  entity_id: string;
  entity_type: string;
  actor_id: string | null;
  organization_id: string | null;
  payload: Record<string, any>;
  status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED';
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface BlockchainTransaction {
  id: string;
  application_event_id: string;
  transaction_id: string;
  event_type: string;
  entity_id: string;
  entity_type: string;
  status: 'CONFIRMED' | 'FAILED';
  error_message: string | null;
  submitted_at: string;
  confirmed_at: string | null;
}

export interface LedgerHistoryEvent {
  event_id: string;
  event_type: string;
  actor_id: string;
  actor_role: string;
  organization_id: string;
  amount_minor: string;
  currency: string;
  timestamp: string;
  blockchain_transaction_id?: string;
}

export interface LedgerHistoryResponse {
  entity_id: string;
  entity_type: string;
  events: LedgerHistoryEvent[];
  source: string;
}

export interface VerifyHashResponse {
  entity_id: string;
  document_hash: string;
  match: boolean;
  stored_hash?: string;
  matching_events?: any[];
  source: string;
}

export interface BlockchainStatusResponse {
  provider: 'fabric' | 'mock' | string;
  provider_name: string;
  channel: string;
  chaincode: string;
  status: string;
  connected?: boolean;
  timestamp: string;
}

export type PayableStatus = 'PAYABLE' | 'APPROVED' | 'PAYMENT_INITIATED' | 'PAID' | 'SETTLED';

export interface PayableApproval {
  step: 'PROCUREMENT_OFFICER' | 'PPK' | 'FINANCE' | 'AUTHORIZED_OFFICER';
  title: string;
  actor_id: string;
  actor_name: string;
  actor_role: Role;
  timestamp: string;
  notes?: string;
}

export interface Payable {
  id: string;
  payable_number: string;
  po_id: string;
  po_number: string;
  vendor_id: string;
  vendor_legal_name: string;
  buyer_organization_id: string;
  amount: string;
  amount_minor: string;
  currency: string;
  period: string; // 'Bulan 1' | 'Bulan 2' | 'Bulan 3' | 'Bulan 4'
  due_date: string;
  status: PayableStatus;
  document_hash: string;
  invoice_number: string;
  invoice_date: string;
  goods_receipt_number?: string;
  payment_reference?: string | null;
  blockchain_tx_id?: string | null;
  approvals: PayableApproval[];
  is_tampered?: boolean;
  tampered_amount?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PeriodBreakdown {
  period: string;
  label: string;
  total_amount: string;
  total_minor: string;
  payable_count: number;
  active_count: number;
  settled_count: number;
  settled_amount: string;
  status: 'ACCUMULATING' | 'READY_FOR_SETTLEMENT' | 'SETTLED';
}

export interface PayableSummary {
  total_active_payable: string;
  total_active_count: number;
  total_settled_amount: string;
  total_settled_count: number;
  total_obligations_all: string;
  period_breakdown: PeriodBreakdown[];
}

export interface TamperAuditResponse {
  payable_id: string;
  payable_number: string;
  vendor_legal_name: string;
  database_amount: string;
  database_hash: string;
  ledger_hash: string;
  is_match: boolean;
  tamper_detected: boolean;
  status: 'VERIFIED_GENUINE' | 'TAMPER_DETECTED';
  message: string;
}

