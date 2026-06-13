import { GatewayClient } from "@/lib/gatewayClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useProfileScope } from "@/contexts/useProfileScope";
import { useChatDrawerOpen } from "@/store/chatSessionUi";

import { ChatHeader } from "./ChatHeader";
import {
  ChatSessionProvider,
  type ChatSessionContextValue,
} from "./ChatSessionContext";
import { ChatSessionDrawer } from "./ChatSessionDrawer";
import type { ChatMessage } from "./chatMessages";
import { SessionCommandPalette } from "./SessionCommandPalette";
import { useChatGateway } from "./useChatGateway";
import { useSessionList } from "./useSessionList";

export type DashboardChatSurface = "rich" | "terminal";

interface Props {
  surface: DashboardChatSurface;
  isActive?: boolean;
  children: React.ReactNode;
}

function useMgmtGateway(enabled: boolean) {
  const [version, setVersion] = useState(0);
  const gw = useMemo(
    () => new GatewayClient(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const connect = async () => {
      try {
        if (gw.state !== "open") await gw.connect();
      } catch {
        if (!cancelled) setVersion((v) => v + 1);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      gw.close();
    };
  }, [enabled, gw, version]);

  return gw;
}

function ChatShellRich({
  isActive = true,
  children,
}: {
  isActive?: boolean;
  children: React.ReactNode;
}) {
  const { profile } = useProfileScope();
  const [searchParams] = useSearchParams();
  const resumeSessionId = searchParams.get("resume");
  const [drawerOpen, setDrawerOpen] = useChatDrawerOpen();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const hydrateListenersRef = useRef(new Set<(messages: ChatMessage[]) => void>());

  const registerOnHydrated = useCallback(
    (fn: (messages: ChatMessage[]) => void) => {
      hydrateListenersRef.current.add(fn);
      return () => {
        hydrateListenersRef.current.delete(fn);
      };
    },
    [],
  );

  const gateway = useChatGateway({
    profile,
    onHydrated: (messages) => {
      for (const fn of hydrateListenersRef.current) {
        fn(messages);
      }
    },
  });

  const sessionList = useSessionList({
    gw: gateway.gw,
    sessionId: gateway.sessionId,
    enabled: isActive,
  });

  const contextValue: ChatSessionContextValue = {
    gw: gateway.gw,
    sessionId: gateway.sessionId,
    storedSessionId: gateway.storedSessionId,
    resumeSessionId,
    sessionInfo: gateway.sessionInfo,
    connectionState: gateway.connectionState,
    error: gateway.error,
    sessionEnded: gateway.sessionEnded,
    request: gateway.request,
    startNewChat: gateway.startNewChat,
    surface: "rich",
    sessionList,
    registerOnHydrated,
  };

  useGlobalPaletteShortcut(isActive, () => setPaletteOpen(true));

  const title =
    gateway.sessionInfo.title ??
    sessionList.history.find((s) => s.id === resumeSessionId)?.title;

  return (
    <ChatSessionProvider value={contextValue}>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader
          title={title}
          sessionInfo={gateway.sessionInfo}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen(!drawerOpen)}
          onNewChat={gateway.startNewChat}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <div className="flex min-h-0 flex-1">
          <ChatSessionDrawer
            open={drawerOpen}
            sessionList={sessionList}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
      <SessionCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </ChatSessionProvider>
  );
}

function ChatShellTerminal({
  isActive = true,
  children,
}: {
  isActive?: boolean;
  children: React.ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeSessionId = searchParams.get("resume");
  const [drawerOpen, setDrawerOpen] = useChatDrawerOpen();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const mgmtGw = useMgmtGateway(isActive);

  const sessionList = useSessionList({
    gw: mgmtGw,
    sessionId: null,
    enabled: isActive,
  });

  const startNewChat = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("resume");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const request = useCallback(
    <T,>(method: string, params: Record<string, unknown> = {}) =>
      mgmtGw.request<T>(method, params),
    [mgmtGw],
  );

  const contextValue: ChatSessionContextValue = {
    gw: mgmtGw,
    sessionId: null,
    storedSessionId: resumeSessionId,
    resumeSessionId,
    sessionInfo: {},
    connectionState: mgmtGw.state,
    error: null,
    sessionEnded: false,
    request,
    startNewChat,
    surface: "terminal",
    sessionList,
  };

  useGlobalPaletteShortcut(isActive, () => setPaletteOpen(true));

  const title =
    sessionList.history.find((s) => s.id === resumeSessionId)?.title ??
    sessionList.live.find(
      (s) => s.id === resumeSessionId || s.session_key === resumeSessionId,
    )?.title;

  return (
    <ChatSessionProvider value={contextValue}>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader
          title={title}
          sessionInfo={{}}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen(!drawerOpen)}
          onNewChat={startNewChat}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <div className="flex min-h-0 flex-1">
          <ChatSessionDrawer
            open={drawerOpen}
            sessionList={sessionList}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
      <SessionCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </ChatSessionProvider>
  );
}

function useGlobalPaletteShortcut(isActive: boolean, open: () => void) {
  useEffect(() => {
    if (!isActive) return;

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, open]);
}

export function ChatShell({ surface, isActive = true, children }: Props) {
  if (surface === "terminal") {
    return (
      <ChatShellTerminal isActive={isActive}>{children}</ChatShellTerminal>
    );
  }
  return <ChatShellRich isActive={isActive}>{children}</ChatShellRich>;
}
