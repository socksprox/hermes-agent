/** Tab routing for the Models & Providers hub (`/models?tab=…`). */

export const MODELS_TABS = [
  "providers",
  "assignments",
  "usage",
  "speech",
  "voice",
  "memory",
  "context",
  "agents",
] as const;

export type ModelsTabId = (typeof MODELS_TABS)[number];

export const DEFAULT_MODELS_TAB: ModelsTabId = "providers";

export function parseModelsTab(raw: string | null): ModelsTabId {
  if (raw && (MODELS_TABS as readonly string[]).includes(raw)) {
    return raw as ModelsTabId;
  }
  return DEFAULT_MODELS_TAB;
}

export function modelsTabHref(
  tab: ModelsTabId,
  extra?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return `/models?${params.toString()}`;
}
