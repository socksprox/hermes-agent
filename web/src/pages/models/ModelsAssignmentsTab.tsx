import { useCallback, useEffect, useState } from "react";
import { Cpu, Settings2, Star, X } from "lucide-react";
import { api } from "@/lib/api";
import type { AuxiliaryModelsResponse } from "@/lib/api";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Input } from "@nous-research/ui/ui/components/input";
import { Label } from "@nous-research/ui/ui/components/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ModelInfoCard } from "@/components/ModelInfoCard";
import { ModelPickerDialog } from "@/components/models/ModelPickerDialog";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { cn, themedBody } from "@/lib/utils";
import { AUX_TASKS } from "@/pages/models/constants";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

type PickerTarget = { kind: "main" } | { kind: "aux"; task: string };

function AuxiliaryTasksModal({
  aux,
  refreshKey,
  onSaved,
  onClose,
}: {
  aux: AuxiliaryModelsResponse | null;
  refreshKey: number;
  onSaved(): void;
  onClose(): void;
}) {
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const modalRef = useModalBehavior({ open: true, onClose });

  const resetAllAux = async () => {
    setConfirmReset(false);
    setResetBusy(true);
    try {
      await api.setModelAssignment({
        scope: "auxiliary",
        task: "__reset__",
        provider: "",
        model: "",
      });
      onSaved();
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className={cn(themedBody, "relative w-full max-w-2xl max-h-[80vh] border border-border bg-card shadow-2xl flex flex-col")}>
        <Button ghost size="icon" onClick={onClose} className="absolute right-2 top-2" aria-label="Close">
          <X />
        </Button>
        <header className="p-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-3 pr-8">
            <h2 className="font-mondwest text-display text-base tracking-wider">Auxiliary Tasks</h2>
            <Button size="sm" outlined onClick={() => setConfirmReset(true)} disabled={resetBusy}>
              Reset all to auto
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-1">
          {AUX_TASKS.map((t) => {
            const cur = aux?.tasks.find((a) => a.task === t.key);
            const isAuto = !cur || cur.provider === "auto" || !cur.provider;
            return (
              <div key={t.key} className="flex items-center justify-between gap-3 px-3 py-2 border border-border/30">
                <div className="min-w-0">
                  <div className="text-xs font-medium">{t.label}</div>
                  <div className="text-xs font-mono text-text-secondary truncate">
                    {isAuto ? "auto" : `${cur?.provider} · ${cur?.model || "(default)"}`}
                  </div>
                </div>
                <Button size="sm" outlined onClick={() => setPicker({ kind: "aux", task: t.key })}>
                  Change
                </Button>
              </div>
            );
          })}
        </div>
        {picker?.kind === "aux" && (
          <ModelPickerDialog
            key={`picker-${refreshKey}`}
            loader={api.getModelOptions}
            alwaysGlobal
            title={`Set Auxiliary: ${AUX_TASKS.find((t) => t.key === picker.task)?.label ?? picker.task}`}
            onApply={async ({ provider, model, confirmExpensiveModel }) => {
              const result = await api.setModelAssignment({
                confirm_expensive_model: confirmExpensiveModel,
                scope: "auxiliary",
                task: picker.task,
                provider,
                model,
              });
              if (!result.confirm_required) onSaved();
              return result;
            }}
            onClose={() => setPicker(null)}
          />
        )}
        <ConfirmDialog
          open={confirmReset}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => void resetAllAux()}
          title="Reset auxiliary models"
          description="Reset every auxiliary task to auto?"
          destructive
          confirmLabel="Reset all"
          loading={resetBusy}
        />
      </div>
    </div>
  );
}

export function ModelsAssignmentsTab({
  aux,
  refreshKey,
  onSaved,
}: {
  aux: AuxiliaryModelsResponse | null;
  refreshKey: number;
  onSaved(): void;
}) {
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [auxModalOpen, setAuxModalOpen] = useState(false);
  const [fallback, setFallback] = useState("");
  const [savingFallback, setSavingFallback] = useState(false);
  const [recommended, setRecommended] = useState<string | null>(null);

  const mainProv = aux?.main.provider ?? "";
  const mainModel = aux?.main.model ?? "";
  const auxOverrideCount =
    aux?.tasks.filter((a) => a.provider && a.provider !== "auto").length ?? 0;

  useEffect(() => {
    api.getConfig().then((cfg) => {
      setFallback(String(cfg.fallback_model ?? ""));
    });
  }, [refreshKey]);

  useEffect(() => {
    if (mainProv && !mainModel) {
      api
        .getRecommendedDefault(mainProv)
        .then((r) => setRecommended(r.model || null))
        .catch(() => setRecommended(null));
    } else {
      setRecommended(null);
    }
  }, [mainProv, mainModel, refreshKey]);

  const saveFallback = async () => {
    setSavingFallback(true);
    try {
      const cfg = await api.getConfig();
      await api.saveConfig({ ...cfg, fallback_model: fallback.trim() });
      onSaved();
    } finally {
      setSavingFallback(false);
    }
  };

  const applyAssignment = useCallback(
    async (args: {
      confirmExpensiveModel?: boolean;
      scope: "main" | "auxiliary";
      task: string;
      provider: string;
      model: string;
    }) => {
      const result = await api.setModelAssignment({
        confirm_expensive_model: args.confirmExpensiveModel,
        scope: args.scope,
        task: args.task,
        provider: args.provider,
        model: args.model,
      });
      if (!result.confirm_required) onSaved();
      return result;
    },
    [onSaved],
  );

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Model assignments</CardTitle>
          </div>
          <p className="text-xs text-text-secondary">Applies to new sessions</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 border border-border/50 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Star className="h-3 w-3 text-primary" /> Main model
              </div>
              <div className="text-xs font-mono text-text-secondary truncate">
                {mainProv || "(unset)"}
                {mainProv && mainModel && " · "}
                {mainModel || "(unset)"}
              </div>
              {recommended && !mainModel && (
                <p className="text-xs text-primary mt-1">
                  Suggested: {recommended}
                </p>
              )}
            </div>
            <Button size="sm" onClick={() => setPicker({ kind: "main" })}>
              Change
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 border border-border/50 px-3 py-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <Cpu className="h-3 w-3" /> Auxiliary tasks
              </div>
              <div className="text-xs font-mono text-text-secondary">
                {auxOverrideCount > 0
                  ? `${auxOverrideCount} overrides`
                  : `${AUX_TASKS.length} tasks · all auto`}
              </div>
            </div>
            <Button size="sm" outlined onClick={() => setAuxModalOpen(true)}>
              Configure
            </Button>
          </div>

          <div className="space-y-2 border border-border/50 p-3">
            <Label htmlFor="fallback-model">Fallback model</Label>
            <div className="flex gap-2">
              <Input
                id="fallback-model"
                value={fallback}
                onChange={(e) => setFallback(e.target.value)}
                placeholder="provider/model"
                className="font-mono-ui text-sm"
              />
              <Button
                size="sm"
                outlined
                disabled={savingFallback}
                onClick={() => void saveFallback()}
                prefix={savingFallback ? <Spinner /> : undefined}
              >
                Save
              </Button>
            </div>
          </div>

          {mainModel && (
            <ModelInfoCard currentModel={mainModel} refreshKey={refreshKey} />
          )}
        </CardContent>
      </Card>

      {picker && (
        <ModelPickerDialog
          key={`picker-${refreshKey}`}
          loader={api.getModelOptions}
          alwaysGlobal
          title="Set Main Model"
          onApply={({ provider, model, confirmExpensiveModel }) =>
            applyAssignment({
              confirmExpensiveModel,
              scope: "main",
              task: "",
              provider,
              model,
            })
          }
          onClose={() => setPicker(null)}
        />
      )}

      {auxModalOpen && (
        <AuxiliaryTasksModal
          aux={aux}
          refreshKey={refreshKey}
          onSaved={onSaved}
          onClose={() => setAuxModalOpen(false)}
        />
      )}
    </div>
  );
}
