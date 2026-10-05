import { BlockchainService } from './types.ts';
import { MockBlockchainService } from './mock-blockchain.service.ts';
import { FabricBlockchainService } from './fabric-blockchain.service.ts';

export class BlockchainFactory {
  private static instance: BlockchainService | null = null;
  private static forcedProvider: 'fabric' | 'mock' | null = null;

  public static setForcedProvider(provider: 'fabric' | 'mock' | null) {
    BlockchainFactory.forcedProvider = provider;
    BlockchainFactory.instance = null; // reset cached instance
  }

  public static getBlockchainService(): BlockchainService {
    if (!BlockchainFactory.instance) {
      const provider =
        BlockchainFactory.forcedProvider ||
        process.env.BLOCKCHAIN_PROVIDER ||
        (process.env.FABRIC_ENABLED === 'true' ? 'fabric' : 'mock');

      if (provider.toLowerCase() === 'fabric') {
        BlockchainFactory.instance = new FabricBlockchainService();
      } else {
        BlockchainFactory.instance = new MockBlockchainService();
      }
    }
    return BlockchainFactory.instance;
  }

  public static reset() {
    BlockchainFactory.instance = null;
    BlockchainFactory.forcedProvider = null;
  }
}
