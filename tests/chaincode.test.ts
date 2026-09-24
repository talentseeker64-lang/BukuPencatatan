import { ProcurementLedgerContract } from '../blockchain/chaincode/src/procurement-contract.ts';
import { LedgerEvent } from '../blockchain/chaincode/src/ledger-event.ts';

class MockChaincodeStub {
  public state: Map<string, Buffer> = new Map();
  public events: { name: string; payload: Buffer }[] = [];
  public txId: string = 'tx_mock_fabric_001';

  getTxID(): string {
    return this.txId;
  }

  setTxID(txId: string) {
    this.txId = txId;
  }

  async getState(key: string): Promise<Buffer | null> {
    const val = this.state.get(key);
    return val ? Buffer.from(val) : Buffer.from('');
  }

  async putState(key: string, value: Buffer): Promise<void> {
    this.state.set(key, Buffer.from(value));
  }

  async deleteState(key: string): Promise<void> {
    this.state.delete(key);
  }

  setEvent(name: string, payload: Buffer): void {
    this.events.push({ name, payload });
  }
}

class MockContext {
  public stub: MockChaincodeStub;
  constructor(stub: MockChaincodeStub) {
    this.stub = stub;
  }
}

export async function runChaincodeTests(): Promise<{ passed: number; failed: number }> {
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

  console.log('\x1b[36m=== Suite: Hyperledger Fabric Chaincode (procurement-ledger) ===\x1b[0m');

  const contract = new ProcurementLedgerContract();

  // Test 1: Record valid event
  {
    const stub = new MockChaincodeStub();
    const ctx = new MockContext(stub) as any;
    stub.setTxID('tx_fabric_test_1001');

    const eventPayload: LedgerEvent = {
      eventId: 'evt-po-001',
      entityId: 'po-123',
      entityType: 'PURCHASE_ORDER',
      eventType: 'PO_CREATED',
      actorId: 'usr-001',
      actorRole: 'PROCUREMENT_OFFICER',
      organizationId: 'ORG-001',
      amountMinor: '10000000000', // Rp100,000,000.00
      currency: 'IDR',
      documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      metadata: { poNumber: 'PO-2026-001' },
      timestamp: '2026-09-24T10:00:00.000Z',
    };

    const resJson = await contract.recordEvent(ctx, JSON.stringify(eventPayload));
    const res = JSON.parse(resJson);

    assert(res.success === true, 'recordEvent returns success: true');
    assert(res.transactionId === 'tx_fabric_test_1001', 'recordEvent records context txID');
    assert(res.duplicate === false, 'recordEvent duplicate flag is false on first write');
    assert(stub.events.length === 1, 'Chaincode emits PROCUREMENT_EVENT');
    assert(stub.events[0].name === 'PROCUREMENT_EVENT', 'Chaincode event name is PROCUREMENT_EVENT');

    // Verify stored event
    const storedEventJson = await contract.getEvent(ctx, 'evt-po-001');
    const stored = JSON.parse(storedEventJson);
    assert(stored.blockchainTransactionId === 'tx_fabric_test_1001', 'Stored event has real Fabric tx ID');
    assert(stored.amountMinor === '10000000000', 'Stored amountMinor preserved exactly');
  }

  // Test 2: Idempotency / duplicate submission
  {
    const stub = new MockChaincodeStub();
    const ctx = new MockContext(stub) as any;
    stub.setTxID('tx_first_attempt');

    const eventPayload: LedgerEvent = {
      eventId: 'evt-idempotent-001',
      entityId: 'po-456',
      entityType: 'PURCHASE_ORDER',
      eventType: 'PO_ISSUED',
      actorId: 'usr-001',
      actorRole: 'PROCUREMENT_OFFICER',
      organizationId: 'ORG-001',
      amountMinor: '5000000000',
      currency: 'IDR',
      timestamp: '2026-09-24T11:00:00.000Z',
    };

    // First attempt
    await contract.recordEvent(ctx, JSON.stringify(eventPayload));

    // Second attempt with new context txId
    stub.setTxID('tx_second_attempt_retry');
    const resJson2 = await contract.recordEvent(ctx, JSON.stringify(eventPayload));
    const res2 = JSON.parse(resJson2);

    assert(res2.success === true, 'Duplicate submission still returns success');
    assert(res2.duplicate === true, 'Duplicate submission flagged as duplicate: true');
    assert(res2.transactionId === 'tx_first_attempt', 'Duplicate returns original transaction ID');

    // Third attempt
    stub.setTxID('tx_third_attempt_retry');
    const resJson3 = await contract.recordEvent(ctx, JSON.stringify(eventPayload));
    const res3 = JSON.parse(resJson3);
    assert(res3.duplicate === true, 'Third submission flagged as duplicate: true');
  }

  // Test 3: Validation errors
  {
    const stub = new MockChaincodeStub();
    const ctx = new MockContext(stub) as any;

    // Missing eventId
    try {
      await contract.recordEvent(ctx, JSON.stringify({ entityId: '123' }));
      assert(false, 'Should have failed missing eventId');
    } catch (e: any) {
      assert(e.message.includes('eventId is required'), 'Rejects missing eventId');
    }

    // Invalid entityType
    try {
      await contract.recordEvent(
        ctx,
        JSON.stringify({
          eventId: 'e1',
          entityId: '123',
          entityType: 'INVALID_TYPE',
          eventType: 'PO_CREATED',
          organizationId: 'ORG-1',
          amountMinor: '100',
          currency: 'IDR',
          timestamp: '2026-09-24T10:00:00.000Z',
        })
      );
      assert(false, 'Should have failed invalid entityType');
    } catch (e: any) {
      assert(e.message.includes('invalid entityType'), 'Rejects invalid entityType');
    }

    // Unsafe floating point amountMinor
    try {
      await contract.recordEvent(
        ctx,
        JSON.stringify({
          eventId: 'e2',
          entityId: '123',
          entityType: 'PURCHASE_ORDER',
          eventType: 'PO_CREATED',
          organizationId: 'ORG-1',
          amountMinor: '100.50', // floating point invalid!
          currency: 'IDR',
          timestamp: '2026-09-24T10:00:00.000Z',
        })
      );
      assert(false, 'Should have failed floating point amountMinor');
    } catch (e: any) {
      assert(e.message.includes('must contain only digits'), 'Rejects floating-point amountMinor');
    }

    // Invalid eventType for Phase 3
    try {
      await contract.recordEvent(
        ctx,
        JSON.stringify({
          eventId: 'e3',
          entityId: '123',
          entityType: 'PURCHASE_ORDER',
          eventType: 'UNREGISTERED_UNKNOWN_EVENT', // Unregistered event
          organizationId: 'ORG-1',
          amountMinor: '100',
          currency: 'IDR',
          timestamp: '2026-09-24T10:00:00.000Z',
        })
      );
      assert(false, 'Should have failed invalid eventType for Phase 3');
    } catch (e: any) {
      assert(e.message.includes('invalid eventType'), 'Rejects unregistered eventType');
    }
  }

  // Test 4: getEntityHistory & chronological order
  {
    const stub = new MockChaincodeStub();
    const ctx = new MockContext(stub) as any;

    const baseEvent: Partial<LedgerEvent> = {
      entityId: 'po-history-001',
      entityType: 'PURCHASE_ORDER',
      actorId: 'usr-001',
      actorRole: 'PROCUREMENT_OFFICER',
      organizationId: 'ORG-001',
      amountMinor: '25000000000',
      currency: 'IDR',
    };

    // Event 1: CREATED
    stub.setTxID('tx_hist_1');
    await contract.recordEvent(
      ctx,
      JSON.stringify({
        ...baseEvent,
        eventId: 'evt-hist-1',
        eventType: 'PO_CREATED',
        timestamp: '2026-09-24T08:00:00.000Z',
      })
    );

    // Event 2: ISSUED
    stub.setTxID('tx_hist_2');
    await contract.recordEvent(
      ctx,
      JSON.stringify({
        ...baseEvent,
        eventId: 'evt-hist-2',
        eventType: 'PO_ISSUED',
        timestamp: '2026-09-24T09:00:00.000Z',
      })
    );

    // Event 3: CANCELLED
    stub.setTxID('tx_hist_3');
    await contract.recordEvent(
      ctx,
      JSON.stringify({
        ...baseEvent,
        eventId: 'evt-hist-3',
        eventType: 'PO_CANCELLED',
        timestamp: '2026-09-24T10:00:00.000Z',
      })
    );

    const historyJson = await contract.getEntityHistory(ctx, 'PURCHASE_ORDER', 'po-history-001');
    const history: LedgerEvent[] = JSON.parse(historyJson);

    assert(history.length === 3, 'getEntityHistory returns exactly 3 events');
    assert(history[0].eventType === 'PO_CREATED', 'First event is PO_CREATED');
    assert(history[1].eventType === 'PO_ISSUED', 'Second event is PO_ISSUED');
    assert(history[2].eventType === 'PO_CANCELLED', 'Third event is PO_CANCELLED');
    assert(history[0].blockchainTransactionId === 'tx_hist_1', 'Event 1 has real txId 1');
    assert(history[1].blockchainTransactionId === 'tx_hist_2', 'Event 2 has real txId 2');

    // Test getEntityState
    const stateJson = await contract.getEntityState(ctx, 'PURCHASE_ORDER', 'po-history-001');
    const state = JSON.parse(stateJson);
    assert(state.currentStatus === 'PO_CANCELLED', 'getEntityState returns latest eventType');
    assert(state.eventCount === 3, 'getEntityState returns total eventCount');
  }

  // Test 5: verifyDocumentHash
  {
    const stub = new MockChaincodeStub();
    const ctx = new MockContext(stub) as any;
    stub.setTxID('tx_doc_verify_1');

    const expectedHash = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';

    await contract.recordEvent(
      ctx,
      JSON.stringify({
        eventId: 'evt-doc-1',
        entityId: 'po-doc-test',
        entityType: 'PURCHASE_ORDER',
        eventType: 'PO_CREATED',
        actorId: 'usr-001',
        actorRole: 'PROCUREMENT_OFFICER',
        organizationId: 'ORG-001',
        amountMinor: '100000',
        currency: 'IDR',
        documentHash: expectedHash,
        timestamp: '2026-09-24T10:00:00.000Z',
      })
    );

    // Matching hash
    const matchJson = await contract.verifyDocumentHash(ctx, 'po-doc-test', expectedHash);
    const matchRes = JSON.parse(matchJson);
    assert(matchRes.match === true, 'verifyDocumentHash matches genuine document hash');
    assert(matchRes.storedHash === expectedHash, 'verifyDocumentHash returns stored hash');

    // Non-matching hash (tampered)
    const nonMatchJson = await contract.verifyDocumentHash(ctx, 'po-doc-test', 'tampered_hash_value');
    const nonMatchRes = JSON.parse(nonMatchJson);
    assert(nonMatchRes.match === false, 'verifyDocumentHash detects tampered hash');
  }

  // Test 6: eventExists
  {
    const stub = new MockChaincodeStub();
    const ctx = new MockContext(stub) as any;
    stub.setTxID('tx_exists_1');

    await contract.recordEvent(
      ctx,
      JSON.stringify({
        eventId: 'evt-exists-123',
        entityId: 'po-exists',
        entityType: 'PURCHASE_ORDER',
        eventType: 'PO_CREATED',
        actorId: 'usr-001',
        actorRole: 'PROCUREMENT_OFFICER',
        organizationId: 'ORG-001',
        amountMinor: '100000',
        currency: 'IDR',
        timestamp: '2026-09-24T10:00:00.000Z',
      })
    );

    const existsTrue = await contract.eventExists(ctx, 'evt-exists-123');
    assert(existsTrue === true, 'eventExists returns true for existing event');

    const existsFalse = await contract.eventExists(ctx, 'non-existent-event');
    assert(existsFalse === false, 'eventExists returns false for non-existent event');
  }

  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runChaincodeTests().then((res) => {
    if (res.failed > 0) process.exit(1);
    else process.exit(0);
  });
}
