import { api, type SessionMessage } from "@/lib/api";
import { GatewayClient, type ConnectionState } from "@/lib/gatewayClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { toChatMessagesFromRest, type ChatMessage } from "./chatMessages";
import type { SessionInfo } from "./useMessageStream";

interface SessionResumeResponse {
  session_id: string;
  stored_session_id?: string;
  resumed?: string;
  running?: boolean;
  info?: SessionInfo;
  messages?: unknown[];
}

interface SessionActivateResponse {
  session_id: string;
  session_key?: string;
  running?: boolean;
  status?: string;
  info?: SessionInfo;
  messages?: unknown[];
}

interface SessionCreateResponse {
  session_id: string;
  stored_session_id?: string;
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
  const sessionIdRef = useRef<string | null>(null);
  const urlPersistedRef = useRef(false);
  /** Set before URL ?resume= sync so the gateway effect skips teardown/rebind. */
  const persistUrlSyncRef = useRef(false);
  const resumeParamRef = useRef(resumeParam);
  const onHydratedRef = useRef(onHydrated);
  const onSessionInfoRef = useRef(onSessionInfo);
  const bindSessionRef = useRef<
    (targetId: string | null, opts: { resume: boolean }) => Promise<void>
  >(() => Promise.resolve());

  onHydratedRef.current = onHydrated;
  onSessionInfoRef.current = onSessionInfo;
  sessionIdRef.current = sessionId;
  resumeParamRef.current = resumeParam;

  const syncResumeUrl = useCallback(
    (storedId: string) => {
      persistUrlSyncRef.current = true;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("resume", storedId);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

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
          urlPersistedRef.current = true;
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
          } else if (
            Array.isArray(resumed.messages) &&
            resumed.messages.length > 0
          ) {
            onHydratedRef.current?.(
              toChatMessagesFromRest(resumed.messages as SessionMessage[]),
            );
          }

          const runtimeId = resumed.session_id;
          const stored = resumed.stored_session_id ?? resumed.resumed ?? targetId;
          storedIdRef.current = stored;
          sessionIdRef.current = runtimeId;
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
          urlPersistedRef.current = false;
          const created = await gw.request<SessionCreateResponse>(
            "session.create",
            {
              ...(profile ? { profile } : {}),
            },
          );
          const runtimeId = created.session_id;
          const stored = created.stored_session_id ?? null;
          setSessionId(runtimeId);
          setStoredSessionId(stored);
          storedIdRef.current = stored;
          sessionIdRef.current = runtimeId;
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
        persistUrlSyncRef.current = true;
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set("resume", res.session_id);
            return next;
          },
          { replace: true },
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [resumeParam, profile, setSearchParams]);

  // WebSocket lifecycle — only reconnect when the client instance changes.
  useEffect(() => {
    wantReconnectRef.current = true;
    clearReconnectTimer();

    const offState = gw.onState(setConnectionState);
    const offInfo = gw.on<SessionInfo>("session.info", (ev) => {
      if (ev.payload) {
        setSessionInfo((prev) => ({ ...prev, ...ev.payload }));
        onSessionInfoRef.current?.(ev.payload!);
      }
      if (ev.session_id) {
        sessionIdRef.current = ev.session_id;
        setSessionId(ev.session_id);
      }
    });

    const offComplete = gw.on("message.complete", () => {
      if (urlPersistedRef.current || resumeParamRef.current) return;
      const persistId = storedIdRef.current;
      if (!persistId) return;
      urlPersistedRef.current = true;
      setStoredSessionId(persistId);
      syncResumeUrl(persistId);
    });

    return () => {
      wantReconnectRef.current = false;
      clearReconnectTimer();
      offState();
      offInfo();
      offComplete();
      if (persistUrlSyncRef.current) {
        persistUrlSyncRef.current = false;
        return;
      }
      gw.close();
    };
  }, [gw, clearReconnectTimer, syncResumeUrl]);

  // Session bind — URL deep-links and cold resumes; must not close the socket.
  useEffect(() => {
    const alreadyOnThisSession =
      !!resumeParam &&
      storedIdRef.current === resumeParam &&
      !!sessionIdRef.current &&
      gw.state === "open";

    if (!alreadyOnThisSession) {
      void bindSession(resumeParam, { resume: !!resumeParam });
    } else {
      setError(null);
    }
  }, [gw, resumeParam, profile, bindSession]);

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

  const activateLiveSession = useCallback(
    async (runtimeId: string) => {
      if (bootingRef.current) return;
      setError(null);
      setSessionEnded(false);

      try {
        if (gw.state !== "open") {
          await gw.connect();
        }

        const activated = await gw.request<SessionActivateResponse>(
          "session.activate",
          { session_id: runtimeId },
        );

        const runtime = activated.session_id;
        const stored = activated.session_key ?? storedIdRef.current ?? runtimeId;
        const running = Boolean(
          activated.running ||
            activated.status === "working" ||
            activated.status === "waiting",
        );

        storedIdRef.current = stored;
        sessionIdRef.current = runtime;
        urlPersistedRef.current = true;
        setSessionId(runtime);
        setStoredSessionId(stored);

        const info = { ...(activated.info ?? {}), running };
        setSessionInfo(info);
        onSessionInfoRef.current?.(info);

        if (Array.isArray(activated.messages) && activated.messages.length > 0) {
          onHydratedRef.current?.(
            toChatMessagesFromRest(activated.messages as SessionMessage[]),
          );
        }

        syncResumeUrl(stored);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
      }
    },
    [gw, syncResumeUrl],
  );

  const resumeStoredSession = useCallback(
    async (storedId: string) => {
      const alreadyOnThisSession =
        storedIdRef.current === storedId &&
        !!sessionIdRef.current &&
        gw.state === "open";

      if (alreadyOnThisSession) {
        syncResumeUrl(storedId);
        return;
      }

      await bindSession(storedId, { resume: true });
      syncResumeUrl(storedId);
    },
    [bindSession, gw.state, syncResumeUrl],
  );

  const startNewChat = useCallback(() => {
    wantReconnectRef.current = false;
    clearReconnectTimer();
    bootingRef.current = false;
    urlPersistedRef.current = false;
    persistUrlSyncRef.current = false;
    storedIdRef.current = null;
    sessionIdRef.current = null;
    reconnectAttemptRef.current = 0;
    setSessionId(null);
    setStoredSessionId(null);
    setSessionInfo({});
    setSessionEnded(false);
    setError(null);
    onHydratedRef.current?.([]);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("resume");
        return next;
      },
      { replace: true },
    );
    setVersion((v) => v + 1);
  }, [clearReconnectTimer, setSearchParams]);

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
    activateLiveSession,
    resumeStoredSession,
    startNewChat,
  };
}
