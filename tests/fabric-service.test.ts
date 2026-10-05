import { FabricBlockchainService } from '../packages/blockchain/src/fabric-blockchain.service.ts';
import { LedgerEvent } from '../packages/blockchain/src/types.ts';

export async function runFabricServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
      throw new Error(msg);
    } else {
      console.log(`  ✓ ${msg}`);
      passed++;
    }
  }

  console.log('\x1b[36m=== Suite: FabricBlockchainService & Gateway Integration ===\x1b[0m');

  const fabricService = new FabricBlockchainService();

  // Test 1: Provider Name and Health
  {
    assert(fabricService.getProviderName() === 'HYPERLEDGER_FABRIC', 'Provider name is HYPERLEDGER_FABRIC');
    const health = await fabricService.isHealthy();
    assert(health.provider === 'fabric', 'Health check reports fabric provider');
    assert(health.channel === 'procurementchannel', 'Health check reports procurementchannel');
    assert(health.chaincode === 'procurement-ledger', 'Health check reports procurement-ledger chaincode');
  }

  // Test 2: Record Event & Transaction ID Retrieval
  let testTxId = '';
  {
    const event: LedgerEvent = {
      eventId: 'evt-fabric-svc-001',
      entityId: 'po-fabric-001',
      entityType: 'PURCHASE_ORDER',
      eventType: 'PO_CREATED',
      actorId: 'usr-001',
      actorRole: 'PROCUREMENT_OFFICER',
      organizationId: 'ORG-001',
      amountMinor: '15000000000', // Rp150,000,000.00
      currency: 'IDR',
      documentHash: 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
      metadata: { poNumber: 'PO-FAB-001' },
      timestamp: '2026-09-24T10:00:00.000Z',
    };

    const res = await fabricService.recordEvent(event);
    assert(res.success === true, 'Fabric recordEvent returns success: true');
    assert(!!res.transactionId, 'Fabric recordEvent returns real Fabric transaction ID');
    assert(res.transactionId.startsWith('tx_fabric_'), 'Transaction ID follows Fabric naming pattern');
    testTxId = res.transactionId;
  }

  // Test 3: Idempotent Resubmission
  {
    const duplicateEvent: LedgerEvent = {
      eventId: 'evt-fabric-svc-001',
      entityId: 'po-fabric-001',
      entityType: 'PURCHASE_ORDER',
      eventType: 'PO_CREATED',
      actorId: 'usr-001',
      actorRole: 'PROCUREMENT_OFFICER',
      organizationId: 'ORG-001',
      amountMinor: '15000000000',
      currency: 'IDR',
      timestamp: '2026-09-24T10:00:00.000Z',
    };

    const res2 = await fabricService.recordEvent(duplicateEvent);
    assert(res2.success === true, 'Resubmission returns success: true without error');
    assert(res2.transactionId === testTxId, 'Idempotent resubmission preserves original transaction ID');
  }

  // Test 4: Query Entity History from Ledger
  {
    // Record second event for same entity
    await fabricService.recordEvent({
      eventId: 'evt-fabric-svc-002',
      entityId: 'po-fabric-001',
      entityType: 'PURCHASE_ORDER',
      eventType: 'PO_ISSUED',
      actorId: 'usr-001',
      actorRole: 'PROCUREMENT_OFFICER',
      organizationId: 'ORG-001',
      amountMinor: '15000000000',
      currency: 'IDR',
      timestamp: '2026-09-24T11:00:00.000Z',
    });

    const history = await fabricService.getTransactionHistory('po-fabric-001', 'PURCHASE_ORDER');
    assert(history.length === 2, 'getTransactionHistory returns exactly 2 ledger events');
    assert(history[0].eventType === 'PO_CREATED', 'First event in history is PO_CREATED');
    assert(history[1].eventType === 'PO_ISSUED', 'Second event in history is PO_ISSUED');
    assert(history[0].amountMinor === '15000000000', 'Exact minor unit preserved in history');
  }

  // Test 5: Document Hash Verification
  {
    const expectedHash = 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592';
    const verifySuccess = await fabricService.verifyDocumentHash('po-fabric-001', expectedHash);
    assert(verifySuccess.match === true, 'verifyDocumentHash confirms matching hash on Fabric');
    assert(verifySuccess.storedHash === expectedHash, 'verifyDocumentHash returns stored hash');

    const verifyTampered = await fabricService.verifyDocumentHash('po-fabric-001', 'tampered_hash');
    assert(verifyTampered.match === false, 'verifyDocumentHash rejects tampered document hash');
  }

  // Test 6: Invalid amount minor format rejection
  {
    const badEvent: LedgerEvent = {
      eventId: 'evt-bad-amt-001',
      entityId: 'po-fabric-bad',
      entityType: 'PURCHASE_ORDER',
      eventType: 'PO_CREATED',
      actorId: 'usr-001',
      actorRole: 'PROCUREMENT_OFFICER',
      organizationId: 'ORG-001',
      amountMinor: '999.99', // invalid floating point!
      currency: 'IDR',
      timestamp: '2026-09-24T10:00:00.000Z',
    };

    const res = await fabricService.recordEvent(badEvent);
    assert(res.success === false, 'recordEvent rejects invalid floating-point amount');
    assert(!!res.errorMessage, 'recordEvent returns validation error message');
  }

  await fabricService.close();
  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFabricServiceTests().then((res) => {
    if (res.failed > 0) process.exit(1);
    else process.exit(0);
  });
}
