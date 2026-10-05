export interface LedgerEvent {
  eventId: string;
  entityId: string;
  entityType: 'PURCHASE_ORDER' | 'VENDOR' | 'DOCUMENT' | 'INVOICE' | 'PAYABLE' | 'PAYMENT' | 'SETTLEMENT' | string;
  eventType:
    | 'PO_CREATED'
    | 'PO_UPDATED'
    | 'PO_ISSUED'
    | 'PO_CANCELLED'
    | 'VENDOR_CREATED'
    | 'VENDOR_UPDATED'
    | 'GOODS_DELIVERED'
    | 'GOODS_RECEIVED'
    | 'GOODS_VERIFIED'
    | string;
  actorId?: string;
  actorRole?: string;
  organizationId?: string;
  amountMinor?: string;
  amountMinorUnits?: string; // backwards compatibility alias
  currency?: string;
  documentHash?: string;
  previousEventHash?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  blockchainTransactionId?: string;
}

export interface BlockchainResult {
  success: boolean;
  transactionId: string;
  blockNumber?: number;
  blockHash?: string;
  timestamp: string;
  errorMessage?: string;
}

export interface VerifyHashResult {
  match: boolean;
  storedHash?: string;
  matchingEvents?: LedgerEvent[];
}

export interface BlockchainHealth {
  provider: string;
  status: 'connected' | 'disconnected' | 'mock' | 'error';
  channel?: string;
  chaincode?: string;
  error?: string;
}

export interface BlockchainService {
  recordEvent(event: LedgerEvent): Promise<BlockchainResult>;
  verifyTransaction(transactionId: string): Promise<boolean>;
  getTransactionHistory(entityId: string): Promise<LedgerEvent[]>;
  verifyDocumentHash(entityId: string, documentHash: string): Promise<VerifyHashResult>;
  getProviderName(): string;
  isHealthy(): Promise<BlockchainHealth>;
  close?(): Promise<void>;
}
