import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  MODELS_TABS,
  parseModelsTab,
  type ModelsTabId,
} from "@/lib/models-routes";
import { api } from "@/lib/api";
import type { AuxiliaryModelsResponse } from "@/lib/api";
import { usePageHeader } from "@/contexts/usePageHeader";
import { PluginSlot } from "@/plugins";
import { ModelsProvidersTab } from "@/pages/models/ModelsProvidersTab";
import { ModelsAssignmentsTab } from "@/pages/models/ModelsAssignmentsTab";
import { ModelsUsageTab } from "@/pages/models/ModelsUsageTab";
import { ModelsSpeechTab, ModelsVoiceTab } from "@/pages/models/ModelsCapabilityTabs";
import {
  ModelsMemoryTab,
  ModelsContextTab,
  ModelsAgentsTab,
} from "@/pages/models/ModelsPluginTabs";

const TAB_LABELS: Record<ModelsTabId, string> = {
  providers: "Providers",
  assignments: "Assignments",
  usage: "Usage",
  speech: "Speech",
  voice: "Voice",
  memory: "Memory",
  context: "Context",
  agents: "Agents",
};

export default function ModelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseModelsTab(searchParams.get("tab"));
  const { setAfterTitle, setEnd } = usePageHeader();
  const [aux, setAux] = useState<AuxiliaryModelsResponse | null>(null);
  const [saveKey, setSaveKey] = useState(0);

  const refreshAux = useCallback(() => {
    api
      .getAuxiliaryModels()
      .then(setAux)
      .catch(() => {});
  }, []);

  const onAssigned = useCallback(() => {
    refreshAux();
    setSaveKey((k) => k + 1);
  }, [refreshAux]);

  useEffect(() => {
    refreshAux();
  }, [refreshAux]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") refreshAux();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshAux]);

  useEffect(() => {
    if (tab === "usage") return;
    setAfterTitle(null);
    setEnd(null);
  }, [tab, setAfterTitle, setEnd]);

  const setTab = (next: ModelsTabId) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    if (next !== "providers") params.delete("source");
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-6">
      <PluginSlot name="models:top" />

      <div className="flex flex-wrap gap-1 border-b border-border/60 pb-2">
        {MODELS_TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "px-3 py-1.5 text-xs uppercase tracking-wider transition-colors",
              tab === id
                ? "bg-muted text-foreground font-medium"
                : "text-text-secondary hover:text-foreground hover:bg-muted/40",
            )}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>

      {tab === "providers" && <ModelsProvidersTab onAssigned={onAssigned} />}
      {tab === "assignments" && (
        <ModelsAssignmentsTab aux={aux} refreshKey={saveKey} onSaved={onAssigned} />
      )}
      {tab === "usage" && <ModelsUsageTab aux={aux} onAssigned={onAssigned} />}
      {tab === "speech" && <ModelsSpeechTab />}
      {tab === "voice" && <ModelsVoiceTab />}
      {tab === "memory" && <ModelsMemoryTab />}
      {tab === "context" && <ModelsContextTab />}
      {tab === "agents" && <ModelsAgentsTab />}

      <PluginSlot name="models:bottom" />
    </div>
  );
}
