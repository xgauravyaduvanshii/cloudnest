import { useEffect, useMemo, useState } from "react";
import {
  useFetchAdminAiModelsMutation,
  useGetAdminAiModelsQuery,
  useGetAdminAiSettingsQuery,
  useDeleteAdminAiModelMutation,
  useSetAdminAiModelEnabledMutation,
  useUpdateAdminAiSettingsMutation,
} from "@/features/admin/adminAPI";
import type { AdminAiModel } from "@/features/admin/adminType";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DownloadCloud, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

const NONE = "__none__";

const AiSettingsSection = () => {
  const { data: settingsData } = useGetAdminAiSettingsQuery();
  const { data: modelsData, isLoading: modelsLoading } =
    useGetAdminAiModelsQuery();

  const [updateSettings, { isLoading: saving }] =
    useUpdateAdminAiSettingsMutation();
  const [fetchModels, { isLoading: fetching }] =
    useFetchAdminAiModelsMutation();
  const [setModelEnabled] = useSetAdminAiModelEnabledMutation();
  const [deleteModel] = useDeleteAdminAiModelMutation();

  const settings = settingsData?.settings || null;

  const [provider, setProvider] = useState("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [defaultChatModel, setDefaultChatModel] = useState<string>(NONE);
  const [defaultVisionModel, setDefaultVisionModel] = useState<string>(NONE);
  const [defaultEmbeddingModel, setDefaultEmbeddingModel] = useState<string>(NONE);

  // Seed the form once settings load.
  useEffect(() => {
    if (!settings) return;
    setProvider(settings.provider || "openai");
    setBaseUrl(settings.baseUrl || "");
    setIsEnabled(settings.isEnabled);
    setDefaultChatModel(settings.defaultChatModel || NONE);
    setDefaultVisionModel(settings.defaultVisionModel || NONE);
    setDefaultEmbeddingModel(settings.defaultEmbeddingModel || NONE);
  }, [settings]);

  const models = modelsData?.models || [];
  const byKind = useMemo(
    () => ({
      chat: models.filter((m) => m.kind === "chat"),
      vision: models.filter((m) => m.kind === "vision"),
      embedding: models.filter((m) => m.kind === "embedding"),
    }),
    [models],
  );

  const save = async () => {
    try {
      await updateSettings({
        provider,
        baseUrl: baseUrl.trim() || null,
        // Only send a key when the admin actually typed one; empty means "leave unchanged".
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        isEnabled,
        defaultChatModel: defaultChatModel === NONE ? null : defaultChatModel,
        defaultVisionModel: defaultVisionModel === NONE ? null : defaultVisionModel,
        defaultEmbeddingModel:
          defaultEmbeddingModel === NONE ? null : defaultEmbeddingModel,
      }).unwrap();
      setApiKey("");
      toast.success("AI settings saved");
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        "Failed to save AI settings";
      toast.error(message);
    }
  };

  const refreshModels = async () => {
    try {
      const result = await fetchModels().unwrap();
      toast.success(
        `Fetched ${result.fetched} model(s), added ${result.inserted} new.`,
      );
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        "Failed to fetch models. Check the base URL and key.";
      toast.error(message);
    }
  };

  const toggleModel = (model: AdminAiModel, next: boolean) => {
    setModelEnabled({ id: model.id, isEnabled: next })
      .then(() => undefined)
      .catch(() => toast.error("Failed to update model"));
  };

  const removeModel = (model: AdminAiModel) => {
    if (!window.confirm(`Remove ${model.displayName} from the catalog?`)) return;
    deleteModel(model.id).catch(() => toast.error("Failed to remove model"));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            AI Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-provider">Provider</Label>
              <Input
                id="ai-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="openai"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-base-url">Base URL</Label>
              <Input
                id="ai-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://urmate.tech/api/xrouter/v1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-key">API Key</Label>
            {settings?.hasKey ? (
              <div className="flex items-center gap-2">
                <Input
                  id="ai-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Stored (${settings.maskedKey}) — enter to replace`}
                  className="max-w-md"
                />
              </div>
            ) : (
              <Input
                id="ai-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste the provider API key"
                className="max-w-md"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Keys are stored encrypted on the server and never sent back to the
              browser. Leave blank to keep the current key.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <ModelSelect
              label="Default chat model"
              value={defaultChatModel}
              onChange={setDefaultChatModel}
              options={byKind.chat}
            />
            <ModelSelect
              label="Default vision model"
              value={defaultVisionModel}
              onChange={setDefaultVisionModel}
              options={byKind.vision}
            />
            <ModelSelect
              label="Default embedding model"
              value={defaultEmbeddingModel}
              onChange={setDefaultEmbeddingModel}
              options={byKind.embedding}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Enable AI</div>
              <div className="text-xs text-muted-foreground">
                When off, the AI panel is disabled for all users and env config
                is used as a fallback.
              </div>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              <Save className="size-4" />
              {saving ? "Saving…" : "Save settings"}
            </Button>
            <Button variant="outline" onClick={refreshModels} disabled={fetching}>
              <DownloadCloud className="size-4" />
              {fetching ? "Fetching…" : "Fetch models"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {modelsLoading ? (
            <p className="text-sm text-muted-foreground">Loading models…</p>
          ) : models.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No models yet. Save your provider settings, then click “Fetch
              models”. New models start disabled — enable the ones users may
              pick.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">Model</th>
                    <th className="p-3">Kind</th>
                    <th className="p-3">Enabled</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr key={model.id} className="border-t">
                      <td className="p-3">
                        <div className="font-medium">{model.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {model.modelId}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{model.kind}</Badge>
                      </td>
                      <td className="p-3">
                        <Switch
                          checked={model.isEnabled}
                          onCheckedChange={(next) => toggleModel(model, next)}
                        />
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeModel(model)}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ModelSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AdminAiModel[];
}) => {
  // Keep the stored default visible even if it isn't in the fetched catalog yet.
  const items = useMemo(() => {
    const list = options.map((m) => ({ value: m.modelId, name: m.displayName }));
    if (value !== NONE && value && !list.some((i) => i.value === value)) {
      list.unshift({ value, name: value });
    }
    return list;
  }, [options, value]);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={items.length === 0}>
        <SelectTrigger>
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default AiSettingsSection;
