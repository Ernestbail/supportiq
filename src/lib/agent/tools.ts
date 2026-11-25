
export type Customer = {
  id: string;
  name: string;
  email: string;
  accountStatus: "active" | "suspended";
  verified: boolean;
};

// ----------------------------------
// CUSTOMER DATABASE (MOCK)
// ----------------------------------

const customers: Customer[] = [
  {
    id: "CUS-1001",
    name: "John Smith",
    email: "john@example.com",
    accountStatus: "active",
    verified: true,
  },
  {
    id: "CUS-1002",
    name: "Sarah Johnson",
    email: "sarah@example.com",
    accountStatus: "suspended",
    verified: false,
  },
];

// ----------------------------------
// CUSTOMER VERIFICATION TOOL
// ----------------------------------

export async function verifyCustomer(customerId: string) {
  const customer = customers.find(
    (item) => item.id === customerId
  );

  if (!customer) {
    return {
      success: false,
      message: "Customer not found.",
      customer: null,
    };
  }

  if (
    !customer.verified ||
    customer.accountStatus !== "active"
  ) {
    return {
      success: false,
      message:
        "Customer verification failed. Human review may be required.",
      customer: null,
    };
  }

  return {
    success: true,
    message: "Customer successfully verified.",
    customer,
  };
}

// ----------------------------------
// SUBSCRIPTION DATABASE (MOCK)
// ----------------------------------

export type Subscription = {
  customerId: string;
  plan: "Basic" | "Pro" | "Enterprise";
  status: "active" | "cancelled" | "past_due";
  monthlyPrice: number;
};

const subscriptions: Subscription[] = [
  {
    customerId: "CUS-1001",
    plan: "Pro",
    status: "active",
    monthlyPrice: 29,
  },
  {
    customerId: "CUS-1002",
    plan: "Basic",
    status: "past_due",
    monthlyPrice: 9,
  },
];

// ----------------------------------
// SUBSCRIPTION LOOKUP TOOL
// ----------------------------------

export async function getSubscription(customerId: string) {
  const subscription = subscriptions.find(
    (item) => item.customerId === customerId
  );

  if (!subscription) {
    return {
      success: false,
      message: "No subscription found for this customer.",
      subscription: null,
    };
  }

  return {
    success: true,
    message: "Subscription retrieved successfully.",
    subscription,
  };
}

// ----------------------------------
// REFUND DATABASE (MOCK)
// ----------------------------------

export type RefundOrder = {
  orderId: string;
  customerId: string;
  amount: number;
  daysSincePurchase: number;
  paymentStatus: "paid" | "pending";
};

const refundOrders: RefundOrder[] = [
  {
    orderId: "ORD-5001",
    customerId: "CUS-1001",
    amount: 29,
    daysSincePurchase: 5,
    paymentStatus: "paid",
  },
  {
    orderId: "ORD-5003",
    customerId: "CUS-1001",
    amount: 29,
    daysSincePurchase: 40,
    paymentStatus: "paid",
  },
  {
    orderId: "ORD-5002",
    customerId: "CUS-1002",
    amount: 9,
    daysSincePurchase: 40,
    paymentStatus: "paid",
  },
];

// ----------------------------------
// REFUND PROCESSING TOOL
// ----------------------------------

export async function processRefund(
  customerId: string,
  orderId: string
) {
  // First, confirm order ownership.
  const order = refundOrders.find(
    (item) =>
      item.orderId === orderId &&
      item.customerId === customerId
  );

  if (!order) {
    return {
      success: false,
      message: "Order not found for this customer.",
      refund: null,
    };
  }

  // Verify customer identity and account status.
  const verification = await verifyCustomer(customerId);

  if (!verification.success) {
    return {
      success: false,
      message: "Refund denied: customer verification failed.",
      refund: null,
    };
  }

  // Confirm payment was completed.
  if (order.paymentStatus !== "paid") {
    return {
      success: false,
      message: "Refund denied: payment is not completed.",
      refund: null,
    };
  }

  // Enforce the 30-day refund policy.
  if (order.daysSincePurchase > 30) {
    return {
      success: false,
      message:
        "Refund denied: the 30-day refund window has expired.",
      refund: null,
    };
  }

  // Simulate an approved refund.
  return {
    success: true,
    message:
      "Refund approved. This is a simulation only; no money was transferred.",
    refund: {
      orderId: order.orderId,
      amount: order.amount,
      status: "simulated_approved" as const,
    },
  };
}

// ----------------------------------
// HUMAN ESCALATION TOOL
// ----------------------------------

export type EscalationReason =
  | "identity_verification"
  | "refund_dispute"
  | "billing_issue"
  | "low_confidence"
  | "customer_request"
  | "technical_issue";

export async function escalateToHuman(
  customerId: string,
  reason: EscalationReason,
  details: string
) {
  const customer = customers.find(
    (item) => item.id === customerId
  );

  if (!customer) {
    return {
      success: false,
      message: "Cannot escalate: customer not found.",
      escalation: null,
    };
  }

  if (!details.trim()) {
    return {
      success: false,
      message: "Escalation details are required.",
      escalation: null,
    };
  }

  // Mock escalation record.
  const escalation = {
    escalationId: `ESC-${Date.now()}`,
    customerId,
    customerName: customer.name,
    reason,
    details,
    status: "pending_human_review" as const,
    createdAt: new Date().toISOString(),
  };

  return {
    success: true,
    message:
      "Request successfully prepared for human review. This is a simulated handoff.",
    escalation,
  };
}
