import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Label } from "@nous-research/ui/ui/components/label";
import { Select, SelectOption } from "@nous-research/ui/ui/components/select";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { useI18n } from "@/i18n";

type ProviderField = "stt" | "tts";

function CapabilityProviderTab({ field }: { field: ProviderField }) {
  const { t } = useI18n();
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("");

  const load = useCallback(() => {
    Promise.all([api.getConfig(), api.getSchema()]).then(([cfg, sch]) => {
      setConfig(cfg);
      setSchema(sch.fields as Record<string, unknown>);
      const section = (cfg[field] ?? {}) as Record<string, unknown>;
      setProvider(String(section.provider ?? ""));
    });
  }, [field]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const section = { ...((config[field] as object) ?? {}), provider };
      await api.saveConfig({ ...config, [field]: section });
      load();
    } finally {
      setBusy(false);
    }
  };

  const providerKey = `${field}.provider`;
  const fieldMeta = schema?.[providerKey] as { enum?: string[] } | undefined;
  const options = fieldMeta?.enum ?? [provider];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm capitalize">{field} provider</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label>Active provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            {options.filter(Boolean).map((opt) => (
              <SelectOption key={opt} value={opt}>
                {opt}
              </SelectOption>
            ))}
          </Select>
        </div>
        <Button size="sm" disabled={busy} onClick={() => void save()} prefix={busy ? <Spinner /> : undefined}>
          {t.common.save}
        </Button>
        <p className="text-xs text-text-tertiary">
          Advanced {field} settings live in{" "}
          <Link to="/config" className="underline">
            Config
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

export function ModelsSpeechTab() {
  return <CapabilityProviderTab field="stt" />;
}

export function ModelsVoiceTab() {
  return <CapabilityProviderTab field="tts" />;
}
