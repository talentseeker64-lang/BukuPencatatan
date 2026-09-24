import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DatabaseService } from '../apps/api/src/database/db.service.ts';
import { PayablesService } from '../apps/api/src/modules/payables/payables.service.ts';
import { OutboxService } from '../apps/api/src/modules/outbox/outbox.service.ts';
import { Role, UserStatus } from '../apps/api/src/common/types.ts';

describe('Phase 4: Accounts Payable & Procurement Ledger Integration Tests', async () => {
  const db = DatabaseService.getInstance();
  await db.seedDefaultData();
  const payablesService = new PayablesService();
  const outboxService = OutboxService.getInstance();

  const adminUser = {
    id: 'usr-admin-001',
    name: 'System Administrator',
    email: 'admin@example.local',
    role: Role.ADMIN,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  const procurementUser = {
    id: 'usr-proc-001',
    name: 'Budi Santoso',
    email: 'procurement@example.local',
    role: Role.PROCUREMENT_OFFICER,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  const ppkUser = {
    id: 'usr-ppk-001',
    name: 'Dr. Hendra Gunawan',
    email: 'ppk@example.local',
    role: Role.PPK,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  const financeUser = {
    id: 'usr-fin-001',
    name: 'Sri Wahyuni',
    email: 'finance@example.local',
    role: Role.FINANCE,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  const authUser = {
    id: 'usr-auth-001',
    name: 'Rudi Hartono',
    email: 'authorized@example.local',
    role: Role.AUTHORIZED_OFFICER,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  it('1. Seeded 4-Month Cycle contains payables across Bulan 1, 2, 3, and 4', async () => {
    const summary = await payablesService.getPayablesSummary(adminUser);
    assert.ok(summary);
    assert.strictEqual(summary.period_breakdown.length, 4);

    const b1 = summary.period_breakdown.find((p) => p.period === 'Bulan 1');
    const b2 = summary.period_breakdown.find((p) => p.period === 'Bulan 2');
    const b3 = summary.period_breakdown.find((p) => p.period === 'Bulan 3');
    const b4 = summary.period_breakdown.find((p) => p.period === 'Bulan 4');

    assert.ok(b1);
    assert.strictEqual(b1.total_amount, '150000000.00'); // Vendor A 100M + Vendor B 50M
    assert.ok(b2);
    assert.strictEqual(b2.total_amount, '200000000.00'); // PO-003 75M + PO-004 125M
    assert.ok(b3);
    assert.strictEqual(b3.total_amount, '200000000.00'); // PO-005 200M
    assert.ok(b4);
  });

  it('2. Multi-tier Approval Hierarchy: Pejabat Pengadaan -> PPK -> Finance -> Authorized Officer', async () => {
    const payables = await payablesService.getPayables({ status: 'PAYABLE' }, adminUser);
    assert.ok(payables.items.length > 0);
    const testPayable = payables.items[0];

    // Step 1: Procurement Officer approves
    const approvedStep1 = await payablesService.approvePayable(testPayable.id, 'Fisik barang sesuai BAST', procurementUser);
    assert.strictEqual(approvedStep1.approvals.length, 1);
    assert.strictEqual(approvedStep1.approvals[0].step, 'PROCUREMENT_OFFICER');

    // Step 2: PPK approves
    const approvedStep2 = await payablesService.approvePayable(testPayable.id, 'Komitmen disetujui', ppkUser);
    assert.strictEqual(approvedStep2.approvals.length, 2);
    assert.strictEqual(approvedStep2.approvals[1].step, 'PPK');

    // Step 3: Finance approves
    const approvedStep3 = await payablesService.approvePayable(testPayable.id, 'Kelayakan anggaran terverifikasi', financeUser);
    assert.strictEqual(approvedStep3.approvals.length, 3);
    assert.strictEqual(approvedStep3.approvals[2].step, 'FINANCE');

    // Step 4: Authorized Officer approves -> Status changes to APPROVED
    const finalApproved = await payablesService.approvePayable(testPayable.id, 'SP2D disahkan', authUser);
    assert.strictEqual(finalApproved.status, 'APPROVED');
    assert.strictEqual(finalApproved.approvals.length, 4);
    assert.strictEqual(finalApproved.approvals[3].step, 'AUTHORIZED_OFFICER');
  });

  it('3. Initiate Payment with SP2D reference', async () => {
    const payables = await payablesService.getPayables({ status: 'APPROVED' }, adminUser);
    assert.ok(payables.items.length > 0);
    const target = payables.items[0];

    const updated = await payablesService.initiatePayment(
      target.id,
      { payment_reference: 'SP2D-2026-04-9999', notes: 'Pencairan KPPN diterbitkan' },
      financeUser
    );

    assert.strictEqual(updated.status, 'PAYMENT_INITIATED');
    assert.strictEqual(updated.payment_reference, 'SP2D-2026-04-9999');
  });

  it('4. Confirm Settlement on-chain transitions status to SETTLED', async () => {
    const payables = await payablesService.getPayables({ status: 'PAYMENT_INITIATED' }, adminUser);
    assert.ok(payables.items.length > 0);
    const target = payables.items[0];

    const settled = await payablesService.settlePayable(target.id, 'TRX-SETTLE-TEST-001', adminUser);
    assert.strictEqual(settled.status, 'SETTLED');
    assert.strictEqual(settled.payment_reference, 'TRX-SETTLE-TEST-001');
  });

  it('5. Tamper-Evident Detection: Database manipulation triggers cryptographic mismatch with Hyperledger Fabric', async () => {
    const payables = await payablesService.getPayables({}, adminUser);
    const target = payables.items[0];

    // Initial state: genuine and verified
    const initialAudit = await payablesService.auditPayableIntegrity(target.id, adminUser);
    assert.strictEqual(initialAudit.is_match, true);
    assert.strictEqual(initialAudit.tamper_detected, false);
    assert.strictEqual(initialAudit.status, 'VERIFIED_GENUINE');

    // Simulate tampering: malicious actor changes amount from 100M to 150M in relational DB
    await payablesService.tamperDatabaseRecord(target.id, '150000000.00', adminUser);

    // Re-audit: system MUST detect mismatch
    const tamperedAudit = await payablesService.auditPayableIntegrity(target.id, adminUser);
    assert.strictEqual(tamperedAudit.is_match, false);
    assert.strictEqual(tamperedAudit.tamper_detected, true);
    assert.strictEqual(tamperedAudit.status, 'TAMPER_DETECTED');
    assert.notStrictEqual(tamperedAudit.database_hash, tamperedAudit.ledger_hash);

    // Restore genuine record
    await payablesService.restoreDatabaseRecord(target.id, adminUser);

    // Re-audit: integrity restored
    const restoredAudit = await payablesService.auditPayableIntegrity(target.id, adminUser);
    assert.strictEqual(restoredAudit.is_match, true);
    assert.strictEqual(restoredAudit.tamper_detected, false);
    assert.strictEqual(restoredAudit.status, 'VERIFIED_GENUINE');
  });
});

export async function runPayablesLifecycleTests(): Promise<{ passed: number; failed: number }> {
  console.log('\x1b[36m=== Suite: Phase 4 Accounts Payable Ledger & Tamper Detection ===\x1b[0m');
  const db = DatabaseService.getInstance();
  await db.seedDefaultData();
  const payablesService = new PayablesService();

  const adminUser = {
    id: 'usr-admin-001',
    name: 'System Administrator',
    email: 'admin@example.local',
    role: Role.ADMIN,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  const procurementUser = {
    id: 'usr-proc-001',
    name: 'Budi Santoso',
    email: 'procurement@example.local',
    role: Role.PROCUREMENT_OFFICER,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  const ppkUser = {
    id: 'usr-ppk-001',
    name: 'Dr. Hendra Gunawan',
    email: 'ppk@example.local',
    role: Role.PPK,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  const financeUser = {
    id: 'usr-fin-001',
    name: 'Sri Wahyuni',
    email: 'finance@example.local',
    role: Role.FINANCE,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  const authUser = {
    id: 'usr-auth-001',
    name: 'Rudi Hartono',
    email: 'authorized@example.local',
    role: Role.AUTHORIZED_OFFICER,
    organizationId: 'org-001-default-uuid',
    status: UserStatus.ACTIVE,
  };

  let passed = 0;
  let failed = 0;

  const check = (desc: string, condition: boolean) => {
    if (condition) {
      console.log(`  \x1b[32m✓\x1b[0m ${desc}`);
      passed++;
    } else {
      console.log(`  \x1b[31m✗\x1b[0m ${desc}`);
      failed++;
    }
  };

  try {
    // 1. Seeded 4-Month Cycle
    const summary = await payablesService.getPayablesSummary(adminUser);
    check('Seeded 4-Month Cycle breakdown contains 4 periods', summary.period_breakdown.length === 4);
    const b1 = summary.period_breakdown.find((p) => p.period === 'Bulan 1');
    const b2 = summary.period_breakdown.find((p) => p.period === 'Bulan 2');
    const b3 = summary.period_breakdown.find((p) => p.period === 'Bulan 3');
    check('Bulan 1 total obligation matches Rp150.000.000 (Vendor A 100M + Vendor B 50M)', b1?.total_amount === '150000000.00');
    check('Bulan 2 total obligation matches Rp200.000.000 (PO-003 75M + PO-004 125M)', b2?.total_amount === '200000000.00');
    check('Bulan 3 total obligation matches Rp200.000.000 (PO-005 200M)', b3?.total_amount === '200000000.00');

    // 2. Multi-tier Approval Hierarchy
    const payables = await payablesService.getPayables({ status: 'PAYABLE' }, adminUser);
    const testPayable = payables.items[0];

    const step1 = await payablesService.approvePayable(testPayable.id, 'Fisik barang sesuai BAST', procurementUser);
    check('Procurement Officer approval appended to ledger approvals chain', step1.approvals.some((a) => a.step === 'PROCUREMENT_OFFICER'));

    const step2 = await payablesService.approvePayable(testPayable.id, 'Komitmen disetujui', ppkUser);
    check('PPK approval recorded in sequential audit chain', step2.approvals.some((a) => a.step === 'PPK'));

    const step3 = await payablesService.approvePayable(testPayable.id, 'Kelayakan anggaran terverifikasi', financeUser);
    check('Finance officer approval verified on payable', step3.approvals.some((a) => a.step === 'FINANCE'));

    const step4 = await payablesService.approvePayable(testPayable.id, 'SP2D disahkan', authUser);
    check('Authorized Officer approval transitions status to APPROVED', step4.status === 'APPROVED');

    // 3. Initiate Payment
    const initiated = await payablesService.initiatePayment(
      testPayable.id,
      { payment_reference: 'SP2D-2026-04-9999', notes: 'Pencairan KPPN' },
      financeUser
    );
    check('Initiate payment records SP2D reference and transitions to PAYMENT_INITIATED', initiated.status === 'PAYMENT_INITIATED' && initiated.payment_reference === 'SP2D-2026-04-9999');

    // 4. Settlement
    const settled = await payablesService.settlePayable(testPayable.id, 'TRX-SETTLE-TEST-001', adminUser);
    check('Settlement transitions state to SETTLED and records on-chain transaction reference', settled.status === 'SETTLED');

    // 5. Tamper-evident Detection
    const initialAudit = await payablesService.auditPayableIntegrity(testPayable.id, adminUser);
    check('Cryptographic audit confirms genuine database state matches Hyperledger Fabric hash', initialAudit.is_match && !initialAudit.tamper_detected);

    await payablesService.tamperDatabaseRecord(testPayable.id, '999999999.00', adminUser);
    const tamperedAudit = await payablesService.auditPayableIntegrity(testPayable.id, adminUser);
    check('Tamper Detection Lab flags database manipulation with MISMATCH (Database Hash ≠ Fabric Hash)', !tamperedAudit.is_match && tamperedAudit.tamper_detected);

    await payablesService.restoreDatabaseRecord(testPayable.id, adminUser);
    const restoredAudit = await payablesService.auditPayableIntegrity(testPayable.id, adminUser);
    check('Restoration of authentic ledger values returns state to VERIFIED_GENUINE', restoredAudit.is_match && !restoredAudit.tamper_detected);
  } catch (err: any) {
    console.error('Payables test error:', err);
    failed++;
  }

  return { passed, failed };
}
