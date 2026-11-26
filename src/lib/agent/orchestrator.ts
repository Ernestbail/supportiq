
import { searchKnowledgeBase } from "../vector/vector-search";

import {
  verifyCustomer,
  getSubscription,
  processRefund,
  escalateToHuman,
} from "./tools";

type AgentEvent = string;

type PolicyCategory =
  | "refund"
  | "account"
  | "subscription"
  | "technical";

export type AgentConversationState = {
  pendingRefund: boolean;
  lastRefundOutcome?: {
    orderId: string;
    status: "approved" | "denied";
    reason: string;
    amount?: number;
    escalated: boolean;
    escalationCreated: boolean;
  };
};

export type AgentResult = {
  answer: string;
  events: AgentEvent[];
  escalated: boolean;
  toolsUsed: number;
  conversationState?: AgentConversationState;
};

const MINIMUM_SIMILARITY_SCORE = 0.15;

export async function runSupportAgent(
  question: string,
  onEvent?: (event: string) => void,
  conversationState?: AgentConversationState
): Promise<AgentResult> {
  const events: AgentEvent[] = [];
  let toolsUsed = 0;

  const currentState: AgentConversationState =
    conversationState ?? { pendingRefund: false };

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
    /\brefund\b|\bmoney back\b|\breturn payment\b|\breimbursement\b|\bmoney returned\b/i.test(
      question
    );

  const isSubscription =
    /\bsubscription\b|\bplan\b|\bmonthly price\b|\bupgrade\b|\bdowngrade\b|\bbilling\b|\bbilled\b|\bcharged every month\b|\bmonthly charge\b/i.test(
      question
    );

  const isTechnical =
    /\btechnical\b|\bproblem\b|\bbroken\b|\berror\b|\btroubleshooting\b|\bissue\b|\bnot working\b|\bfailed\b|\bcrash(?:es|ed|ing)?\b|\bfrozen\b|\bfreezing\b/i.test(
      question
    );

  const isAccountQuestion =
    /\baccount\b|\bverify\b|\bverification\b|\bidentity\b|\baccess\b|\bsecurity\b|\blog ?in\b|\bsign ?in\b|\bpassword\b|\bforgot password\b/i.test(
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

  try {
    addEvent("Starting agent orchestration");

    // Step 1: Handle greetings.

    if (isGreeting) {
      addEvent("Intent detected: greeting");

      return {
        answer:
          "Hello! Welcome to SupportIQ. How can I help you today? I can assist with refunds, subscriptions, account questions, and technical support.",
        events,
        escalated: false,
        toolsUsed,
        conversationState: currentState,
      };
    }

    // Step 2: Handle acknowledgements.

    if (isAcknowledgement) {
      addEvent("Intent detected: acknowledgement");

      return {
        answer:
          "You're welcome! Is there anything else I can help you with?",
        events,
        escalated: false,
        toolsUsed,
        conversationState: currentState,
      };
    }

    // Step 3: Remember and explain the previous refund decision.

    const isRefundFollowUp =
      /\b(why|explain|reason|what happened|status|update)\b/i.test(
        normalizedQuestion
      ) &&
      /\b(refund|order|denied|approved|rejected)\b/i.test(
        normalizedQuestion
      );

    if (isRefundFollowUp && currentState.lastRefundOutcome) {
      const outcome = currentState.lastRefundOutcome;

      addEvent("Conversation memory retrieved");
      addEvent(`Previous refund decision found: ${outcome.orderId}`);

      return {
        answer:
          outcome.status === "approved"
            ? `Your refund request for ${outcome.orderId} was approved in our simulation for $${outcome.amount}. ${outcome.reason} No money was transferred.`
            : `Your refund request for ${outcome.orderId} was not automatically approved. Reason: ${outcome.reason} ${
                outcome.escalationCreated
                  ? "A human support review was successfully requested."
                  : "A human support escalation could not be created."
              }`,
        events,
        escalated: outcome.escalated,
        toolsUsed,
        conversationState: currentState,
      };
    }

    // Step 4: Never select a refund order automatically.

    if (isRefund && !orderId) {
      addEvent("Intent detected: refund request");
      addEvent("Waiting for customer order number");

      return {
        answer:
          "I can help with a refund. Please provide your order number (for example, ORD-5001). No refund has been checked or processed yet.",
        events,
        escalated: false,
        toolsUsed,
        conversationState: {
          ...currentState,
          pendingRefund: true,
        },
      };
    }

    if (!customerMatch) {
      addEvent(
        "Using simulated demo customer session: CUS-1001"
      );
    }

    // Step 5: Verify customer identity.

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
        conversationState: currentState,
      };
    }

    addEvent("Customer identity verified");

    // Step 6: Check subscription.

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
        conversationState: currentState,
      };
    }

    addEvent(
      `Subscription checked: ${subscription.subscription.plan} plan`
    );

    // Step 7: Retrieve support policy using vector search.

    addEvent("Generating question embedding...");
    addEvent("Searching Qdrant knowledge base...");

    toolsUsed++;

    const policyResults = await searchKnowledgeBase(
      question,
      3
    );

    const policy = policyResults[0];

    const relevanceScore = policy?.score ?? 0;

    // Reject low-relevance results rather than guessing.

    if (!policy || relevanceScore < MINIMUM_SIMILARITY_SCORE) {
      addEvent(
        `Vector similarity below threshold: ${relevanceScore.toFixed(3)}`
      );

      addEvent("Escalating low-confidence request...");

      toolsUsed++;

      const escalation = await escalateToHuman(
        customerId,
        "low_confidence",
        `No sufficiently relevant support policy was found. Customer question: ${question}`
      );

      if (escalation.success) {
        addEvent("Human support escalation created");
      }

      return {
        answer:
          "I couldn't find sufficiently relevant support guidance for your question. I've referred your request to a human support representative.",
        events,
        escalated: true,
        toolsUsed,
        conversationState: currentState,
      };
    }

    addEvent(
      `Vector policy retrieved: ${policy.policyId} (similarity: ${relevanceScore.toFixed(3)})`
    );

    // Step 8: Determine the support category.

    const detectedCategory: PolicyCategory =
      isRefund
        ? "refund"
        : isSubscription
          ? "subscription"
          : isTechnical
            ? "technical"
            : isAccountQuestion
              ? "account"
              : policy.category;

    // Prevent a mismatched policy from guiding an answer.

    if (policy.category !== detectedCategory) {
      addEvent(
        `Policy category mismatch: expected ${detectedCategory}, received ${policy.category}`
      );

      addEvent("Escalating uncertain policy match...");

      toolsUsed++;

      const escalation = await escalateToHuman(
        customerId,
        "low_confidence",
        `Retrieved policy category did not match the detected request category. Customer question: ${question}`
      );

      if (escalation.success) {
        addEvent("Human support escalation created");
      }

      return {
        answer:
          "I found support information that may not match your request. To avoid giving you incorrect guidance, I've referred this to human support.",
        events,
        escalated: true,
        toolsUsed,
        conversationState: currentState,
      };
    }

    // Step 9: Handle refund requests.

    if (detectedCategory === "refund" && orderId) {
      addEvent(`Checking refund for order ${orderId}...`);

      toolsUsed++;

      const refund = await processRefund(
        customerId,
        orderId
      );

      if (refund.success && refund.refund) {
        addEvent("Refund eligibility approved");

        return {
          answer:
            `${refund.message} Order: ${refund.refund.orderId}. Amount: $${refund.refund.amount}.`,
          events,
          escalated: false,
          toolsUsed,
          conversationState: {
            pendingRefund: false,
            lastRefundOutcome: {
              orderId: refund.refund.orderId,
              status: "approved",
              reason: refund.message,
              amount: refund.refund.amount,
              escalated: false,
              escalationCreated: false,
            },
          },
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
        conversationState: {
          pendingRefund: false,
          lastRefundOutcome: {
            orderId,
            status: "denied",
            reason: refund.message,
            escalated: true,
            escalationCreated: escalation.success,
          },
        },
      };
    }

    // Step 10: Handle subscription questions.

    if (detectedCategory === "subscription") {
      addEvent("Preparing subscription information");

      return {
        answer:
          `${policy.content} Your current subscription is ${subscription.subscription.plan} at $${subscription.subscription.monthlyPrice} per month. Current subscription status: ${subscription.subscription.status}.`,
        events,
        escalated: false,
        toolsUsed,
        conversationState: currentState,
      };
    }

    // Step 11: Handle technical support questions.

    if (detectedCategory === "technical") {
      addEvent("Preparing technical support guidance");

      return {
        answer:
          `${policy.content} To help troubleshoot, please tell me which feature is affected and describe any error message you see.`,
        events,
        escalated: false,
        toolsUsed,
        conversationState: currentState,
      };
    }

    // Step 12: Handle account questions.

    if (detectedCategory === "account") {
      addEvent("Preparing account support guidance");

      return {
        answer:
          `${policy.content} Your demo account verification status is confirmed.`,
        events,
        escalated: false,
        toolsUsed,
        conversationState: currentState,
      };
    }

    // Safe fallback.

    addEvent("No supported response category found");

    return {
      answer:
        "I understand. Could you explain a little more about what you need help with?",
      events,
      escalated: false,
      toolsUsed,
      conversationState: currentState,
    };

  } catch (error) {
    console.error("SupportIQ agent error:", error);

    addEvent("Agent encountered an unexpected error");
    addEvent("Using safe fallback response");

    return {
      answer:
        "I'm sorry, but I encountered a problem while handling your request. No further action was taken. Please try again or contact human support.",
      events,
      escalated: false,
      toolsUsed,
      conversationState: currentState,
    };
  }
}
