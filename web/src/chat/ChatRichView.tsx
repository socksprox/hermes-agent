import { Button } from "@nous-research/ui/ui/components/button";
import { Typography } from "@nous-research/ui/ui/components/typography/index";
import { ChatSidebar } from "@/components/ChatSidebar";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useProfileScope } from "@/contexts/useProfileScope";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { PanelRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { PluginSlot } from "@/plugins";

import { ChatComposer } from "./ChatComposer";
import { ChatTranscript } from "./ChatTranscript";
import { PromptOverlays } from "./PromptOverlays";
import { useChatGateway } from "./useChatGateway";
import { useMessageStream } from "./useMessageStream";

export function ChatRichView({ isActive = true }: { isActive?: boolean }) {
  const { profile: scopedProfile } = useProfileScope();
  const { setEnd } = usePageHeader();
  const { t } = useI18n();

  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false,
  );
  const [mobilePanelOpenRaw, setMobilePanelOpenRaw] = useState(false);
  const mobilePanelOpen = isActive && mobilePanelOpenRaw;
  const closeMobilePanel = useCallback(() => setMobilePanelOpenRaw(false), []);
  const [portalRoot] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.body : null,
  );

  const pluginsLabel = useMemo(
    () => `${t.app.modelToolsSheetTitle} ${t.app.modelToolsSheetSubtitle}`,
    [t.app.modelToolsSheetSubtitle, t.app.modelToolsSheetTitle],
  );

  const resetRef = useRef<(msgs: Parameters<typeof resetMessages>[0]) => void>(
    () => {},
  );

  const {
    gw,
    connectionState,
    sessionId,
    sessionInfo: gatewayInfo,
    error: gatewayError,
    sessionEnded,
    request,
    startNewChat,
  } = useChatGateway({
    profile: scopedProfile,
    onHydrated: (next) => resetRef.current(next),
  });

  const {
    messages,
    sessionInfo,
    overlay,
    thinkingStatus,
    addUserMessage,
    addSystemMessage,
    resetMessages,
    clearOverlay,
  } = useMessageStream({ gw, sessionId });

  resetRef.current = resetMessages;

  const mergedInfo = { ...gatewayInfo, ...sessionInfo };

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!sessionId) return;
      addUserMessage(text);
      await request("prompt.submit", { session_id: sessionId, text });
    },
    [sessionId, addUserMessage, request],
  );

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobilePanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobilePanel();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobilePanelOpen, closeMobilePanel]);

  useEffect(() => {
    if (!isActive) {
      setEnd(null);
      return;
    }
    if (!narrow) {
      setEnd(null);
      return;
    }
    setEnd(
      <Button
        ghost
        onClick={() => setMobilePanelOpenRaw(true)}
        aria-expanded={mobilePanelOpen}
        aria-controls="chat-side-panel"
        className={cn(
          "shrink-0 rounded border border-current/20",
          "px-2 py-1 text-xs font-medium tracking-wide",
          "text-text-secondary hover:text-midground hover:bg-midground/5",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <PanelRight className="h-3 w-3 shrink-0" />
          {pluginsLabel}
        </span>
      </Button>,
    );
    return () => setEnd(null);
  }, [isActive, narrow, mobilePanelOpen, pluginsLabel, setEnd]);

  const mobilePluginsPortal =
    isActive &&
    narrow &&
    portalRoot &&
    createPortal(
      <>
        {mobilePanelOpen && (
          <Button
            ghost
            aria-label={t.app.closeModelTools}
            onClick={closeMobilePanel}
            className={cn(
              "fixed inset-0 z-[55] p-0 block",
              "bg-black/60 backdrop-blur-sm",
            )}
          />
        )}

        <div
          id="chat-side-panel"
          role="complementary"
          aria-label={pluginsLabel}
          className={cn(
            "font-mondwest fixed top-0 right-0 z-[60] flex h-dvh max-h-dvh w-64 min-w-0 flex-col antialiased",
            "border-l border-current/20 text-midground",
            "bg-background-base/95 backdrop-blur-sm",
            "transition-transform duration-200 ease-out",
            mobilePanelOpen
              ? "translate-x-0"
              : "pointer-events-none translate-x-full",
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-current/20 px-5">
            <Typography
              mondwest
              className="text-display font-bold text-[1.125rem] leading-[0.95] tracking-[0.0525rem] text-midground"
            >
              Plugins
            </Typography>
            <Button
              ghost
              size="icon"
              onClick={closeMobilePanel}
              aria-label={t.app.closeModelTools}
            >
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ChatSidebar mode="rich" />
          </div>
        </div>
      </>,
      portalRoot,
    );

  const connecting =
    connectionState === "connecting" || connectionState === "idle";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <PluginSlot name="chat:top" />
      {mobilePluginsPortal}

      {(gatewayError || sessionEnded) && (
        <div className="flex flex-wrap items-center gap-2 border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <span>{gatewayError ?? "Session ended"}</span>
          {sessionEnded && (
            <Button size="sm" outlined onClick={startNewChat}>
              New chat
            </Button>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/30 bg-background-base/50">
          {connecting && messages.length === 0 && (
            <p className="px-4 py-2 text-xs text-text-tertiary">
              Connecting to gateway…
            </p>
          )}

          <ChatTranscript
            messages={messages}
            thinkingStatus={thinkingStatus}
            className="flex-1"
          />

          {overlay && (
            <PromptOverlays
              overlay={overlay}
              gw={gw}
              sessionId={sessionId}
              onClear={clearOverlay}
            />
          )}

          <ChatComposer
            gw={gw}
            sessionId={sessionId}
            model={mergedInfo.model}
            provider={mergedInfo.provider}
            running={mergedInfo.running}
            disabled={connecting || !!overlay}
            onSubmit={handleSubmit}
            onSystem={addSystemMessage}
          />
        </div>

        {!narrow && (
          <div
            id="chat-side-panel"
            role="complementary"
            className="flex min-h-0 shrink-0 flex-col overflow-hidden lg:h-full lg:w-72"
          >
            <ChatSidebar mode="rich" />
          </div>
        )}
      </div>

      <PluginSlot name="chat:bottom" />
    </div>
  );
}
