import { Button } from "@nous-research/ui/ui/components/button";
import { useProfileScope } from "@/contexts/useProfileScope";
import { useCallback, useRef } from "react";

import { PluginSlot } from "@/plugins";

import { ChatComposer } from "./ChatComposer";
import { ChatTranscript } from "./ChatTranscript";
import { PromptOverlays } from "./PromptOverlays";
import { useChatGateway } from "./useChatGateway";
import { useMessageStream } from "./useMessageStream";

export function ChatRichView({ isActive: _isActive = true }: { isActive?: boolean }) {
  const { profile: scopedProfile } = useProfileScope();

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

  const connecting =
    connectionState === "connecting" || connectionState === "idle";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <PluginSlot name="chat:top" />

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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/30 bg-background-base/50">
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

      <PluginSlot name="chat:bottom" />
    </div>
  );
}
