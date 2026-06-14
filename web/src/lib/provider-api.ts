import { appendProfileParam, fetchJSON } from "@/lib/api";

export interface ProviderSource {
  id: string;
  name: string;
  slug: string;
  authenticated: boolean;
  auth_type?: string | null;
  key_env?: string | null;
  warning?: string | null;
  base_url?: string;
  api_mode?: string;
  is_current?: boolean;
  is_user_defined?: boolean;
  models: string[];
  total_models?: number;
  capabilities?: Record<string, { fast?: boolean; reasoning?: boolean }>;
  pricing?: Record<string, unknown>;
  free_tier?: boolean | null;
  unavailable_models?: string[];
}

export interface ProviderSchemaResponse {
  sources: ProviderSource[];
  main: { provider: string; model: string };
  fallback_model: string;
  model_context_length: number;
  custom_providers: Array<{
    name: string;
    base_url: string;
    model?: string;
    api_mode?: string;
    models?: Record<string, unknown>;
  }>;
}

export interface ProviderModelsResponse {
  source_id: string;
  models: string[];
  live?: boolean;
  reachable?: boolean;
  error?: string;
}

export interface ProviderValidateResponse {
  ok: boolean;
  reachable: boolean;
  message: string;
  models?: string[];
}

export const providerApi = {
  getSchema: (profile?: string) =>
    fetchJSON<ProviderSchemaResponse>(
      appendProfileParam("/api/providers/schema", profile),
    ),

  createSource: (
    body: {
      name?: string;
      base_url: string;
      model?: string;
      api_mode?: string;
      api_key?: string;
      profile?: string;
    },
    profile?: string,
  ) =>
    fetchJSON<{ ok: boolean; name: string; base_url: string }>(
      appendProfileParam("/api/providers/sources", profile),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, profile: profile || body.profile }),
      },
    ),

  updateSource: (
    sourceId: string,
    body: {
      name?: string;
      base_url?: string;
      model?: string;
      api_mode?: string;
      profile?: string;
    },
    profile?: string,
  ) =>
    fetchJSON<{ ok: boolean; name: string; base_url: string }>(
      appendProfileParam(
        `/api/providers/sources/${encodeURIComponent(sourceId)}`,
        profile,
      ),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, profile: profile || body.profile }),
      },
    ),

  deleteSource: (sourceId: string, profile?: string) =>
    fetchJSON<{ ok: boolean; removed: string }>(
      appendProfileParam(
        `/api/providers/sources/${encodeURIComponent(sourceId)}`,
        profile,
      ),
      { method: "DELETE" },
    ),

  fetchModels: (sourceId: string, profile?: string) =>
    fetchJSON<ProviderModelsResponse>(
      appendProfileParam(
        `/api/providers/sources/${encodeURIComponent(sourceId)}/models`,
        profile,
      ),
    ),

  testConnection: (
    body: {
      key?: string;
      value?: string;
      api_key?: string;
      base_url?: string;
      profile?: string;
    },
    profile?: string,
  ) =>
    fetchJSON<ProviderValidateResponse>(
      appendProfileParam("/api/providers/test", profile),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, profile: profile || body.profile }),
      },
    ),

  clearAccount: (providerId: string, profile?: string) =>
    fetchJSON<{ ok: boolean; provider: string; removed_label?: string }>(
      appendProfileParam(
        `/api/providers/accounts/${encodeURIComponent(providerId)}`,
        profile,
      ),
      { method: "PUT" },
    ),
};
