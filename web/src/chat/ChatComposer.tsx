import type { GatewayClient } from "@/lib/gatewayClient";
import { Button } from "@nous-research/ui/ui/components/button";
import { cn } from "@/lib/utils";
import { Loader2, Send, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  SlashPopover,
  type SlashPopoverHandle,
} from "@/components/SlashPopover";
import { executeSlash } from "@/lib/slashExec";

import { ModelMenuPopover } from "./ModelMenuPopover";
import { modelShortName } from "./modelPickerCore";
import { QueuedMessageItem } from "./QueuedMessageItem";
import type { QueuedMessage } from "./useMessageQueue";

const TEXTAREA_MAX_HEIGHT_PX = 160;

interface Props {
  gw: GatewayClient | null;
  sessionId: string | null;
  model?: string;
  provider?: string;
  running?: boolean;
  disabled?: boolean;
  queue: QueuedMessage[];
  onSubmit(text: string): Promise<void>;
  onEnqueue(text: string): void;
  onQueueSendNow(id: string): void;
  onQueueEdit(id: string, text: string): void;
  onQueueDelete(id: string): void;
  onSystem(text: string): void;
}

export function ChatComposer({
  gw,
  sessionId,
  model,
  provider,
  running,
  disabled,
  queue,
  onSubmit,
  onEnqueue,
  onQueueSendNow,
  onQueueEdit,
  onQueueDelete,
  onSystem,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const slashRef = useRef<SlashPopoverHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canType = !!gw && !!sessionId && !disabled;
  const isRunning = !!running || busy;
  const hasInput = !!input.trim();

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const clearInput = useCallback(() => {
    setInput("");
    requestAnimationFrame(resizeTextarea);
  }, [resizeTextarea]);

  const deliverText = useCallback(
    async (text: string, opts?: { forceSend?: boolean }) => {
      if (!canType || busy) return;

      if (text.startsWith("/")) {
        setBusy(true);
        try {
          await executeSlash({
            command: text,
            sessionId: sessionId!,
            gw: gw!,
            callbacks: {
              sys: onSystem,
              send: onSubmit,
            },
          });
          clearInput();
        } finally {
          setBusy(false);
          textareaRef.current?.focus();
        }
        return;
      }

      if (running && !opts?.forceSend) {
        onEnqueue(text);
        clearInput();
        textareaRef.current?.focus();
        return;
      }

      setBusy(true);
      try {
        await onSubmit(text);
        clearInput();
      } finally {
        setBusy(false);
        textareaRef.current?.focus();
      }
    },
    [
      canType,
      busy,
      running,
      sessionId,
      gw,
      onSystem,
      onSubmit,
      onEnqueue,
      clearInput,
    ],
  );

  const handleSubmit = useCallback(
    (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text) return;
      void deliverText(text);
    },
    [input, deliverText],
  );

  const handleStop = useCallback(async () => {
    if (!gw || !sessionId) return;
    setBusy(true);
    try {
      await gw.request("session.interrupt", { session_id: sessionId });
    } finally {
      setBusy(false);
    }
  }, [gw, sessionId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashRef.current?.handleKey(e)) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="shrink-0 border-t border-border/40 bg-background-base/80 px-3 py-3 sm:px-4 backdrop-blur-sm">
      <div className="relative mx-auto max-w-3xl">
        <SlashPopover
          ref={slashRef}
          input={input}
          gw={gw}
          onApply={setInput}
          onSubmit={(text) => handleSubmit(text)}
        />

        {queue.length > 0 && (
          <div className="mb-2 max-h-[25vh] overflow-y-auto rounded-lg border border-border/40 bg-muted/10">
            <p className="px-2.5 pt-2 text-xs font-medium text-text-tertiary">
              Queued ({queue.length})
            </p>
            {queue.map((item) => (
              <QueuedMessageItem
                key={item.id}
                text={item.text}
                onSendNow={() => onQueueSendNow(item.id)}
                onEdit={() => {
                  onQueueEdit(item.id, item.text);
                  setInput(item.text);
                  textareaRef.current?.focus();
                }}
                onDelete={() => onQueueDelete(item.id)}
              />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-lg border border-border/50 bg-muted/10 p-2">
          <Button
            type="button"
            ghost
            size="sm"
            disabled={!sessionId}
            onClick={() => setModelOpen(true)}
            className="shrink-0 rounded-full border border-border/40 px-2.5 py-1 text-xs font-mono"
          >
            {modelShortName(model, provider)}
          </Button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={
              running
                ? "Queue a message… (/ for commands)"
                : "Message Hermes… (/ for commands)"
            }
            disabled={!canType}
            className={cn(
              "min-h-[2.25rem] max-h-40 flex-1 resize-none bg-transparent",
              "text-sm outline-none placeholder:text-text-tertiary",
            )}
          />

          {isRunning && (
            <Button
              type="button"
              size="icon"
              destructive
              onClick={() => void handleStop()}
              disabled={!sessionId || busy}
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>
          )}

          {hasInput && (
            <Button
              type="button"
              size="icon"
              onClick={() => handleSubmit()}
              disabled={!canType || busy}
              aria-label={running ? "Queue message" : "Send"}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {modelOpen && gw && sessionId && (
        <ModelMenuPopover
          gw={gw}
          sessionId={sessionId}
          onClose={() => setModelOpen(false)}
        />
      )}
    </div>
  );
}
