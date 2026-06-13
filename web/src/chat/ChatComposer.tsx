import type { GatewayClient } from "@/lib/gatewayClient";
import { Button } from "@nous-research/ui/ui/components/button";
import { cn } from "@/lib/utils";
import { Loader2, Send, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import {
  SlashPopover,
  type SlashPopoverHandle,
} from "@/components/SlashPopover";
import { executeSlash } from "@/lib/slashExec";

import { ModelMenuPopover } from "./ModelMenuPopover";
import { modelShortName } from "./modelPickerCore";

interface Props {
  gw: GatewayClient | null;
  sessionId: string | null;
  model?: string;
  provider?: string;
  running?: boolean;
  disabled?: boolean;
  onSubmit(text: string): Promise<void>;
  onSystem(text: string): void;
}

export function ChatComposer({
  gw,
  sessionId,
  model,
  provider,
  running,
  disabled,
  onSubmit,
  onSystem,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const slashRef = useRef<SlashPopoverHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = !!gw && !!sessionId && !disabled && !busy;
  const isRunning = !!running || busy;

  const handleSubmit = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || !canSend) return;

      setBusy(true);
      try {
        if (text.startsWith("/")) {
          await executeSlash({
            command: text,
            sessionId: sessionId!,
            gw: gw!,
            callbacks: {
              sys: onSystem,
              send: onSubmit,
            },
          });
        } else {
          await onSubmit(text);
        }
        setInput("");
      } finally {
        setBusy(false);
        textareaRef.current?.focus();
      }
    },
    [input, canSend, sessionId, gw, onSubmit, onSystem],
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
      void handleSubmit();
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
          onSubmit={(text) => void handleSubmit(text)}
        />

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
            placeholder="Message Hermes… (/ for commands)"
            disabled={!canSend}
            className={cn(
              "min-h-[2.25rem] max-h-40 flex-1 resize-none bg-transparent",
              "text-sm outline-none placeholder:text-text-tertiary",
            )}
          />

          {isRunning ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={() => void handleStop()}
              disabled={!sessionId}
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={() => void handleSubmit()}
              disabled={!canSend || !input.trim()}
              aria-label="Send"
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
