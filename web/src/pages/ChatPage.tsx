import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

import { ChatRichView } from "@/chat/ChatRichView";
import { ChatTerminalView } from "@/chat/ChatTerminalView";

export type DashboardChatSurface = "rich" | "terminal";

export default function ChatPage({ isActive = true }: { isActive?: boolean }) {
  const [surface, setSurface] = useState<DashboardChatSurface>("rich");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getConfig()
      .then((cfg) => {
        if (cancelled) return;
        const raw = cfg?.display?.dashboard_chat_surface;
        setSurface(raw === "terminal" ? "terminal" : "rich");
      })
      .catch(() => {
        if (!cancelled) setSurface("rich");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return surface === "terminal" ? (
    <ChatTerminalView isActive={isActive} />
  ) : (
    <ChatRichView isActive={isActive} />
  );
}
