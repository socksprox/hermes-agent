interface Props {
  children: React.ReactNode;
}

export function ChatShell({ children }: Props) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
