import { Plus, Star } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Input } from "@nous-research/ui/ui/components/input";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { ModelCapabilityBadges } from "@/components/models/CapabilityBadges";
import type { ProviderSource } from "@/lib/provider-api";
import { api } from "@/lib/api";
import { useState } from "react";

interface Props {
  source: ProviderSource;
  fetchedModels: string[];
  fetchingModels: boolean;
  onFetch(): void;
  onAssigned(): void;
  mainModel: string;
  mainProvider: string;
}

export function ProviderModelTable({
  source,
  fetchedModels,
  fetchingModels,
  onFetch,
  onAssigned,
  mainModel,
  mainProvider,
}: Props) {
  const [customId, setCustomId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const configured = source.models ?? [];
  const available = fetchedModels.filter((m) => !configured.includes(m));

  const setMain = async (model: string) => {
    setBusy(model);
    try {
      await api.setModelAssignment({
        scope: "main",
        task: "",
        provider: source.slug,
        model,
      });
      onAssigned();
    } finally {
      setBusy(null);
    }
  };

  const addCustom = async () => {
    const id = customId.trim();
    if (!id) return;
    await setMain(id);
    setCustomId("");
  };

  return (
    <div className="space-y-4 border-t border-border/50 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-display text-xs tracking-wider text-text-secondary">
          Models
        </h4>
        <Button
          size="sm"
          outlined
          onClick={onFetch}
          disabled={fetchingModels}
          prefix={fetchingModels ? <Spinner /> : undefined}
          className="text-xs uppercase"
        >
          Fetch models
        </Button>
      </div>

      {configured.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary px-1">
            Configured ({configured.length})
          </div>
          {configured.map((model) => {
            const isMain =
              mainProvider === source.slug && mainModel === model;
            return (
              <div
                key={model}
                className="flex items-center justify-between gap-2 border border-border/40 px-2 py-1.5 text-xs font-mono-ui"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{model}</span>
                  <ModelCapabilityBadges source={source} model={model} />
                  {isMain && (
                    <Star className="h-3 w-3 text-primary shrink-0" />
                  )}
                </div>
                <Button
                  size="sm"
                  outlined
                  disabled={busy === model}
                  onClick={() => void setMain(model)}
                  className="h-6 text-[10px] uppercase shrink-0"
                >
                  {isMain ? "Main" : "Set main"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {available.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary px-1">
            Available ({available.length})
          </div>
          {available.map((model) => (
            <div
              key={model}
              className="flex items-center justify-between gap-2 px-2 py-1 text-xs font-mono-ui hover:bg-muted/30"
            >
              <span className="truncate">{model}</span>
              <Button
                size="sm"
                ghost
                onClick={() => void setMain(model)}
                className="h-6 px-2"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={customId}
          onChange={(e) => setCustomId(e.target.value)}
          placeholder="Custom model ID"
          className="font-mono-ui text-xs flex-1"
        />
        <Button size="sm" outlined onClick={() => void addCustom()} disabled={!customId.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
