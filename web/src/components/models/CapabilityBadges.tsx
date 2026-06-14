import { Brain } from "lucide-react";
import type { ProviderSource } from "@/lib/provider-api";

export function ModelCapabilityBadges({
  source,
  model,
}: {
  source: ProviderSource;
  model: string;
}) {
  const caps = source.capabilities?.[model];
  if (!caps) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {caps.reasoning && (
        <span className="inline-flex items-center gap-0.5 bg-purple-500/10 px-1 py-0.5 text-[10px] text-purple-600 dark:text-purple-400">
          <Brain className="h-2.5 w-2.5" />
        </span>
      )}
      {caps.fast && (
        <span className="inline-flex items-center bg-muted px-1 py-0.5 text-[10px] text-text-secondary">
          fast
        </span>
      )}
    </div>
  );
}

export function ProviderAuthBadge({
  authenticated,
  warning,
}: {
  authenticated: boolean;
  warning?: string | null;
}) {
  if (authenticated) {
    return (
      <span className="text-[10px] uppercase tracking-wider text-success">
        connected
      </span>
    );
  }
  return (
    <span
      className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400"
      title={warning ?? undefined}
    >
      setup
    </span>
  );
}
