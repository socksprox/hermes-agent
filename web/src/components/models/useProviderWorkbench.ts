import { useCallback, useEffect, useMemo, useState } from "react";
import { providerApi, type ProviderSchemaResponse, type ProviderSource } from "@/lib/provider-api";
import { useProfileScope } from "@/contexts/useProfileScope";

export function useProviderWorkbench(initialSourceId?: string) {
  const { profile: activeProfile } = useProfileScope();
  const profile = activeProfile || undefined;

  const [schema, setSchema] = useState<ProviderSchemaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSourceId ?? null,
  );
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await providerApi.getSchema(profile);
      setSchema(data);
      setSelectedId((prev) => {
        if (prev && data.sources.some((s) => s.id === prev)) return prev;
        if (initialSourceId && data.sources.some((s) => s.id === initialSourceId)) {
          return initialSourceId;
        }
        const current = data.sources.find((s) => s.is_current);
        return current?.id ?? data.sources[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [profile, initialSourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected: ProviderSource | null = useMemo(() => {
    if (!schema || !selectedId) return null;
    return schema.sources.find((s) => s.id === selectedId) ?? null;
  }, [schema, selectedId]);

  const fetchLiveModels = useCallback(async () => {
    if (!selectedId) return;
    setFetchingModels(true);
    try {
      const res = await providerApi.fetchModels(selectedId, profile);
      setFetchedModels(res.models ?? []);
    } catch {
      setFetchedModels([]);
    } finally {
      setFetchingModels(false);
    }
  }, [selectedId, profile]);

  const saveCustomSource = useCallback(
    async (body: {
      name?: string;
      base_url: string;
      model?: string;
      api_mode?: string;
      api_key?: string;
    }) => {
      setBusy(true);
      try {
        if (selected?.is_user_defined && selectedId) {
          await providerApi.updateSource(selectedId, body, profile);
        } else {
          await providerApi.createSource(body, profile);
        }
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load, profile, selected?.is_user_defined, selectedId],
  );

  const removeCustomSource = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await providerApi.deleteSource(selectedId, profile);
      setSelectedId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }, [load, profile, selectedId]);

  return {
    schema,
    loading,
    error,
    selected,
    selectedId,
    setSelectedId,
    fetchedModels,
    fetchingModels,
    fetchLiveModels,
    saveCustomSource,
    removeCustomSource,
    busy,
    reload: load,
  };
}
