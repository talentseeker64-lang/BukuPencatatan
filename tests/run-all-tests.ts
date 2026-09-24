import { runChaincodeTests } from './chaincode.test.ts';
import { runFabricServiceTests } from './fabric-service.test.ts';
import { runFabricOutboxE2ETests } from './fabric-outbox-e2e.test.ts';
import { runPayablesLifecycleTests } from './payables-lifecycle.test.ts';
import { runAllTests as runPhase2Tests } from './run-tests.ts';

async function main() {
  console.log('\n======================================================');
  console.log('   FULL SYSTEM VERIFICATION: PHASES 1, 2, 3, AND 4    ');
  console.log('======================================================\n');

  let totalPassed = 0;
  let totalFailed = 0;

  try {
    // 1. Phase 2 Suites
    const resP2 = await runPhase2Tests();
    totalPassed += resP2.passed;
    totalFailed += resP2.failed;

    // 2. Chaincode Suite
    const resCC = await runChaincodeTests();
    totalPassed += resCC.passed;
    totalFailed += resCC.failed;

    // 3. Fabric Service Suite
    const resFS = await runFabricServiceTests();
    totalPassed += resFS.passed;
    totalFailed += resFS.failed;

    // 4. Fabric Outbox E2E Suite
    const resE2E = await runFabricOutboxE2ETests();
    totalPassed += resE2E.passed;
    totalFailed += resE2E.failed;

    // 5. Phase 4 Accounts Payable Ledger Suite
    const resP4 = await runPayablesLifecycleTests();
    totalPassed += resP4.passed;
    totalFailed += resP4.failed;

    console.log('\n======================================================');
    console.log(`GRAND TOTAL: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    console.log('======================================================\n');

    if (totalFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  }
}

main();
