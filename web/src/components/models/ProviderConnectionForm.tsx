import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@nous-research/ui/ui/components/button";
import { Input } from "@nous-research/ui/ui/components/input";
import { Label } from "@nous-research/ui/ui/components/label";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { OAuthProvidersCard } from "@/components/OAuthProvidersCard";
import { providerApi } from "@/lib/provider-api";
import type { ProviderSource } from "@/lib/provider-api";
import { api } from "@/lib/api";
import { modelsTabHref } from "@/lib/models-routes";
import { useProfileScope } from "@/contexts/useProfileScope";
import { useI18n } from "@/i18n";

interface Props {
  source: ProviderSource;
  busy: boolean;
  onSaveCustom(body: {
    name?: string;
    base_url: string;
    model?: string;
    api_mode?: string;
    api_key?: string;
  }): Promise<void>;
  onRemoveCustom(): Promise<void>;
  onReload(): void;
}

export function ProviderConnectionForm({
  source,
  busy,
  onSaveCustom,
  onRemoveCustom,
  onReload,
}: Props) {
  const { t } = useI18n();
  const { profile: activeProfile } = useProfileScope();
  const [baseUrl, setBaseUrl] = useState(source.base_url ?? "");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const isCustom = source.is_user_defined || source.id === "custom";

  const testConnection = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await providerApi.testConnection(
        isCustom
          ? { base_url: baseUrl, api_key: apiKey }
          : { key: source.key_env ?? "", value: apiKey },
        activeProfile || undefined,
      );
      if (res.ok) {
        setTestMsg(
          res.models?.length
            ? `Connected — ${res.models.length} models found`
            : "Connected",
        );
      } else {
        setTestMsg(res.message || "Connection failed");
      }
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const saveKey = async () => {
    if (!source.key_env || !apiKey.trim()) return;
    await api.setEnvVar(source.key_env, apiKey.trim());
    setApiKey("");
    onReload();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-mondwest text-display text-sm tracking-wider">
          {source.name}
        </h3>
        {source.base_url && (
          <p className="text-xs font-mono text-text-secondary truncate mt-0.5">
            {source.base_url}
          </p>
        )}
        {source.warning && !source.authenticated && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            {source.warning}
          </p>
        )}
      </div>

      {!source.authenticated && source.key_env && !isCustom && (
        <div className="space-y-2 border border-border/50 p-3">
          <Label htmlFor="provider-api-key">API key ({source.key_env})</Label>
          <Input
            id="provider-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste API key"
            className="font-mono-ui text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!apiKey.trim() || busy} onClick={() => void saveKey()}>
              Save key
            </Button>
            <Button
              size="sm"
              outlined
              disabled={testing}
              onClick={() => void testConnection()}
              prefix={testing ? <Spinner /> : undefined}
            >
              Test
            </Button>
          </div>
          {testMsg && (
            <p className="text-xs text-text-secondary">{testMsg}</p>
          )}
        </div>
      )}

      {!isCustom && (
        <OAuthProvidersCard
          filterProviderId={source.slug}
          onAuthChange={onReload}
          compact
        />
      )}

      {isCustom && (
        <div className="space-y-3 border border-border/50 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="custom-base-url">Base URL</Label>
            <Input
              id="custom-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="font-mono-ui text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-api-key">API key (optional)</Label>
            <Input
              id="custom-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono-ui text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-default-model">Default model (optional)</Label>
            <Input
              id="custom-default-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="font-mono-ui text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!baseUrl.trim() || busy}
              onClick={() =>
                void onSaveCustom({
                  base_url: baseUrl.trim(),
                  api_key: apiKey.trim(),
                  model: model.trim(),
                  name: source.name,
                })
              }
            >
              {t.common.save}
            </Button>
            <Button
              size="sm"
              outlined
              disabled={testing}
              onClick={() => void testConnection()}
              prefix={testing ? <Spinner /> : undefined}
            >
              Test
            </Button>
            {source.is_user_defined && (
              <Button
                size="sm"
                outlined
                disabled={busy}
                onClick={() => void onRemoveCustom()}
              >
                Remove
              </Button>
            )}
          </div>
          {testMsg && <p className="text-xs text-text-secondary">{testMsg}</p>}
        </div>
      )}

      <p className="text-xs text-text-tertiary">
        All API keys are stored in{" "}
        <Link to="/env" className="underline">
          Keys
        </Link>
        .{" "}
        <Link to={modelsTabHref("assignments")} className="underline">
          Assignments
        </Link>{" "}
        control which model runs for new sessions.
      </p>
    </div>
  );
}
