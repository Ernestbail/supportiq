
import {
  verifyCustomer,
  getSubscription,
  processRefund,
} from "./tools";

async function testTools() {
  console.log("\nTEST 1: Customer verification");
  console.log(await verifyCustomer("CUS-1001"));

  console.log("\nTEST 2: Subscription lookup");
  console.log(await getSubscription("CUS-1001"));

  console.log("\nTEST 3: Suspended customer");
  console.log(await verifyCustomer("CUS-1002"));

  console.log("\nTEST 4: Unknown subscription");
  console.log(await getSubscription("CUS-9999"));

  console.log("\nTEST 5: Approved refund");
  console.log(await processRefund("CUS-1001", "ORD-5001"));

  console.log("\nTEST 6: Expired refund");
  console.log(await processRefund("CUS-1002", "ORD-5002"));

  console.log("\nTEST 7: Wrong customer/order");
  console.log(await processRefund("CUS-1001", "ORD-5002"));
}

testTools();
