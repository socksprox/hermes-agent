import { Plus } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Select, SelectOption } from "@nous-research/ui/ui/components/select";
import type { ProviderSource } from "@/lib/provider-api";
import { cn } from "@/lib/utils";
import { ProviderAuthBadge } from "@/components/models/CapabilityBadges";
import { useBelowBreakpoint } from "@nous-research/ui/hooks/use-below-breakpoint";

interface Props {
  sources: ProviderSource[];
  selectedId: string | null;
  onSelect(id: string): void;
  onAddCustom(): void;
}

export function ProviderSourceRail({
  sources,
  selectedId,
  onSelect,
  onAddCustom,
}: Props) {
  const narrow = useBelowBreakpoint(768);

  if (narrow) {
    return (
      <div className="space-y-2">
        <Select
          value={selectedId ?? ""}
          onValueChange={(v) => onSelect(v)}
          className="w-full"
        >
          {sources.map((s) => (
            <SelectOption key={s.id} value={s.id}>
              {s.name}
            </SelectOption>
          ))}
        </Select>
        <Button size="sm" outlined onClick={onAddCustom} className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add endpoint
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1 border border-border/60 bg-card/50 p-2">
      <div className="px-2 py-1 text-display text-xs tracking-wider text-text-tertiary">
        Sources
      </div>
      <div className="max-h-[min(60vh,32rem)] overflow-y-auto space-y-0.5">
        {sources.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex w-full min-w-0 items-center justify-between gap-2 px-2 py-2 text-left text-xs hover:bg-muted/40 transition-colors",
              selectedId === s.id && "bg-muted/60 ring-1 ring-border",
            )}
          >
            <span className="truncate font-medium">{s.name}</span>
            <ProviderAuthBadge
              authenticated={s.authenticated}
              warning={s.warning}
            />
          </button>
        ))}
      </div>
      <Button size="sm" outlined onClick={onAddCustom} className="mt-2 w-full text-xs">
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add endpoint
      </Button>
    </div>
  );
}
