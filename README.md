
# SupportIQ
### AI Customer Support Agent

SupportIQ is a full-stack customer support agent prototype built with Next.js, TypeScript, and Tailwind CSS. It demonstrates customer verification, subscription lookups, refund eligibility checks, support-policy retrieval, and simulated human escalation.

## Features

- **Customer support chat:** Interactive chat interface with streamed agent activity.
- **Tool orchestration:** Coordinates customer verification, subscription lookup, refund processing, and escalation tools.
- **Policy retrieval:** Searches a mock support knowledge base using keyword and synonym matching.
- **Refund guardrails:** Checks customer verification, order ownership, payment status, and the 30-day refund window.
- **Voice prototype:** Uses browser-based speech recognition and speech synthesis where supported.
- **Observability:** Displays execution time, activity events, tools used, escalation status, estimated cost, and execution traces.
- **Resilient workflows:** Supports clarification requests and multi-turn refund conversations.

## Technology Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Server-Sent Events (SSE)
- Browser Web Speech API

## Architecture

The application uses a frontend, API route, and agent orchestration layer.

1. The frontend sends customer messages to the chat API.
2. The API streams agent activity to the frontend using Server-Sent Events.
3. The orchestrator identifies the request and coordinates the appropriate tools.
4. The tools operate on simulated customer, subscription, and order data.
5. The API returns the response and execution trace.
6. The frontend displays the conversation, agent activity, and observability information.

## Demo Scenarios

### Refund request
The agent verifies the customer, checks subscription information, retrieves the refund policy, and evaluates the requested order.

### Subscription inquiry
The agent retrieves the customer's simulated subscription details.

### Human escalation
The agent can return a simulated escalation status when a request requires human review.

## Demo Data

The prototype includes simulated customers and orders.

- Customer ID: `CUS-1001`
- Refund-eligible order: `ORD-5001` — $29
- Order outside the refund window: `ORD-5003` — $29

These records are demonstration data, not real customer accounts.

## Running Locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

The current mock-agent implementation does not require external API keys.

See `.env.example` for the environment configuration placeholder.

## Current Limitations

This project is an architectural prototype and not a production payment or customer-support system.

- Agent decisions currently use deterministic logic rather than a live LLM.
- Knowledge retrieval uses keyword and synonym matching, not vector embeddings.
- Customer, subscription, and order records are simulated.
- Refund processing does not transfer money.
- Human escalation is simulated and is not connected to a ticketing platform.
- Voice uses browser speech recognition and speech synthesis, not a real-time conversational voice API.
- Token usage is unavailable because the current agent does not call an LLM.

## Future Improvements

- Integrate an LLM for natural-language reasoning and tool selection.
- Add vector-based retrieval for support documents.
- Implement persistent conversation and escalation storage.
- Integrate a real-time voice service.
- Add authentication, authorization, and production monitoring.
- Connect secure payment and customer-support services.

## Project Status

Working prototype for an AI Engineer architectural assessment.
