import crypto from 'crypto';
import {
  BlockchainService,
  BlockchainResult,
  LedgerEvent,
  VerifyHashResult,
  BlockchainHealth,
} from './types.ts';

export class MockBlockchainService implements BlockchainService {
  private transactions: Map<string, LedgerEvent> = new Map();
  private blockHeight: number = 1000;
  private shouldFailNext: boolean = false;
  private failureError: string = 'Simulated Fabric endorsement policy failure';

  public getProviderName(): string {
    return 'MOCK_BLOCKCHAIN';
  }

  /**
   * For testing failure & retry mechanics in unit tests
   */
  public simulateFailureOnNext(shouldFail: boolean, errorMsg?: string) {
    this.shouldFailNext = shouldFail;
    if (errorMsg) this.failureError = errorMsg;
  }

  async recordEvent(event: LedgerEvent): Promise<BlockchainResult> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      return {
        success: false,
        transactionId: '',
        timestamp: new Date().toISOString(),
        errorMessage: this.failureError,
      };
    }

    // Support amountMinor and amountMinorUnits
    const amountMinor = event.amountMinor || event.amountMinorUnits || '0';
    const normalizedEvent: LedgerEvent = {
      ...event,
      amountMinor,
      amountMinorUnits: amountMinor,
    };

    // Generate deterministic yet unique SHA-256 transaction ID
    const seed = `${event.eventId}-${event.entityId}-${event.eventType}-${event.timestamp}-${this.blockHeight}`;
    const txId = `tx_fabric_${crypto.createHash('sha256').update(seed).digest('hex').substring(0, 32)}`;
    const blockHash = crypto.createHash('sha256').update(txId + this.blockHeight).digest('hex');

    this.blockHeight += 1;
    normalizedEvent.blockchainTransactionId = txId;
    this.transactions.set(txId, normalizedEvent);

    return {
      success: true,
      transactionId: txId,
      blockNumber: this.blockHeight,
      blockHash,
      timestamp: new Date().toISOString(),
    };
  }

  async verifyTransaction(transactionId: string): Promise<boolean> {
    return this.transactions.has(transactionId);
  }

  async getTransactionHistory(entityId: string): Promise<LedgerEvent[]> {
    const results: LedgerEvent[] = [];
    for (const event of this.transactions.values()) {
      if (event.entityId === entityId) {
        results.push(event);
      }
    }
    return results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async verifyDocumentHash(entityId: string, documentHash: string): Promise<VerifyHashResult> {
    const events = await this.getTransactionHistory(entityId);
    const matchingEvents: LedgerEvent[] = [];
    let storedHash: string | undefined;

    for (const ev of events) {
      if (ev.documentHash) {
        storedHash = ev.documentHash;
        if (ev.documentHash.toLowerCase() === documentHash.toLowerCase()) {
          matchingEvents.push(ev);
        }
      }
    }

    return {
      match: matchingEvents.length > 0,
      storedHash,
      matchingEvents,
    };
  }

  async isHealthy(): Promise<BlockchainHealth> {
    return {
      provider: 'mock',
      status: 'mock',
      channel: 'mockchannel',
      chaincode: 'procurement-ledger',
    };
  }

  async close(): Promise<void> {
    // No-op for mock service
  }
}
