
import {
  verifyCustomer,
  getSubscription,
  processRefund,
} from "./tools";

import { runSupportAgent } from "./orchestrator";

let passed = 0;
let failed = 0;

function check(
  name: string,
  condition: boolean,
  details?: string
) {
  if (condition) {
    passed++;
    console.log(`PASS: ${name}`);
  } else {
    failed++;
    console.log(`FAIL: ${name}`);
    if (details) console.log(`  ${details}`);
  }
}

async function testTools() {
  console.log("\n========== INDIVIDUAL TOOL TESTS ==========\n");

  // Test 1: Customer verification
  const verification = await verifyCustomer("CUS-1001");
  check(
    "Customer verification succeeds",
    verification.success
  );

  // Test 2: Subscription lookup
  const subscription = await getSubscription("CUS-1001");
  check(
    "Subscription lookup succeeds",
    subscription.success && !!subscription.subscription
  );

  // Test 3: Suspended/unverified customer
  const suspended = await verifyCustomer("CUS-1002");
  check(
    "Unverified customer is rejected",
    !suspended.success
  );

  // Test 4: Unknown subscription
  const unknownSubscription = await getSubscription("CUS-9999");
  check(
    "Unknown subscription is rejected",
    !unknownSubscription.success
  );

  // Test 5: Approved refund
  const approvedRefund = await processRefund(
    "CUS-1001",
    "ORD-5001"
  );
  check(
    "Eligible refund is approved",
    approvedRefund.success && !!approvedRefund.refund
  );

  // Test 6: Expired refund
  // CUS-1001 owns ORD-5003, which is outside the 30-day window.
  const expiredRefund = await processRefund(
    "CUS-1001",
    "ORD-5003"
  );
  check(
    "Expired refund is rejected",
    !expiredRefund.success
  );

  // Test 7: Wrong customer/order
  const wrongOrder = await processRefund(
    "CUS-1001",
    "ORD-5002"
  );
  check(
    "Wrong customer cannot refund another customer's order",
    !wrongOrder.success
  );

  console.log("\n========== AGENT ORCHESTRATION TESTS ==========\n");

  // Test 8: Successful refund workflow
  const refundAgent = await runSupportAgent(
    "I need a refund for ORD-5001"
  );

  check(
    "Agent approves eligible refund",
    !refundAgent.escalated &&
      refundAgent.answer.includes("ORD-5001") &&
      refundAgent.answer.includes("$29")
  );

  // Test 9: Expired refund requires human review
  const expiredAgent = await runSupportAgent(
    "I need a refund for ORD-5003"
  );

  check(
    "Agent escalates expired refund",
    expiredAgent.escalated &&
      expiredAgent.answer.toLowerCase().includes("human review")
  );

  // Test 10: Unverified customer requires escalation
  const unverifiedAgent = await runSupportAgent(
    "I need help with my account CUS-1002"
  );

  check(
    "Agent escalates unverified customer",
    unverifiedAgent.escalated &&
      unverifiedAgent.answer.toLowerCase().includes("human review")
  );

  // Test 11: Account support workflow
  const accountAgent = await runSupportAgent(
    "I need help with my account"
  );

  check(
    "Agent retrieves account support guidance",
    !accountAgent.escalated &&
      accountAgent.answer.toLowerCase().includes("identity")
  );

  // Test 12: Technical support workflow
  const technicalAgent = await runSupportAgent(
    "The application is not working"
  );

  check(
    "Agent retrieves technical support guidance",
    !technicalAgent.escalated &&
      technicalAgent.answer.toLowerCase().includes("troubleshoot")
  );

  console.log("\n========== TEST SUMMARY ==========\n");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed.`);
  }

  console.log("\nAll tests passed successfully.");
}

testTools().catch((error) => {
  console.error("\nTest execution failed:", error);
  process.exitCode = 1;
});
