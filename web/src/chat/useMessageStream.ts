import type { GatewayClient, GatewayEvent } from "@/lib/gatewayClient";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  STREAM_DELTA_FLUSH_MS,
  appendReasoningDelta,
  appendTextDelta,
  nextMessageId,
  type ChatMessage,
  type GatewayEventPayload,
  type PromptOverlay,
  type UserMessageAttachment,
  upsertToolPart,
} from "./chatMessages";

export interface SessionInfo {
  model?: string;
  provider?: string;
  cwd?: string;
  running?: boolean;
  credential_warning?: string;
  title?: string;
}

interface UseMessageStreamOptions {
  gw: GatewayClient | null;
  sessionId: string | null;
  initialMessages?: ChatMessage[];
}

export function useMessageStream({
  gw,
  sessionId,
  initialMessages = [],
}: UseMessageStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({});
  const [overlay, setOverlay] = useState<PromptOverlay | null>(null);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);

  const activeAssistantIdRef = useRef<string | null>(null);
  const deltaQueueRef = useRef({ assistant: "", reasoning: "" });
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDeltas = useCallback(() => {
    const { assistant, reasoning } = deltaQueueRef.current;
    if (!assistant && !reasoning) return;

    deltaQueueRef.current = { assistant: "", reasoning: "" };

    setMessages((prev) => {
      const id = activeAssistantIdRef.current;
      if (!id) return prev;

      return prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          content: assistant ? appendTextDelta(m.content, assistant) : m.content,
          reasoning: reasoning
            ? appendReasoningDelta(m.reasoning, reasoning)
            : m.reasoning,
          reasoningStreaming: reasoning ? true : m.reasoningStreaming,
        };
      });
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushDeltas();
    }, STREAM_DELTA_FLUSH_MS);
  }, [flushDeltas]);

  const ensureAssistantBubble = useCallback(() => {
    if (activeAssistantIdRef.current) return activeAssistantIdRef.current;
    const id = nextMessageId("assistant");
    activeAssistantIdRef.current = id;
    setMessages((prev) => [
      ...prev,
      { id, role: "assistant", content: "", streaming: true },
    ]);
    return id;
  }, []);

  const handleEvent = useCallback(
    (ev: GatewayEvent) => {
      if (sessionId && ev.session_id && ev.session_id !== sessionId) return;

      const payload = (ev.payload ?? {}) as GatewayEventPayload;

      switch (ev.type) {
        case "session.info":
          if (payload) {
            setSessionInfo((prev) => ({
              ...prev,
              model: payload.model ?? prev.model,
              provider: payload.provider ?? prev.provider,
              cwd: payload.cwd ?? prev.cwd,
              running: payload.running ?? prev.running,
              title: payload.title ?? prev.title,
            }));
          }
          break;

        case "message.start":
          ensureAssistantBubble();
          break;

        case "message.delta": {
          const text = payload.text ?? payload.rendered ?? "";
          if (!text) break;
          ensureAssistantBubble();
          deltaQueueRef.current.assistant += text;
          scheduleFlush();
          break;
        }

        case "reasoning.delta": {
          const text = payload.text ?? "";
          if (!text) break;
          ensureAssistantBubble();
          deltaQueueRef.current.reasoning += text;
          scheduleFlush();
          break;
        }

        case "reasoning.available":
          ensureAssistantBubble();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === activeAssistantIdRef.current
                ? { ...m, reasoningStreaming: false }
                : m,
            ),
          );
          break;

        case "thinking.delta": {
          const status = payload.status ?? payload.text ?? "";
          setThinkingStatus(status || null);
          break;
        }

        case "tool.start":
        case "tool.progress":
          ensureAssistantBubble();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === activeAssistantIdRef.current
                ? {
                    ...m,
                    toolCalls: upsertToolPart(
                      m.toolCalls ?? [],
                      payload,
                      "running",
                    ),
                  }
                : m,
            ),
          );
          break;

        case "tool.complete":
          ensureAssistantBubble();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === activeAssistantIdRef.current
                ? {
                    ...m,
                    toolCalls: upsertToolPart(
                      m.toolCalls ?? [],
                      payload,
                      "complete",
                    ),
                  }
                : m,
            ),
          );
          break;

        case "message.complete": {
          flushDeltas();
          const finalText = payload.text ?? payload.rendered ?? "";
          const id = activeAssistantIdRef.current;
          activeAssistantIdRef.current = null;
          setThinkingStatus(null);

          setMessages((prev) => {
            if (id) {
              return prev.map((m) =>
                m.id === id
                  ? {
                      ...m,
                      content: finalText || m.content,
                      streaming: false,
                      reasoningStreaming: false,
                    }
                  : m,
              );
            }
            if (finalText) {
              return [
                ...prev,
                {
                  id: nextMessageId("assistant"),
                  role: "assistant" as const,
                  content: finalText,
                  streaming: false,
                },
              ];
            }
            return prev;
          });

          setSessionInfo((prev) => ({ ...prev, running: false }));
          break;
        }

        case "approval.request":
          setOverlay({
            kind: "approval",
            command: payload.command,
            description: payload.description,
            allowPermanent: payload.allow_permanent !== false,
          });
          break;

        case "clarify.request":
          if (payload.request_id) {
            setOverlay({
              kind: "clarify",
              requestId: payload.request_id,
              question: payload.question ?? "Clarification needed",
              choices: payload.choices,
            });
          }
          break;

        case "sudo.request":
          if (payload.request_id) {
            setOverlay({
              kind: "sudo",
              requestId: payload.request_id,
              command: payload.command,
            });
          }
          break;

        case "secret.request":
          if (payload.request_id) {
            setOverlay({
              kind: "secret",
              requestId: payload.request_id,
              envVar: payload.env_var,
              prompt: payload.prompt,
            });
          }
          break;

        case "error": {
          const message = payload.message ?? "An error occurred";
          const id = activeAssistantIdRef.current;
          activeAssistantIdRef.current = null;
          flushDeltas();
          setThinkingStatus(null);
          setSessionInfo((prev) => ({ ...prev, running: false }));

          if (id) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id
                  ? { ...m, content: message, streaming: false, error: message }
                  : m,
              ),
            );
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: nextMessageId("assistant"),
                role: "assistant",
                content: message,
                error: message,
              },
            ]);
          }
          break;
        }

        default:
          break;
      }
    },
    [
      sessionId,
      ensureAssistantBubble,
      scheduleFlush,
      flushDeltas,
    ],
  );

  useEffect(() => {
    if (!gw) return;
    return gw.onAny(handleEvent);
  }, [gw, handleEvent]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  const addUserMessage = useCallback(
    (text: string, opts?: { attachments?: UserMessageAttachment[] }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId("user"),
          role: "user",
          content: text,
          attachments: opts?.attachments,
        },
      ]);
      setSessionInfo((prev) => ({ ...prev, running: true }));
    },
    [],
  );

  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId("system"), role: "system", content: text },
    ]);
  }, []);

  const resetMessages = useCallback((next: ChatMessage[]) => {
    activeAssistantIdRef.current = null;
    deltaQueueRef.current = { assistant: "", reasoning: "" };

    const last = next.at(-1);
    if (last?.role === "assistant" && last.streaming) {
      activeAssistantIdRef.current = last.id;
      setSessionInfo((prev) => ({ ...prev, running: true }));
    }

    setMessages(next);
  }, []);

  const clearOverlay = useCallback(() => setOverlay(null), []);

  return {
    messages,
    sessionInfo,
    overlay,
    thinkingStatus,
    addUserMessage,
    addSystemMessage,
    resetMessages,
    clearOverlay,
    setSessionInfo,
  };
}
