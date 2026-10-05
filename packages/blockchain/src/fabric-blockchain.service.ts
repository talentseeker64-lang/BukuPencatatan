import {
  BlockchainService,
  BlockchainResult,
  LedgerEvent,
  VerifyHashResult,
  BlockchainHealth,
} from './types.ts';
import { FabricConnectionManager } from './fabric-connection.manager.ts';

export class FabricBlockchainService implements BlockchainService {
  private connectionManager: FabricConnectionManager;
  private channelName: string;
  private chaincodeName: string;

  constructor(customConnectionManager?: FabricConnectionManager) {
    this.connectionManager = customConnectionManager || FabricConnectionManager.getInstance();
    const config = this.connectionManager.getConfig();
    this.channelName = config.channelName;
    this.chaincodeName = config.chaincodeName;
  }

  public getProviderName(): string {
    return 'HYPERLEDGER_FABRIC';
  }

  /**
   * Submits a transaction proposal, awaits endorsement, sends to ordering service,
   * and awaits commitment from peer ledger.
   */
  async recordEvent(event: LedgerEvent): Promise<BlockchainResult> {
    try {
      const contract = await this.connectionManager.connect();

      // Normalize monetary minor units
      const amountMinor = event.amountMinor || event.amountMinorUnits || '0';
      const normalizedPayload: LedgerEvent = {
        ...event,
        amountMinor,
        amountMinorUnits: amountMinor,
      };

      // Ensure amountMinor format is purely integer string
      if (!/^\d+$/.test(normalizedPayload.amountMinor)) {
        throw new Error(
          `amountMinor '${normalizedPayload.amountMinor}' is invalid: must be an integer string of minor units`
        );
      }

      // Submit transaction via Gateway (handles Proposal -> Endorsement -> Ordering -> Commit)
      const resultBytes = await contract.submitTransaction(
        'recordEvent',
        JSON.stringify(normalizedPayload)
      );

      const resultJson = Buffer.from(resultBytes).toString('utf8');
      const parsed = JSON.parse(resultJson);

      if (!parsed.success) {
        throw new Error(parsed.message || 'Chaincode transaction rejected');
      }

      return {
        success: true,
        transactionId: parsed.transactionId,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('[FabricBlockchainService] Failed to record event:', err.message);
      return {
        success: false,
        transactionId: '',
        timestamp: new Date().toISOString(),
        errorMessage: err.message,
      };
    }
  }

  /**
   * Verifies if an event exists on ledger
   */
  async verifyTransaction(transactionId: string): Promise<boolean> {
    try {
      const contract = await this.connectionManager.connect();
      const resultBytes = await contract.evaluateTransaction('eventExists', transactionId);
      const res = JSON.parse(Buffer.from(resultBytes).toString('utf8'));
      return !!res;
    } catch {
      return false;
    }
  }

  /**
   * Evaluates query transaction for entity history across all chaincode peers
   */
  async getTransactionHistory(entityId: string, entityType: string = 'PURCHASE_ORDER'): Promise<LedgerEvent[]> {
    try {
      const contract = await this.connectionManager.connect();
      const resultBytes = await contract.evaluateTransaction(
        'getEntityHistory',
        entityType,
        entityId
      );
      const json = Buffer.from(resultBytes).toString('utf8');
      const events: LedgerEvent[] = JSON.parse(json);
      return events;
    } catch (err: any) {
      console.error('[FabricBlockchainService] Failed to get entity history:', err.message);
      return [];
    }
  }

  /**
   * Verifies document cryptographic hash on ledger
   */
  async verifyDocumentHash(entityId: string, documentHash: string): Promise<VerifyHashResult> {
    try {
      const contract = await this.connectionManager.connect();
      const resultBytes = await contract.evaluateTransaction(
        'verifyDocumentHash',
        entityId,
        documentHash
      );
      const json = Buffer.from(resultBytes).toString('utf8');
      return JSON.parse(json);
    } catch (err: any) {
      return {
        match: false,
        storedHash: undefined,
        matchingEvents: [],
      };
    }
  }

  async isHealthy(): Promise<BlockchainHealth> {
    try {
      await this.connectionManager.connect();
      return {
        provider: 'fabric',
        status: 'connected',
        channel: this.channelName,
        chaincode: this.chaincodeName,
      };
    } catch (err: any) {
      return {
        provider: 'fabric',
        status: 'error',
        channel: this.channelName,
        chaincode: this.chaincodeName,
        error: err.message,
      };
    }
  }

  async close(): Promise<void> {
    await this.connectionManager.close();
  }
}
