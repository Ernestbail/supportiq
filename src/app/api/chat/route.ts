
import { runSupportAgent } from "@/lib/agent/orchestrator";

export async function POST(request: Request) {
  let body: { question?: string };

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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      const trace: Array<{
        timestamp: string;
        event: object;
      }> = [];

      const send = (data: object) => {
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
          }
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
