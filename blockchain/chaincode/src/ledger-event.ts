export interface LedgerEvent {
  eventId: string;
  entityId: string;
  entityType: string;
  eventType: string;

  actorId: string;
  actorRole: string;
  organizationId: string;

  amountMinor: string;
  currency: string;

  documentHash?: string;
  previousEventHash?: string;

  metadata?: Record<string, unknown>;

  timestamp: string;

  blockchainTransactionId?: string;
}

export interface VerifyHashResult {
  match: boolean;
  storedHash?: string;
  matchingEvents?: LedgerEvent[];
}

export const VALID_ENTITY_TYPES = [
  'PURCHASE_ORDER',
  'VENDOR',
  'DOCUMENT',
  'INVOICE',
  'PAYABLE',
  'PAYMENT',
  'SETTLEMENT',
  'GOODS_RECEIPT',
] as const;

export const VALID_EVENT_TYPES_PHASE3 = [
  'PO_CREATED',
  'PO_ISSUED',
  'PO_CANCELLED',
  'VENDOR_CREATED',
  'VENDOR_UPDATED',
  'GOODS_RECEIVED',
  'GOODS_VERIFIED',
  'INVOICE_SUBMITTED',
  'INVOICE_VERIFIED',
  'PAYABLE_CREATED',
  'PAYMENT_APPROVED',
  'PAYMENT_INITIATED',
  'PAYMENT_CONFIRMED',
  'SETTLED',
] as const;
