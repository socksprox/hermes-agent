import { Button } from "@nous-research/ui/ui/components/button";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useI18n } from "@/i18n";
import { Plus } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useChatSession } from "./ChatSessionContext";
import { modelShortName } from "./modelPickerCore";

const ChatPageHeaderExtraEndContext = createContext<(node: ReactNode) => void>(
  () => {},
);

/** Register extra controls in the dashboard page header (e.g. terminal tools). */
export function useChatPageHeaderExtraEnd(node: ReactNode) {
  const setExtraEnd = useContext(ChatPageHeaderExtraEndContext);
  useLayoutEffect(() => {
    setExtraEnd(node);
    return () => setExtraEnd(null);
  }, [node, setExtraEnd]);
}

interface Props {
  children: React.ReactNode;
}

export function ChatShell({ children }: Props) {
  const { sessionInfo, startNewChat, chatTitle } = useChatSession();
  const { setTitle, setAfterTitle, setEnd } = usePageHeader();
  const { t } = useI18n();
  const [extraEnd, setExtraEnd] = useState<ReactNode>(null);

  const displayTitle =
    (chatTitle ?? "").trim() || t.chatSession.untitledSession;
  const modelLabel = modelShortName(sessionInfo.model, sessionInfo.provider);

  const newChatControls = useMemo(
    () => (
      <>
        <Button
          type="button"
          ghost
          size="sm"
          className="hidden gap-1 sm:inline-flex"
          onClick={startNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          {t.chatSession.newChat}
        </Button>
        <Button
          type="button"
          ghost
          size="icon"
          className="sm:hidden"
          onClick={startNewChat}
          aria-label={t.chatSession.newChat}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </>
    ),
    [startNewChat, t.chatSession.newChat],
  );

  useLayoutEffect(() => {
    setTitle(displayTitle);
    setAfterTitle(
      modelLabel ? (
        <span className="font-mono text-[11px] text-text-tertiary">
          {modelLabel}
          {sessionInfo.running ? ` · ${t.common.live}` : ""}
        </span>
      ) : null,
    );
    setEnd(
      <div className="flex shrink-0 items-center gap-1">
        {extraEnd}
        {newChatControls}
      </div>,
    );
    return () => {
      setTitle(null);
      setAfterTitle(null);
      setEnd(null);
    };
  }, [
    displayTitle,
    modelLabel,
    sessionInfo.running,
    extraEnd,
    newChatControls,
    setTitle,
    setAfterTitle,
    setEnd,
    t.common.live,
  ]);

  const registerExtraEnd = useCallback((node: ReactNode) => {
    setExtraEnd(node);
  }, []);

  return (
    <ChatPageHeaderExtraEndContext.Provider value={registerExtraEnd}>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </ChatPageHeaderExtraEndContext.Provider>
  );
}
