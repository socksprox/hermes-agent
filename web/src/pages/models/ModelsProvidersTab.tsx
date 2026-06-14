import { useCallback, useState } from "react";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { ProviderSourceRail } from "@/components/models/ProviderSourceRail";
import { ProviderConnectionForm } from "@/components/models/ProviderConnectionForm";
import { ProviderModelTable } from "@/components/models/ProviderModelTable";
import { useProviderWorkbench } from "@/components/models/useProviderWorkbench";
import { useSearchParams } from "react-router-dom";

export function ModelsProvidersTab({ onAssigned }: { onAssigned(): void }) {
  const [searchParams] = useSearchParams();
  const initialSource = searchParams.get("source") ?? undefined;
  const {
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
    reload,
  } = useProviderWorkbench(initialSource);

  const [addingCustom, setAddingCustom] = useState(false);
  const onReload = useCallback(() => void reload(), [reload]);

  if (loading && !schema) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="text-2xl text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  const sources = schema?.sources ?? [];
  const main = schema?.main ?? { provider: "", model: "" };

  const displaySelected = addingCustom
    ? {
        id: "__new__",
        name: "",
        slug: "custom",
        authenticated: false,
        models: [],
        is_user_defined: true,
        base_url: "",
      }
    : selected;

  const handleSaveCustom = async (body: Parameters<typeof saveCustomSource>[0]) => {
    await saveCustomSource(body);
    setAddingCustom(false);
  };

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
      <ProviderSourceRail
        sources={sources}
        selectedId={addingCustom ? null : selectedId}
        onSelect={(id) => {
          setAddingCustom(false);
          setSelectedId(id);
        }}
        onAddCustom={() => {
          setAddingCustom(true);
          setSelectedId(null);
        }}
      />

      <Card className="min-w-0 overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {displaySelected ? (
            <>
              <ProviderConnectionForm
                source={displaySelected}
                busy={busy}
                onSaveCustom={handleSaveCustom}
                onRemoveCustom={removeCustomSource}
                onReload={onReload}
              />
              {!addingCustom && (
                <ProviderModelTable
                  source={displaySelected}
                  fetchedModels={fetchedModels}
                  fetchingModels={fetchingModels}
                  onFetch={() => void fetchLiveModels()}
                  onAssigned={onAssigned}
                  mainModel={main.model}
                  mainProvider={main.provider}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-text-secondary py-8 text-center">
              Select a provider or add a custom endpoint.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
