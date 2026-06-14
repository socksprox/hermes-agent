import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Select, SelectOption } from "@nous-research/ui/ui/components/select";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { useI18n } from "@/i18n";

const MEMORY_BUILTIN = "__hermes_memory_builtin__";

export function ModelsMemoryTab() {
  const { t } = useI18n();
  const [hub, setHub] = useState<Awaited<ReturnType<typeof api.getPluginsHub>> | null>(null);
  const [sel, setSel] = useState(MEMORY_BUILTIN);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.getPluginsHub().then((h) => {
      setHub(h);
      setSel(h.providers.memory_provider || MEMORY_BUILTIN);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await api.savePluginProviders({
        memory_provider: sel === MEMORY_BUILTIN ? "" : sel,
        context_engine: hub?.providers.context_engine ?? "compressor",
      });
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Memory / embedding provider</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <Select value={sel} onValueChange={setSel}>
          <SelectOption value={MEMORY_BUILTIN}>Built-in Hermes memory</SelectOption>
          {hub?.providers.memory_options.map((o) => (
            <SelectOption key={o.name} value={o.name}>
              {o.name}
            </SelectOption>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void save()} prefix={busy ? <Spinner /> : undefined}>
            {t.common.save}
          </Button>
          <Link to="/plugins" className="text-xs uppercase inline-flex items-center border border-border px-3 py-1.5 hover:bg-muted/40">
            Install plugins
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelsContextTab() {
  const { t } = useI18n();
  const [hub, setHub] = useState<Awaited<ReturnType<typeof api.getPluginsHub>> | null>(null);
  const [sel, setSel] = useState("compressor");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getPluginsHub().then((h) => {
      setHub(h);
      setSel(h.providers.context_engine || "compressor");
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.savePluginProviders({
        memory_provider: hub?.providers.memory_provider ?? "",
        context_engine: sel,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Context engine</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <Select value={sel} onValueChange={setSel}>
          <SelectOption value="compressor">Built-in compressor</SelectOption>
          {hub?.providers.context_options
            .filter((o) => o.name !== "compressor")
            .map((o) => (
              <SelectOption key={o.name} value={o.name}>
                {o.name}
              </SelectOption>
            ))}
        </Select>
        <Button size="sm" disabled={busy} onClick={() => void save()} prefix={busy ? <Spinner /> : undefined}>
          {t.common.save}
        </Button>
        <p className="text-xs text-text-tertiary">
          Rerank and advanced retrieval are configured per memory plugin.
        </p>
      </CardContent>
    </Card>
  );
}

export function ModelsAgentsTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Delegation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-text-secondary space-y-2">
          <p>Subagent orchestration uses the main model and toolsets configured under Assignments.</p>
          <Link to="/config" className="underline text-foreground">
            delegation.* in Config
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ACP & MCP</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-text-secondary space-y-2">
          <p>IDE integrations and MCP servers extend agent capability without separate runner plugins.</p>
          <Link to="/mcp" className="underline text-foreground">
            MCP servers
          </Link>
          {" · "}
          <Link to="/docs" className="underline text-foreground">
            Documentation
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
