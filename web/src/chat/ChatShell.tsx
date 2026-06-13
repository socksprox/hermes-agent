import { useChatSession } from "./ChatSessionContext";
import { ChatHeader } from "./ChatHeader";

interface Props {
  children: React.ReactNode;
}

export function ChatShell({ children }: Props) {
  const {
    sessionInfo,
    startNewChat,
    openSessionPalette,
    chatTitle,
  } = useChatSession();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader
        title={chatTitle}
        sessionInfo={sessionInfo}
        onNewChat={startNewChat}
        onOpenPalette={() => openSessionPalette?.()}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
