import { Button } from "@nous-research/ui/ui/components/button";
import { Plus } from "lucide-react";

import { useI18n } from "@/i18n";
import { modelShortName } from "./modelPickerCore";
import type { SessionInfo } from "./useMessageStream";

interface Props {
  title?: string;
  sessionInfo: SessionInfo;
  onNewChat: () => void;
}

export function ChatHeader({
  title,
  sessionInfo,
  onNewChat,
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
