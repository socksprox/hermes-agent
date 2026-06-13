import { api } from "@/lib/api";
import { GatewayClient, type ConnectionState } from "@/lib/gatewayClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { toChatMessagesFromRest, type ChatMessage } from "./chatMessages";
import type { SessionInfo } from "./useMessageStream";

interface SessionResumeResponse {
  session_id: string;
  stored_session_id?: string;
  running?: boolean;
  info?: SessionInfo;
  messages?: unknown[];
}

interface SessionCreateResponse {
  session_id: string;
}

const MAX_RECONNECT_ATTEMPTS = 8;

function reconnectDelayMs(attempt: number): number {
  return Math.min(15_000, 1_000 * 2 ** Math.min(attempt, 4));
}

export interface UseChatGatewayOptions {
  profile: string;
  onHydrated?: (messages: ChatMessage[]) => void;
  onSessionInfo?: (info: SessionInfo) => void;
}

export function useChatGateway({
  profile,
  onHydrated,
  onSessionInfo,
}: UseChatGatewayOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeParam = searchParams.get("resume");

  const [version, setVersion] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [storedSessionId, setStoredSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({});
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantReconnectRef = useRef(true);
  const bootingRef = useRef(false);
  const storedIdRef = useRef<string | null>(null);
  const onHydratedRef = useRef(onHydrated);
  const onSessionInfoRef = useRef(onSessionInfo);
  const bindSessionRef = useRef<
    (targetId: string | null, opts: { resume: boolean }) => Promise<void>
  >(() => Promise.resolve());

  onHydratedRef.current = onHydrated;
  onSessionInfoRef.current = onSessionInfo;

  const gw = useMemo(
    () =>
      new GatewayClient({
        onDisconnect: () => {
          if (!wantReconnectRef.current) return;
          if (!storedIdRef.current) return;
          if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setSessionEnded(true);
            setError("Connection lost — session may have ended.");
            return;
          }
          if (reconnectTimerRef.current) return;
          const delay = reconnectDelayMs(reconnectAttemptRef.current);
          reconnectAttemptRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            void bindSessionRef.current(storedIdRef.current, { resume: true });
          }, delay);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const bindSession = useCallback(
    async (targetId: string | null, opts: { resume: boolean }) => {
      if (bootingRef.current) return;
      bootingRef.current = true;
      setError(null);
      setSessionEnded(false);

      try {
        if (gw.state !== "open") {
          await gw.connect();
        }

        reconnectAttemptRef.current = 0;

        if (opts.resume && targetId) {
          const prefetch = api
            .getSessionMessages(targetId, profile)
            .catch(() => null);
          const resumePromise = gw.request<SessionResumeResponse>(
            "session.resume",
            {
              session_id: targetId,
              cols: 80,
              ...(profile ? { profile } : {}),
            },
          );

          const [prefetchResult, resumed] = await Promise.all([
            prefetch,
            resumePromise,
          ]);

          if (prefetchResult?.messages?.length) {
            onHydratedRef.current?.(
              toChatMessagesFromRest(prefetchResult.messages),
            );
          }

          const runtimeId = resumed.session_id;
          const stored = resumed.stored_session_id ?? targetId;
          storedIdRef.current = stored;
          setStoredSessionId(stored);
          setSessionId(runtimeId);

          if (resumed.info) {
            setSessionInfo(resumed.info);
            onSessionInfoRef.current?.(resumed.info);
          }

          if (resumed.running) {
            setSessionInfo((prev) => ({ ...prev, running: true }));
          }
        } else {
          const created = await gw.request<SessionCreateResponse>(
            "session.create",
            {
              ...(profile ? { profile } : {}),
            },
          );
          const runtimeId = created.session_id;
          setSessionId(runtimeId);
          setStoredSessionId(null);
          storedIdRef.current = null;
          onHydratedRef.current?.([]);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
      } finally {
        bootingRef.current = false;
      }
    },
    [gw, profile],
  );

  bindSessionRef.current = bindSession;

  useEffect(() => {
    if (!resumeParam) return;

    let cancelled = false;

    api
      .getSessionLatestDescendant(resumeParam, profile)
      .then((res) => {
        if (cancelled || !res.session_id || res.session_id === resumeParam) {
          return;
        }
        const next = new URLSearchParams(searchParams);
        next.set("resume", res.session_id);
        setSearchParams(next, { replace: true });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [resumeParam, profile, searchParams, setSearchParams]);

  useEffect(() => {
    wantReconnectRef.current = true;
    clearReconnectTimer();

    const offState = gw.onState(setConnectionState);
    const offInfo = gw.on<SessionInfo>("session.info", (ev) => {
      if (ev.payload) {
        setSessionInfo((prev) => ({ ...prev, ...ev.payload }));
        onSessionInfoRef.current?.(ev.payload!);
      }
      if (ev.session_id) setSessionId(ev.session_id);
    });

    void bindSession(resumeParam, { resume: !!resumeParam });

    return () => {
      wantReconnectRef.current = false;
      clearReconnectTimer();
      offState();
      offInfo();
      gw.close();
    };
  }, [gw, resumeParam, profile, bindSession, clearReconnectTimer]);

  const request = useCallback(
    <T,>(method: string, params: Record<string, unknown> = {}) =>
      gw.request<T>(method, params),
    [gw],
  );

  const interrupt = useCallback(async () => {
    if (!sessionId) return;
    await gw.request("session.interrupt", { session_id: sessionId });
    setSessionInfo((prev) => ({ ...prev, running: false }));
  }, [gw, sessionId]);

  const startNewChat = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("resume");
    setSearchParams(next, { replace: true });
    setVersion((v) => v + 1);
  }, [searchParams, setSearchParams]);

  return {
    gw,
    connectionState,
    sessionId,
    storedSessionId,
    sessionInfo,
    error,
    sessionEnded,
    request,
    interrupt,
    startNewChat,
  };
}
