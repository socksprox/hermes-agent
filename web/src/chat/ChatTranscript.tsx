import { Markdown } from "@/components/Markdown";
import { ToolCall } from "@/components/ToolCall";
import { Button } from "@nous-research/ui/ui/components/button";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useI18n } from "@/i18n";

import type { ChatMessage } from "./chatMessages";
import {
  relativeSessionAge,
  sessionDisplayTitle,
  type SessionListItem,
} from "./sessionListCore";

interface Props {
  messages: ChatMessage[];
  thinkingStatus?: string | null;
  recentSessions?: SessionListItem[];
  className?: string;
}

function ReasoningBlock({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!text.trim()) return null;

  return (
    <div className="mb-2 rounded border border-border/40 bg-muted/20 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-text-secondary hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="font-medium tracking-wide">
          {streaming ? "Thinking…" : "Reasoning"}
        </span>
      </button>
      {open && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-border/30 px-2 py-2 font-mono text-[11px] text-text-tertiary">
          {text}
        </pre>
      )}
    </div>
  );
}

function scrollHostToBottom(el: HTMLDivElement) {
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}

export function ChatTranscript({
  messages,
  thinkingStatus,
  recentSessions = [],
  className,
}: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [nearBottom, setNearBottom] = useState(true);

  const isStreaming =
    messages.some((m) => m.streaming) || !!thinkingStatus;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    setNearBottom(true);
    const el = hostRef.current;
    if (el) {
      if (behavior === "auto") {
        scrollHostToBottom(el);
      } else {
        bottomRef.current?.scrollIntoView({ behavior });
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior });
        });
      }
    }
  }, []);

  useEffect(() => {
    if (nearBottom) {
      scrollToBottom("smooth");
    }
  }, [messages, nearBottom, thinkingStatus, scrollToBottom]);

  const onScroll = () => {
    const el = hostRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setNearBottom(gap < 80);
  };

  const showJumpToBottom = !nearBottom && isStreaming;

  const resumeSession = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("resume", id);
      navigate(`/chat?${next.toString()}`);
    },
    [navigate, searchParams],
  );

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center text-sm text-text-tertiary",
          className,
        )}
      >
        <p>{t.chatSession.startConversation}</p>
        {recentSessions.length > 0 && (
          <div className="w-full max-w-md text-left">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
              {t.chatSession.recentSessions}
            </p>
            <div className="flex flex-col gap-1">
              {recentSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => resumeSession(session.id)}
                  className="rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/30"
                >
                  <span className="block truncate font-medium text-foreground">
                    {sessionDisplayTitle(
                      session.title,
                      session.preview,
                      t.chatSession.untitledSession,
                    )}
                  </span>
                  <span className="block truncate text-xs text-text-tertiary">
                    {session.source ?? "local"} ·{" "}
                    {relativeSessionAge(session.started_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div
        ref={hostRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto px-3 py-4 sm:px-4"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm">
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap justify-end gap-1.5">
                        {msg.attachments.map((att, idx) =>
                          att.kind === "image" && att.previewUrl ? (
                            <img
                              key={`${msg.id}-att-${idx}`}
                              src={att.previewUrl}
                              alt={att.label}
                              className="max-h-32 max-w-full rounded-md object-contain"
                            />
                          ) : (
                            <span
                              key={`${msg.id}-att-${idx}`}
                              className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/20 px-2 py-1 text-xs text-text-secondary"
                            >
                              <FileText className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[10rem]">
                                {att.label}
                              </span>
                            </span>
                          ),
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              );
            }

            if (msg.role === "system") {
              return (
                <div
                  key={msg.id}
                  className="rounded border border-border/30 bg-muted/20 px-3 py-2 text-xs text-text-secondary whitespace-pre-wrap font-mono"
                >
                  {msg.content}
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex justify-start">
                <div
                  className={cn(
                    "max-w-full rounded-lg px-3 py-2 text-sm",
                    msg.error
                      ? "border border-destructive/40 bg-destructive/5"
                      : "bg-success/10",
                  )}
                >
                  {msg.reasoning && (
                    <ReasoningBlock
                      text={msg.reasoning}
                      streaming={msg.reasoningStreaming}
                    />
                  )}
                  {msg.toolCalls?.map((tool) => (
                    <ToolCall key={tool.id} tool={tool} />
                  ))}
                  {msg.content && (
                    <Markdown
                      content={msg.content}
                      streaming={msg.streaming}
                    />
                  )}
                  {msg.streaming && !msg.content && (
                    <span className="text-text-tertiary animate-pulse">…</span>
                  )}
                </div>
              </div>
            );
          })}

          {thinkingStatus && (
            <p className="text-center text-xs text-text-tertiary">
              {thinkingStatus}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {showJumpToBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            type="button"
            size="sm"
            outlined
            className="pointer-events-auto gap-1.5 rounded-full border-border/60 bg-background-base/95 px-3 py-1 text-xs shadow-md backdrop-blur-sm"
            onClick={() => scrollToBottom("auto")}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            New messages
          </Button>
        </div>
      )}
    </div>
  );
}
