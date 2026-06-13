import { Markdown } from "@/components/Markdown";
import { ToolCall } from "@/components/ToolCall";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "./chatMessages";

interface Props {
  messages: ChatMessage[];
  thinkingStatus?: string | null;
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

export function ChatTranscript({
  messages,
  thinkingStatus,
  className,
}: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [nearBottom, setNearBottom] = useState(true);

  useEffect(() => {
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, nearBottom, thinkingStatus]);

  const onScroll = () => {
    const el = hostRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setNearBottom(gap < 80);
  };

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-text-tertiary",
          className,
        )}
      >
        <p>Start a conversation — messages stream here in real time.</p>
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
                  <div className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap">
                    {msg.content}
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
    </div>
  );
}
