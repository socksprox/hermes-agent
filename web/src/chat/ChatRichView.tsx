import { Button } from "@nous-research/ui/ui/components/button";
import { useCallback, useEffect, useRef } from "react";

import { PluginSlot } from "@/plugins";

import type { SubmitPayload } from "./attachmentTypes";
import {
  buildSubmitText,
  buildUserDisplayContent,
  restoreAttachmentsFromSnapshot,
  syncAttachmentsForSubmit,
  withSessionBusyRetry,
} from "./attachFiles";
import { useChatSession } from "./ChatSessionContext";
import { ChatComposer } from "./ChatComposer";
import { ChatTranscript } from "./ChatTranscript";
import { PromptOverlays } from "./PromptOverlays";
import { useSessionList } from "./useSessionList";
import { useMessageQueue } from "./useMessageQueue";
import { useMessageStream } from "./useMessageStream";

export function ChatRichView({ isActive: _isActive = true }: { isActive?: boolean }) {
  const {
    gw,
    connectionState,
    sessionId,
    sessionInfo: gatewayInfo,
    error: gatewayError,
    sessionEnded,
    request,
    startNewChat,
    registerOnHydrated,
  } = useChatSession();

  const resetRef = useRef<(msgs: Parameters<typeof resetMessages>[0]) => void>(
    () => {},
  );
  const pendingImmediateRef = useRef<SubmitPayload | null>(null);
  const drainingRef = useRef(false);

  const messageQueue = useMessageQueue();

  const sessionList = useSessionList({
    gw,
    sessionId,
    enabled: !!gw,
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

  useEffect(() => {
    if (!registerOnHydrated) return;
    return registerOnHydrated((next) => {
      messageQueue.clear();
      pendingImmediateRef.current = null;
      resetRef.current(next);
    });
  }, [registerOnHydrated, messageQueue]);

  const mergedInfo = { ...gatewayInfo, ...sessionInfo };

  const submitMessage = useCallback(
    async (payload: SubmitPayload) => {
      if (!sessionId || !gw) return;

      const synced = await syncAttachmentsForSubmit(payload.attachments, {
        request: (method, params) => request(method, params),
        sessionId,
      });

      const promptText = buildSubmitText(payload.text, synced);
      const displayContent = buildUserDisplayContent(payload.text, synced);
      const displayAttachments = synced.map((a) => ({
        kind: a.kind,
        label: a.label,
        previewUrl: a.kind === "image" ? a.dataUrl : undefined,
        refText: a.refText,
      }));

      addUserMessage(displayContent, { attachments: displayAttachments });
      await withSessionBusyRetry(() =>
        request("prompt.submit", { session_id: sessionId, text: promptText }),
      );
    },
    [sessionId, gw, addUserMessage, request],
  );

  const handleSubmit = useCallback(
    async (payload: SubmitPayload) => {
      if (!sessionId) return;
      await submitMessage(payload);
    },
    [sessionId, submitMessage],
  );

  const handleEnqueue = useCallback(
    (payload: SubmitPayload) => {
      messageQueue.enqueue(payload.text, payload.attachments);
    },
    [messageQueue],
  );

  const handleQueueSendNow = useCallback(
    async (id: string) => {
      const item = messageQueue.take(id);
      if (!item || !sessionId || !gw) return;

      const payload: SubmitPayload = {
        text: item.text,
        attachments: restoreAttachmentsFromSnapshot(item.attachments),
      };
      pendingImmediateRef.current = payload;

      if (mergedInfo.running) {
        try {
          await gw.request("session.interrupt", { session_id: sessionId });
        } catch {
          messageQueue.enqueue(payload.text, payload.attachments);
          pendingImmediateRef.current = null;
        }
      }
    },
    [messageQueue, sessionId, gw, mergedInfo.running],
  );

  const handleQueueEdit = useCallback(
    (id: string, _text: string) => {
      messageQueue.remove(id);
    },
    [messageQueue],
  );

  const connecting =
    connectionState === "connecting" || connectionState === "idle";

  useEffect(() => {
    if (mergedInfo.running || connecting || overlay || drainingRef.current) {
      return;
    }

    const immediate = pendingImmediateRef.current;
    if (immediate) {
      pendingImmediateRef.current = null;
      drainingRef.current = true;
      void submitMessage(immediate).finally(() => {
        drainingRef.current = false;
      });
      return;
    }

    const head = messageQueue.peek();
    if (!head) return;

    messageQueue.dequeue();
    drainingRef.current = true;
    void submitMessage({
      text: head.text,
      attachments: restoreAttachmentsFromSnapshot(head.attachments),
    }).finally(() => {
      drainingRef.current = false;
    });
  }, [mergedInfo.running, connecting, overlay, messageQueue.queue, submitMessage]);

  useEffect(() => {
    messageQueue.clear();
    pendingImmediateRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when session changes
  }, [sessionId]);

  const recentSessions = sessionList.history.slice(0, 5);

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
          recentSessions={recentSessions}
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
          queue={messageQueue.queue}
          onSubmit={handleSubmit}
          onEnqueue={handleEnqueue}
          onQueueSendNow={(id) => void handleQueueSendNow(id)}
          onQueueEdit={handleQueueEdit}
          onQueueDelete={messageQueue.remove}
          onSystem={addSystemMessage}
        />
      </div>

      <PluginSlot name="chat:bottom" />
    </div>
  );
}
