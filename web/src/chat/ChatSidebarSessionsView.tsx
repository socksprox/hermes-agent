import { Button } from "@nous-research/ui/ui/components/button";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { cn } from "@/lib/utils";
import { ChevronLeft, Plus } from "lucide-react";

import { useI18n } from "@/i18n";

import { useOptionalChatSession } from "./ChatSessionContext";
import { useDashboardChatSurface } from "./DashboardChatSessionProvider";
import { SessionListPanel } from "./SessionListPanel";

interface Props {
  className?: string;
  onBack: () => void;
  closeMobile: () => void;
}

export function ChatSidebarSessionsView({
  className,
  onBack,
  closeMobile,
}: Props) {
  const { t } = useI18n();
  const surface = useDashboardChatSurface();
  const session = useOptionalChatSession();

  const chatLabel =
    (t.app.nav as Record<string, string>).chat ?? "Chat";

  const handleBack = () => {
    onBack();
  };

  if (!surface || !session) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center py-8",
          className,
        )}
        aria-busy="true"
      >
        <Spinner className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-current/10 px-1 py-1.5">
        <Button
          type="button"
          ghost
          size="icon"
          onClick={handleBack}
          aria-label={t.chatSession.backToNav}
          className="shrink-0 text-text-secondary hover:text-midground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="min-w-0 flex-1 truncate px-1 font-mondwest text-display text-sm uppercase tracking-[0.12em] text-midground">
          {chatLabel}
        </span>

        <Button
          type="button"
          ghost
          size="icon"
          onClick={() => session.startNewChat()}
          aria-label={t.chatSession.newChat}
          className="shrink-0 text-text-secondary hover:text-midground"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SessionListPanel
        className="min-h-0 flex-1"
        showNewChat={false}
        showTitle={false}
        onSessionSelect={closeMobile}
      />
    </div>
  );
}
