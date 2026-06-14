import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ChevronDown,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  AuxiliaryModelsResponse,
  ModelsAnalyticsModelEntry,
  ModelsAnalyticsResponse,
} from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { Button } from "@nous-research/ui/ui/components/button";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Stats } from "@nous-research/ui/ui/components/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useI18n } from "@/i18n";
import { AUX_TASKS } from "@/pages/models/constants";

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return "$0";
}

function shortModelName(model: string): string {
  const slashIdx = model.indexOf("/");
  if (slashIdx > 0) return model.slice(slashIdx + 1);
  return model;
}

function modelVendor(model: string, fallback?: string): string {
  const slashIdx = model.indexOf("/");
  if (slashIdx > 0) return model.slice(0, slashIdx);
  return fallback || "";
}

function TokenBar({
  input,
  output,
  cacheRead,
  reasoning,
}: {
  input: number;
  output: number;
  cacheRead: number;
  reasoning: number;
}) {
  const total = input + output + cacheRead + reasoning;
  if (total === 0) return null;
  const segments = [
    { value: cacheRead, color: "#60a5fa", label: "Cache Read" },
    { value: reasoning, color: "#c084fc", label: "Reasoning" },
    { value: input, color: "var(--series-input-token)", label: "Input" },
    { value: output, color: "var(--series-output-token)", label: "Output" },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-1.5">
      <div className="relative flex min-h-[1.5rem] w-full items-stretch overflow-hidden">
        {segments.map((s, i) => (
          <div
            key={i}
            className="relative flex items-center transition-all duration-300"
            style={{
              backgroundColor: `color-mix(in srgb, ${s.color} 70%, transparent)`,
              width: `${(s.value / total) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
        {segments.map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label} {formatTokens(s.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function UseAsMenu({
  provider,
  model,
  isMain,
  onAssigned,
}: {
  provider: string;
  model: string;
  isMain: boolean;
  onAssigned(): void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    message: string;
    scope: "main" | "auxiliary";
    task: string;
  } | null>(null);

  const assign = async (
    scope: "main" | "auxiliary",
    task: string,
    confirmExpensiveModel = false,
  ) => {
    setBusy(true);
    try {
      const result = await api.setModelAssignment({
        confirm_expensive_model: confirmExpensiveModel,
        scope,
        task,
        provider,
        model,
      });
      if (result.confirm_required) {
        setPendingConfirm({
          scope,
          task,
          message: result.confirm_message || "Expensive model warning",
        });
        return;
      }
      onAssigned();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" data-use-as-menu>
      <Button size="sm" outlined onClick={() => setOpen((v) => !v)} disabled={busy} className="h-6 px-2 text-xs">
        Use as <ChevronDown className="h-3 w-3" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] border border-border bg-card shadow-lg">
          <button type="button" className="flex w-full px-3 py-2 text-xs hover:bg-muted/50" onClick={() => assign("main", "")}>
            Main {isMain && "· current"}
          </button>
          {AUX_TASKS.map((t) => (
            <button key={t.key} type="button" className="flex w-full px-3 py-1.5 text-xs hover:bg-muted/50" onClick={() => assign("auxiliary", t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!pendingConfirm}
        title="Expensive Model"
        description={pendingConfirm?.message}
        destructive
        confirmLabel="Switch anyway"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          const p = pendingConfirm;
          if (!p) return;
          setPendingConfirm(null);
          void assign(p.scope, p.task, true);
        }}
      />
    </div>
  );
}

function ModelCard({
  entry,
  rank,
  main,
  onAssigned,
  showTokens,
}: {
  entry: ModelsAnalyticsModelEntry;
  rank: number;
  main: { provider: string; model: string } | null;
  onAssigned(): void;
  showTokens: boolean;
}) {
  const { t } = useI18n();
  const provider = entry.provider || modelVendor(entry.model);
  const isMain = !!main && main.provider === provider && main.model === entry.model;

  return (
    <Card className={isMain ? "ring-1 ring-primary/40" : ""}>
      <CardHeader className="pb-3">
        <div className="flex justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-mono-ui truncate">
              #{rank} {shortModelName(entry.model)}
            </CardTitle>
            {provider && <Badge tone="secondary" className="text-xs mt-1">{provider}</Badge>}
          </div>
          <UseAsMenu provider={provider} model={entry.model} isMain={isMain} onAssigned={onAssigned} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {showTokens && (
          <TokenBar
            input={entry.input_tokens}
            output={entry.output_tokens}
            cacheRead={entry.cache_read_tokens}
            reasoning={entry.reasoning_tokens}
          />
        )}
        <div className="text-text-secondary">
          {entry.sessions} {t.models.sessions}
          {showTokens && entry.estimated_cost > 0 && ` · ${formatCost(entry.estimated_cost)}`}
        </div>
        {entry.last_used_at > 0 && <div>{timeAgo(entry.last_used_at)}</div>}
      </CardContent>
    </Card>
  );
}

export function ModelsUsageTab({
  aux,
  onAssigned,
}: {
  aux: AuxiliaryModelsResponse | null;
  onAssigned(): void;
}) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ModelsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTokens, setShowTokens] = useState(false);
  const { t } = useI18n();
  const { setAfterTitle, setEnd } = usePageHeader();

  const load = useCallback(() => {
    setLoading(true);
    api
      .getModelsAnalytics(days)
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    api.getConfig().then((cfg) => {
      const dash = (cfg?.dashboard ?? {}) as { show_token_analytics?: unknown };
      setShowTokens(dash.show_token_analytics === true);
    });
  }, []);

  useLayoutEffect(() => {
    setAfterTitle(
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <Button key={p.label} size="sm" outlined={days !== p.days} onClick={() => setDays(p.days)}>
            {p.label}
          </Button>
        ))}
        <Button ghost size="icon" onClick={load} disabled={loading}>
          {loading ? <Spinner /> : <RefreshCw />}
        </Button>
      </div>,
    );
    setEnd(null);
    return () => {
      setAfterTitle(null);
      setEnd(null);
    };
  }, [days, loading, load, setAfterTitle, setEnd]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="text-2xl text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data && (
        <Card>
          <CardContent className="py-6">
            <Stats
              items={
                showTokens
                  ? [
                      { label: t.models.modelsUsed, value: String(data.totals.distinct_models) },
                      {
                        label: t.analytics.totalTokens,
                        value: formatTokens(data.totals.total_input + data.totals.total_output),
                      },
                      { label: t.analytics.totalSessions, value: String(data.totals.total_sessions) },
                    ]
                  : [
                      { label: t.models.modelsUsed, value: String(data.totals.distinct_models) },
                      { label: t.analytics.totalSessions, value: String(data.totals.total_sessions) },
                    ]
              }
            />
          </CardContent>
        </Card>
      )}

      {data && data.models.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.models.map((m, i) => (
            <ModelCard
              key={`${m.model}:${m.provider}`}
              entry={m}
              rank={i + 1}
              main={aux?.main ?? null}
              onAssigned={onAssigned}
              showTokens={showTokens}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Cpu className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>{t.models.noModelsData}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
