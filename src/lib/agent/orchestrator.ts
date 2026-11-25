
import {
  verifyCustomer,
  getSubscription,
  processRefund,
  escalateToHuman,
} from "./tools";

type AgentEvent = string;

export type AgentResult = {
  answer: string;
  events: AgentEvent[];
  escalated: boolean;
  toolsUsed: number;
};

type PolicyDocument = {
  id: string;
  title: string;
  content: string;
  keywords: string[];
};

const policyDocuments: PolicyDocument[] = [
  {
    id: "refund-policy",
    title: "Refund Policy",
    content:
      "Customers may request a refund within 30 days of purchase. The original payment must be completed. Refund requests outside the 30-day window require human review. Refunds are subject to customer identity verification and order ownership checks.",
    keywords: [
      "refund",
      "money",
      "back",
      "payment",
      "return",
      "reimbursement",
      "purchase",
      "order",
    ],
  },
  {
    id: "identity-policy",
    title: "Identity Verification Policy",
    content:
      "Customer identity must be verified and the account must be active before account changes, refunds, or other sensitive actions can be performed. Unverified or suspended accounts must be escalated for human review.",
    keywords: [
      "identity",
      "verification",
      "verify",
      "customer",
      "account",
      "access",
      "security",
    ],
  },
  {
    id: "subscription-policy",
    title: "Subscription Policy",
    content:
      "Customers can ask about their subscription plan, monthly price, and account status. Billing problems, failed payments, and past-due subscriptions may require additional verification or human review.",
    keywords: [
      "subscription",
      "plan",
      "billing",
      "price",
      "monthly",
      "payment",
      "upgrade",
      "downgrade",
    ],
  },
  {
    id: "technical-policy",
    title: "Technical Support Policy",
    content:
      "For technical problems, collect the affected feature, error message, and troubleshooting steps already attempted. Issues that cannot be resolved with the available support guidance should be escalated to a human support representative.",
    keywords: [
      "technical",
      "problem",
      "broken",
      "error",
      "failed",
      "troubleshooting",
      "issue",
      "not working",
    ],
  },
];

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "could",
  "do",
  "for",
  "get",
  "help",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "please",
  "the",
  "to",
  "with",
  "would",
  "you",
  "your",
  "need",
  "want",
]);

const synonyms: Record<string, string[]> = {
  refund: ["refund", "money", "back", "reimbursement", "return"],
  money: ["money", "refund", "payment", "reimbursement"],
  paid: ["paid", "payment", "purchase", "billing"],
  payment: ["payment", "paid", "billing", "purchase"],
  return: ["return", "refund", "reimbursement"],
  verify: ["verify", "verification", "identity", "customer"],
  account: ["account", "customer", "identity", "subscription"],
  subscription: ["subscription", "plan", "monthly"],
  billing: ["billing", "payment", "paid", "subscription"],
  technical: ["technical", "problem", "issue", "troubleshooting"],
  problem: ["problem", "issue", "error", "broken"],
  broken: ["broken", "error", "problem", "issue"],
  failed: ["failed", "failure", "error", "payment"],
};

function retrievePolicy(question: string) {
  const cleanedQuestion = question
    .replace(/CUS-\d+/gi, "")
    .replace(/ORD-\d+/gi, "");

  const terms =
    cleanedQuestion
      .toLowerCase()
      .match(/[a-z]+/g)
      ?.filter((term) => !stopWords.has(term)) ?? [];

  if (terms.length === 0) {
    return {
      document: null,
      score: 0,
    };
  }

  const rankedDocuments = policyDocuments.map((document) => {
    const searchableText =
      `${document.title} ${document.content} ${document.keywords.join(" ")}`
        .toLowerCase();

    const matchedTerms = terms.filter((term) => {
      const relatedTerms = synonyms[term] ?? [term];

      return relatedTerms.some(
        (relatedTerm) =>
          searchableText.includes(relatedTerm) ||
          document.keywords.includes(relatedTerm)
      );
    });

    return {
      document,
      score: matchedTerms.length / terms.length,
    };
  });

  rankedDocuments.sort((a, b) => b.score - a.score);

  return rankedDocuments[0] ?? {
    document: null,
    score: 0,
  };
}

export async function runSupportAgent(
  question: string,
  onEvent?: (event: string) => void
): Promise<AgentResult> {
  const events: AgentEvent[] = [];
  let toolsUsed = 0;

  const addEvent = (event: string) => {
    events.push(event);
    onEvent?.(event);
  };

  const normalizedQuestion = question.trim().toLowerCase();

  const customerMatch = question.match(/CUS-\d+/i);
  const customerId = customerMatch
    ? customerMatch[0].toUpperCase()
    : "CUS-1001";

  const orderMatch = question.match(/ORD-\d+/i);
  const orderId = orderMatch?.[0].toUpperCase();

  const isRefund =
    /\brefund\b|\bmoney back\b|\breturn payment\b|\breimbursement\b/i.test(
      question
    );

  const isSubscription =
    /\bsubscription\b|\bplan\b|\bmonthly price\b|\bupgrade\b|\bdowngrade\b|\bbilling\b/i.test(
      question
    );

  const isTechnical =
    /\btechnical\b|\bproblem\b|\bbroken\b|\berror\b|\btroubleshooting\b|\bissue\b|\bnot working\b|\bfailed\b/i.test(
      question
    );

  const isAccountQuestion =
    /\baccount\b|\bverify\b|\bverification\b|\bidentity\b|\baccess\b|\bsecurity\b/i.test(
      question
    );

  const isGreeting =
    /^(hi|hello|hey|good morning|good afternoon|good evening|howdy)[!.?\s]*$/i.test(
      normalizedQuestion
    );

  const isAcknowledgement =
    /^(ok|okay|alright|all right|got it|understood|thanks|thank you|thank you so much|great|perfect|cool|sure)[!.?\s]*$/i.test(
      normalizedQuestion
    );

  const hasRecognizedIntent =
    isRefund ||
    isSubscription ||
    isTechnical ||
    isAccountQuestion;

  try {
    addEvent("Starting agent orchestration");

    // Handle greetings without running support tools.
    if (isGreeting) {
      addEvent("Intent detected: greeting");

      return {
        answer:
          "Hello! Welcome to SupportIQ. How can I help you today? I can assist with refunds, subscriptions, account questions, and technical support.",
        events,
        escalated: false,
        toolsUsed,
      };
    }

    // Handle acknowledgements naturally.
    if (isAcknowledgement) {
      addEvent("Intent detected: acknowledgement");

      return {
        answer:
          "You're welcome! Is there anything else I can help you with?",
        events,
        escalated: false,
        toolsUsed,
      };
    }

    // Ask for clarification instead of guessing the customer's intent.
    if (!hasRecognizedIntent) {
      addEvent("Intent unclear; requesting clarification");

      return {
        answer:
          "I'd be happy to help. Could you tell me a little more about what you need? I can help with refunds, subscriptions, account questions, or technical problems.",
        events,
        escalated: false,
        toolsUsed,
      };
    }

    // Never select an order automatically.
    if (isRefund && !orderId) {
      addEvent("Intent detected: refund request");
      addEvent("Waiting for customer order number");

      return {
        answer:
          "I can help with a refund. Please provide your order number (for example, ORD-5001). No refund has been checked or processed yet.",
        events,
        escalated: false,
        toolsUsed,
      };
    }

    if (!customerMatch) {
      addEvent("Using simulated demo customer session: CUS-1001");
    }

    // Step 1: Verify customer identity.
    addEvent("Running customer verification...");
    toolsUsed++;

    const verification = await verifyCustomer(customerId);

    if (!verification.success) {
      addEvent("Customer verification failed");
      addEvent("Escalating to human support...");

      toolsUsed++;

      const escalation = await escalateToHuman(
        customerId,
        "identity_verification",
        `Customer verification failed: ${verification.message}`
      );

      if (escalation.success) {
        addEvent("Human support escalation created");
      }

      return {
        answer:
          `${verification.message} I cannot continue with this request until your identity is verified. Your request has been referred for human review.`,
        events,
        escalated: true,
        toolsUsed,
      };
    }

    addEvent("Customer identity verified");

    // Step 2: Check subscription.
    addEvent("Checking subscription...");
    toolsUsed++;

    const subscription = await getSubscription(customerId);

    if (!subscription.success || !subscription.subscription) {
      addEvent("Subscription check failed");
      addEvent("Escalating billing issue...");

      toolsUsed++;

      const escalation = await escalateToHuman(
        customerId,
        "billing_issue",
        `Subscription lookup failed: ${subscription.message}`
      );

      if (escalation.success) {
        addEvent("Human support escalation created");
      }

      return {
        answer:
          "I couldn't retrieve your subscription details. I've referred this issue for human review.",
        events,
        escalated: true,
        toolsUsed,
      };
    }

    addEvent(
      `Subscription checked: ${subscription.subscription.plan} plan`
    );

    // Step 3: Retrieve the relevant support policy.
    addEvent("Searching support knowledge base...");
    toolsUsed++;

    const policyResult = retrievePolicy(question);
    const policy = policyResult.document;
    const confidence = policyResult.score;

    if (!policy || confidence < 0.4) {
      addEvent(
        `Knowledge base confidence too low: ${Math.round(
          confidence * 100
        )}%`
      );
      addEvent("Escalating low-confidence request...");

      toolsUsed++;

      const escalation = await escalateToHuman(
        customerId,
        "low_confidence",
        `The support agent could not confidently match the request to a policy. Customer question: ${question}`
      );

      if (escalation.success) {
        addEvent("Human support escalation created");
      }

      return {
        answer:
          "I couldn't confidently match your question to our support guidance. I've referred your request to a human support representative.",
        events,
        escalated: true,
        toolsUsed,
      };
    }

    addEvent(
      `Policy retrieved: ${policy.id} (keyword-match score: ${Math.round(
        confidence * 100
      )}%)`
    );

    // Step 4: Handle refund requests.
    if (isRefund && orderId) {
      addEvent(`Checking refund for order ${orderId}...`);
      toolsUsed++;

      const refund = await processRefund(customerId, orderId);

      if (refund.success && refund.refund) {
        addEvent("Refund eligibility approved");

        return {
          answer:
            `${refund.message} Order: ${refund.refund.orderId}. Amount: $${refund.refund.amount}.`,
          events,
          escalated: false,
          toolsUsed,
        };
      }

      addEvent("Refund could not be automatically approved");
      addEvent("Escalating refund request for human review...");

      toolsUsed++;

      const escalation = await escalateToHuman(
        customerId,
        "refund_dispute",
        `Refund request for ${orderId} requires human review. Details: ${refund.message}`
      );

      if (escalation.success) {
        addEvent("Human support escalation created");
      }

      return {
        answer:
          `${refund.message} I've referred this refund request for human review.`,
        events,
        escalated: true,
        toolsUsed,
      };
    }

    // Step 5: Handle subscription questions.
    if (isSubscription) {
      addEvent("Preparing subscription information");

      return {
        answer:
          `${policy.content} Your current subscription is ${subscription.subscription.plan} at $${subscription.subscription.monthlyPrice} per month. Current subscription status: ${subscription.subscription.status}.`,
        events,
        escalated: false,
        toolsUsed,
      };
    }

    // Step 6: Handle technical support questions.
    if (isTechnical) {
      addEvent("Preparing technical support guidance");

      return {
        answer:
          `${policy.content} To help troubleshoot, please tell me which feature is affected and describe any error message you see.`,
        events,
        escalated: false,
        toolsUsed,
      };
    }

    // Step 7: Handle account questions.
    if (isAccountQuestion) {
      addEvent("Preparing account support guidance");

      return {
        answer:
          `${policy.content} Your demo account verification status is confirmed.`,
        events,
        escalated: false,
        toolsUsed,
      };
    }

    return {
      answer:
        "I understand. Could you explain a little more about what you need help with?",
      events,
      escalated: false,
      toolsUsed,
    };
  } catch (error) {
    addEvent("Agent encountered an unexpected error");
    addEvent("Using safe fallback response");

    return {
      answer:
        "I'm sorry, but I encountered a problem while handling your request. No further action was taken. Please try again or contact human support.",
      events,
      escalated: false,
      toolsUsed,
    };
  }
}
