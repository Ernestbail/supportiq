
"use client";

import { useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AgentConversationState = {
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

type ObservabilityData = {
  latencyMs: number;
  eventCount: number;
  toolsUsed: number;
  escalated: boolean;
  estimatedCost: number;
  tokenUsage: number | null;
  executionMode: string;
  trace: Array<{
    timestamp: string;
    event: string;
  }>;
};

type AgentResult = {
  answer: string;
  events: string[];
  escalated: boolean;
  toolsUsed: number;
  conversationState?: AgentConversationState;
  observability?: ObservabilityData;
};

type SpeechRecognitionResult = {
  transcript: string;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {
    results: ArrayLike<ArrayLike<SpeechRecognitionResult>>;
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm SupportIQ. I can help with refunds, subscriptions, account questions, and troubleshooting. How can I help?",
    },
  ]);

  const [input, setInput] = useState("");
  const [activities, setActivities] = useState<string[]>([
    "Agent initialized",
    "Waiting for customer request",
  ]);
  const [loading, setLoading] = useState(false);
  const [toolsUsed, setToolsUsed] = useState(0);
  const [escalations, setEscalations] = useState(0);

  const [conversationState, setConversationState] =
    useState<AgentConversationState>({
      pendingRefund: false,
    });

  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [observability, setObservability] =
    useState<ObservabilityData | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceTranscriptRef = useRef("");
  const voiceReplyRef = useRef(false);

  function speakResponse(text: string) {
    if (!voiceReplyRef.current) return;

    voiceReplyRef.current = false;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(text);
      speech.lang = "en-US";
      speech.rate = 1;

      window.speechSynthesis.speak(speech);
    }
  }

  function startVoice() {
    const speechWindow = window as SpeechWindow;

    const Recognition =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceSupported(false);
      setActivities((prev) => [
        ...prev,
        "Voice recognition is not supported by this browser",
      ]);
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    voiceTranscriptRef.current = "";

    const recognition = new Recognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      voiceTranscriptRef.current = transcript.trim();
      setInput(transcript.trim());
    };

    recognition.onerror = () => {
      setListening(false);
      setActivities((prev) => [
        ...prev,
        "Voice recognition encountered an error",
      ]);
    };

    recognition.onend = () => {
      setListening(false);

      const transcript = voiceTranscriptRef.current.trim();

      if (transcript) {
        voiceReplyRef.current = true;
        void handleSend(transcript);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);

      setActivities((prev) => [
        ...prev,
        "Voice recognition started",
      ]);
    } catch {
      setListening(false);

      setActivities((prev) => [
        ...prev,
        "Could not start the microphone",
      ]);
    }
  }

  async function handleSend(questionOverride?: string) {
    const question = (questionOverride ?? input).trim();

    if (!question || loading) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
    ]);

    setInput("");

    const normalized = question.toLowerCase();
    const orderMatch = question.match(/ORD-\d+/i);
    const hasOrderNumber = Boolean(orderMatch);

    const isAcknowledgement =
      /^(ok|okay|alright|all right|got it|understood|thanks|thank you|great|perfect|cool|sure)[!.?\s]*$/i.test(
        normalized
      );

    const isCancellation =
      /^(cancel|cancel it|never mind|nevermind|forget it|stop)[!.?\s]*$/i.test(
        normalized
      );

    const isDifferentIntent =
      /\b(subscription|plan|monthly price|upgrade|downgrade|billing|technical|problem|broken|error|troubleshooting|issue|not working|account|verify|verification|identity|access|security)\b/i.test(
        question
      );

    let effectiveQuestion = question;

    let requestState: AgentConversationState = {
      ...conversationState,
    };

    if (conversationState.pendingRefund && isAcknowledgement) {
      const answer =
        "No problem. I'm still waiting for your order number (for example, ORD-5001) so I can continue with your refund request.";

      setActivities([
        "Conversation memory retrieved",
        "Pending request: refund",
        "Waiting for customer order number",
      ]);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);

      speakResponse(answer);
      return;
    }

    if (conversationState.pendingRefund && isCancellation) {
      requestState = {
        ...conversationState,
        pendingRefund: false,
      };

      setConversationState(requestState);

      const answer =
        "No problem. I've cancelled the pending refund request. No refund was checked or processed.";

      setActivities([
        "Conversation memory updated",
        "Pending refund request cancelled",
      ]);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);

      speakResponse(answer);
      return;
    }

    if (conversationState.pendingRefund && hasOrderNumber) {
      effectiveQuestion = `I need a refund for ${orderMatch![0]}`;

      setActivities([
        "Conversation memory retrieved",
        "Previous intent: refund request",
        `Order number received: ${orderMatch![0].toUpperCase()}`,
        "Resuming refund workflow...",
      ]);
    } else if (
      conversationState.pendingRefund &&
      !isDifferentIntent
    ) {
      const answer =
        "I still need your order number to continue with the refund request. For example, ORD-5001.";

      setActivities([
        "Conversation memory retrieved",
        "Pending request: refund",
        "Order number still required",
      ]);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);

      speakResponse(answer);
      return;
    } else if (
      conversationState.pendingRefund &&
      isDifferentIntent
    ) {
      requestState = {
        ...conversationState,
        pendingRefund: false,
      };

      setConversationState(requestState);
    }

    setLoading(true);

    if (!conversationState.pendingRefund || isDifferentIntent) {
      setActivities(["Connecting to SupportIQ agent..."]);
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: effectiveQuestion,
          conversationState: requestState,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Could not connect to the support agent.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      const finalResult: { current: AgentResult | null } = {
        current: null,
      };

      function handleEvent(frame: string) {
        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data:"));

        if (!dataLine) return;

        const payload = JSON.parse(dataLine.slice(5).trim());

        if (payload.type === "event") {
          setActivities((prev) => [
            ...prev,
            payload.event,
          ]);
        }

        if (payload.type === "result") {
          finalResult.current = payload as AgentResult;
        }

        if (payload.type === "error") {
          throw new Error(payload.error);
        }
      }

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          handleEvent(frame);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        handleEvent(buffer);
      }

      const result = finalResult.current;

      if (!result) {
        throw new Error("The agent did not return a final response.");
      }

      setToolsUsed(result.toolsUsed);

      if (result.observability) {
        setObservability(result.observability);
      }

      if (result.escalated) {
        setEscalations((prev) => prev + 1);
      }

      if (result.conversationState) {
        setConversationState(result.conversationState);
      } else {
        setConversationState(requestState);
      }

      if (
        result.conversationState?.pendingRefund ||
        /please provide your order number/i.test(result.answer)
      ) {
        setActivities((prev) => [
          ...prev,
          "Conversation memory saved: pending refund request",
        ]);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer },
      ]);

      speakResponse(result.answer);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";

      setActivities((prev) => [
        ...prev,
        "Agent request failed",
      ]);

      const answer = `I'm sorry. ${message}`;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);

      speakResponse(answer);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-slate-800 bg-slate-900 p-6 md:block">
          <h1 className="text-2xl font-bold text-blue-400">
            SupportIQ
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            AI Customer Support Agent
          </p>

          <nav className="mt-12 space-y-4 text-sm">
            <p className="rounded-lg bg-blue-600 px-4 py-3">
              Dashboard
            </p>
            <p className="px-4 py-2 text-slate-400">
              Conversations
            </p>
            <p className="px-4 py-2 text-slate-400">
              Knowledge Base
            </p>
            <p className="px-4 py-2 text-slate-400">
              Agent Activity
            </p>
            <p className="px-4 py-2 text-slate-400">
              Observability
            </p>
          </nav>

          <div className="mt-16 rounded-xl border border-slate-700 p-4">
            <p className="text-sm font-semibold">
              Agent status
            </p>
            <p className="mt-2 text-sm text-green-400">
              ● System online
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold">
                Customer Support Workspace
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Manage conversations with your AI agent
              </p>
            </div>

            <span className="rounded-full bg-green-500/10 px-3 py-2 text-xs text-green-400">
              ● Online
            </span>
          </header>

          <div className="grid flex-1 gap-6 p-6 lg:grid-cols-3">
            <div className="flex min-h-[600px] flex-col rounded-2xl border border-slate-800 bg-slate-900 lg:col-span-2">
              <div className="border-b border-slate-800 p-5">
                <h3 className="font-semibold">
                  AI Support Assistant
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Streaming chat and browser-based voice prototype
                </p>

                {conversationState.pendingRefund && (
                  <p className="mt-3 text-xs text-blue-400">
                    ● Remembering: waiting for refund order number
                  </p>
                )}

                {listening && (
                  <p className="mt-3 animate-pulse text-xs text-green-400">
                    ● Listening... Your words will appear as you speak
                  </p>
                )}
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "border border-slate-700 bg-slate-800 text-slate-200"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <p className="animate-pulse text-sm text-blue-400">
                    SupportIQ is processing your request...
                  </p>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
                className="flex flex-wrap gap-3 border-t border-slate-800 p-4"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    listening
                      ? "Your spoken words will appear here..."
                      : conversationState.pendingRefund
                        ? "Enter your order number, e.g. ORD-5001"
                        : "Try: I need a refund for ORD-5001"
                  }
                  disabled={loading}
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={startVoice}
                  disabled={loading || !voiceSupported}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${
                    listening
                      ? "bg-red-600 hover:bg-red-500"
                      : "bg-slate-700 hover:bg-slate-600"
                  }`}
                >
                  {listening ? "Stop Listening" : "🎤 Voice"}
                </button>

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {loading ? "Working..." : "Send"}
                </button>
              </form>

              <p className="px-4 pb-3 text-xs text-slate-500">
                Browser-based speech recognition and speech synthesis.
                Microphone permission may be required.
              </p>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="font-semibold">
                  Agent Activity
                </h3>

                <p className="mt-2 text-xs text-slate-400">
                  Live workflow events
                </p>

                <div className="mt-5 space-y-4">
                  {activities.map((activity, index) => (
                    <p
                      key={index}
                      className="text-sm text-slate-300"
                    >
                      {activity}
                    </p>
                  ))}

                  {loading && (
                    <p className="animate-pulse text-sm text-blue-400">
                      Waiting for next event...
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="font-semibold">
                  System Overview
                </h3>

                <div className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Messages
                    </span>
                    <span>{messages.length}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Tools called
                    </span>
                    <span>{toolsUsed}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Escalations
                    </span>
                    <span>{escalations}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      API cost
                    </span>
                    <span>$0.00 (mock tools)</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="font-semibold">
                  Observability
                </h3>

                <p className="mt-2 text-xs text-slate-400">
                  Latest agent execution trace
                </p>

                {observability ? (
                  <div className="mt-5 space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Execution time
                      </span>
                      <span>{observability.latencyMs} ms</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Activity events
                      </span>
                      <span>{observability.eventCount}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Tools used
                      </span>
                      <span>{observability.toolsUsed}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Escalated
                      </span>
                      <span>
                        {observability.escalated ? "Yes" : "No"}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Estimated cost
                      </span>
                      <span>
                        ${observability.estimatedCost.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Token usage
                      </span>
                      <span>
                        {observability.tokenUsage === null
                          ? "Not available (mock agent)"
                          : observability.tokenUsage}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Execution mode
                      </span>
                      <span>{observability.executionMode}</span>
                    </div>

                    <div className="border-t border-slate-700 pt-4">
                      <p className="mb-3 font-medium text-slate-300">
                        Execution trace
                      </p>

                      <div className="max-h-64 space-y-3 overflow-y-auto">
                        {observability.trace.map((item, index) => (
                          <div key={`${item.timestamp}-${index}`}>
                            <p className="text-xs text-slate-500">
                              {new Date(
                                item.timestamp
                              ).toLocaleTimeString()}
                            </p>

                            <p className="text-sm text-slate-300">
                              {item.event}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Send a message to view execution details.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
