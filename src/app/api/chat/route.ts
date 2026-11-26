
import {
  runSupportAgent,
  type AgentConversationState,
} from "@/lib/agent/orchestrator";

function readConversationState(value: unknown): AgentConversationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      pendingRefund: false,
      refundOutcomes: [],
    };
  }

  const state = value as Record<string, unknown>;
  const pendingRefund = state.pendingRefund === true;

  const rawOutcomes = Array.isArray(state.refundOutcomes)
    ? state.refundOutcomes
    : [];

  const refundOutcomes = rawOutcomes
    .filter((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return false;
      }

      const candidate = item as Record<string, unknown>;

      return (
        typeof candidate.orderId === "string" &&
        (candidate.status === "approved" || candidate.status === "denied") &&
        typeof candidate.reason === "string" &&
        typeof candidate.escalated === "boolean" &&
        typeof candidate.escalationCreated === "boolean"
      );
    })
    .map((item) => {
      const candidate = item as Record<string, unknown>;

      return {
        orderId: candidate.orderId as string,
        status: candidate.status as "approved" | "denied",
        reason: candidate.reason as string,
        escalated: candidate.escalated as boolean,
        escalationCreated: candidate.escalationCreated as boolean,
        ...(typeof candidate.amount === "number" &&
        Number.isFinite(candidate.amount)
          ? { amount: candidate.amount }
          : {}),
      };
    });

  return {
    pendingRefund,
    refundOutcomes,
  };
}

export async function POST(request: Request) {
  let body: {
    question?: unknown;
    conversationState?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  const question = body.question;

  if (typeof question !== "string" || !question.trim()) {
    return Response.json(
      { error: "Please enter a message." },
      { status: 400 }
    );
  }

  const conversationState = readConversationState(
    body.conversationState
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startTime = Date.now();

      const trace: Array<{
        timestamp: string;
        event: string;
      }> = [];

      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const result = await runSupportAgent(
          question.trim(),
          (event) => {
            const timestamp = new Date().toISOString();

            trace.push({
              timestamp,
              event,
            });

            send({
              type: "event",
              event,
              timestamp,
            });
          },
          conversationState
        );

        const latencyMs = Date.now() - startTime;

        const observability = {
          latencyMs,
          eventCount: trace.length,
          toolsUsed: result.toolsUsed,
          escalated: result.escalated,
          estimatedCost: 0,
          tokenUsage: null,
          executionMode: "mock-agent",
          trace,
        };

        send({
          type: "result",
          ...result,
          observability,
        });
      } catch (error) {
        const latencyMs = Date.now() - startTime;

        console.error("SupportIQ agent error:", error);

        send({
          type: "error",
          error: "The support agent encountered an unexpected error.",
          observability: {
            latencyMs,
            eventCount: trace.length,
            trace,
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
