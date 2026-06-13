import { Button } from "@nous-research/ui/ui/components/button";
import { cn } from "@/lib/utils";
import { Command, Plus, Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { modelShortName } from "./modelPickerCore";
import type { SessionInfo } from "./useMessageStream";

interface Props {
  title?: string;
  sessionInfo: SessionInfo;
  onNewChat: () => void;
  onOpenPalette: () => void;
}

export function ChatHeader({
  title,
  sessionInfo,
  onNewChat,
  onOpenPalette,
}: Props) {
  const { t } = useI18n();
  const displayTitle =
    (title ?? "").trim() || t.chatSession.untitledSession;
  const modelLabel = modelShortName(sessionInfo.model, sessionInfo.provider);

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border/30 bg-background-base/80 px-3 py-2 backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayTitle}</p>
        {modelLabel && (
          <p className="truncate font-mono text-[11px] text-text-tertiary">
            {modelLabel}
            {sessionInfo.running ? ` · ${t.common.live}` : ""}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          ghost
          size="icon"
          onClick={onOpenPalette}
          aria-label={t.chatSession.searchSessions}
          title={`${t.chatSession.searchSessions} (⌘K)`}
        >
          <Search className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          ghost
          size="sm"
          className="hidden gap-1 sm:inline-flex"
          onClick={onNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          {t.chatSession.newChat}
        </Button>

        <Button
          type="button"
          ghost
          size="icon"
          className="sm:hidden"
          onClick={onNewChat}
          aria-label={t.chatSession.newChat}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ChatHeaderHint({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p
      className={cn(
        "hidden items-center gap-1 text-[10px] text-text-tertiary lg:flex",
        className,
      )}
    >
      <Command className="h-3 w-3" />K {t.chatSession.searchSessions}
    </p>
  );
}
