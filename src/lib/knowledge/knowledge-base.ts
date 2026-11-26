
export type PolicyCategory =
  | "refund"
  | "account"
  | "subscription"
  | "technical";

export type PolicyDocument = {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  category: PolicyCategory;
};

export type RetrievalResult = {
  document: PolicyDocument | null;
  score: number;
  matchedTerms: string[];
  reason: string;
};

export const policyDocuments: PolicyDocument[] = [
  {
    id: "refund-policy",
    title: "Refund Policy",
    category: "refund",
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
      "charged",
      "charge",
      "cancel",
      "cancelled",
    ],
  },
  {
    id: "identity-policy",
    title: "Identity Verification Policy",
    category: "account",
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
      "login",
      "sign in",
      "password",
      "locked",
      "username",
      "credentials",
      "authentication",
    ],
  },
  {
    id: "subscription-policy",
    title: "Subscription Policy",
    category: "subscription",
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
      "past due",
      "charge",
      "renewal",
      "renew",
      "membership",
      "monthly fee",
    ],
  },
  {
    id: "technical-policy",
    title: "Technical Support Policy",
    category: "technical",
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
      "application",
      "app",
      "crash",
      "loading",
      "slow",
      "freeze",
      "bug",
      "glitch",
    ],
  },
];

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "being",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "get",
  "give",
  "help",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "the",
  "to",
  "with",
  "would",
  "you",
  "your",
  "need",
  "want",
  "every",
  "why",
  "what",
  "when",
  "where",
  "which",
  "who",
  "am",
  "was",
  "were",
  "been",
  "have",
  "has",
  "had",
  "this",
  "that",
  "there",
  "their",
  "about",
  "some",
]);

// Normalize common word variations into consistent searchable terms.
const synonyms: Record<string, string> = {
  refunds: "refund",
  refunded: "refund",
  refunding: "refund",

  charges: "charge",
  charged: "charge",
  charging: "charge",

  bills: "billing",
  bill: "billing",
  billed: "billing",

  plans: "plan",
  subscriptions: "subscription",

  prices: "price",
  payments: "payment",
  paid: "payment",

  returns: "return",
  returned: "return",
  reimbursements: "reimbursement",

  cancellations: "cancel",
  cancelled: "cancel",
  canceled: "cancel",

  verified: "verify",
  verifying: "verify",
  verification: "verify",
  verifies: "verify",

  accounts: "account",
  identities: "identity",
  credentials: "credential",

  logs: "login",
  log: "login",
  signin: "login",
  sign: "login",
  logging: "login",

  problems: "problem",
  issues: "issue",
  errors: "error",
  failures: "failure",

  crashes: "crash",
  crashing: "crash",
  frozen: "freeze",
  freezing: "freeze",

  applications: "application",
  apps: "app",

  months: "monthly",
  month: "monthly",

  troubleshoots: "troubleshoot",
  troubleshooting: "troubleshoot",
};

function normalizeTerm(term: string): string {
  return synonyms[term] ?? term;
}

function tokenize(text: string): string[] {
  const cleanedText = text
    .replace(/CUS-\d+/gi, " ")
    .replace(/ORD-\d+/gi, " ");

  const words = cleanedText.toLowerCase().match(/[a-z]+/g) ?? [];

  return words
    .filter((word) => !stopWords.has(word))
    .map(normalizeTerm);
}

function detectCategory(question: string): PolicyCategory | null {
  const text = question.toLowerCase();

  const refundPatterns = [
    /\brefund\b/,
    /\bmoney back\b/,
    /\bmoney returned\b/,
    /\breimbursement\b/,
    /\breimburse\b/,
    /\breturn my payment\b/,
    /\bgive me my money back\b/,
    /\bget my money back\b/,
    /\bcharged incorrectly\b/,
    /\bwrong charge\b/,
  ];

  const subscriptionPatterns = [
    /\bsubscription\b/,
    /\bplan\b/,
    /\bmonthly price\b/,
    /\bmonthly fee\b/,
    /\bbilling\b/,
    /\bbilled\b/,
    /\bbill\b/,
    /\bupgrade\b/,
    /\bdowngrade\b/,
    /\bpast due\b/,
    /\bmembership\b/,
    /\brenewal\b/,
    /\brenew\b/,
    /\brecurring payment\b/,
  ];

  const technicalPatterns = [
    /\btechnical\b/,
    /\bproblem\b/,
    /\bbroken\b/,
    /\berror\b/,
    /\btroubleshoot/,
    /\bissue\b/,
    /\bnot working\b/,
    /\bdoesn't work\b/,
    /\bdoes not work\b/,
    /\bcrash/,
    /\bfreeze/,
    /\bbug\b/,
    /\bglitch\b/,
    /\bloading\b/,
    /\bslow application\b/,
  ];

  const accountPatterns = [
    /\baccount\b/,
    /\bverify\b/,
    /\bverification\b/,
    /\bidentity\b/,
    /\baccess\b/,
    /\bsecurity\b/,
    /\blogin\b/,
    /\blog in\b/,
    /\bsign in\b/,
    /\bsignin\b/,
    /\bpassword\b/,
    /\blocked out\b/,
    /\busername\b/,
    /\bauthentication\b/,
    /\bcannot access\b/,
    /\bcan't access\b/,
    /\bforgot password\b/,
  ];

  const matchesAny = (patterns: RegExp[]) =>
    patterns.some((pattern) => pattern.test(text));

  // Check more specific support intents before general account language.
  if (matchesAny(refundPatterns)) {
    return "refund";
  }

  if (matchesAny(subscriptionPatterns)) {
    return "subscription";
  }

  if (matchesAny(technicalPatterns)) {
    return "technical";
  }

  if (matchesAny(accountPatterns)) {
    return "account";
  }

  return null;
}

export function retrievePolicy(question: string): RetrievalResult {
  const category = detectCategory(question);

  if (!category) {
    return {
      document: null,
      score: 0,
      matchedTerms: [],
      reason: "No supported policy category was identified.",
    };
  }

  const document =
    policyDocuments.find((item) => item.category === category) ?? null;

  if (!document) {
    return {
      document: null,
      score: 0,
      matchedTerms: [],
      reason: "No policy document was found for the detected category.",
    };
  }

  const questionTerms = tokenize(question);

  if (questionTerms.length === 0) {
    return {
      document: null,
      score: 0,
      matchedTerms: [],
      reason: "The question did not contain searchable terms.",
    };
  }

  const searchableText = tokenize(
    `${document.title} ${document.content} ${document.keywords.join(" ")}`
  );

  const searchableTerms = new Set(searchableText);

  const matchedTerms = [
    ...new Set(questionTerms.filter((term) => searchableTerms.has(term))),
  ];

  const score =
    questionTerms.length > 0
      ? matchedTerms.length / new Set(questionTerms).size
      : 0;

  return {
    document,
    score,
    matchedTerms,
    reason:
      `Matched the ${category} support category using ` +
      `${matchedTerms.length} of ${new Set(questionTerms).size} ` +
      "unique searchable question terms.",
  };
}
