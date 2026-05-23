import PageLayout from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateAdminApiKeyMutation,
  useDeleteAdminApiKeyMutation,
  useDeleteAdminFilesMutation,
  useDisconnectAdminStorageAccountMutation,
  useDownloadAdminFilesMutation,
  useGetAdminApiKeysQuery,
  useGetAdminDashboardQuery,
  useGetAdminFilesQuery,
  useGetAdminProviderSettingsQuery,
  useGetAdminStorageAccountsQuery,
  useGetAdminUsersQuery,
  useSyncAdminStorageAccountMutation,
  useRemoveAdminStorageAccountMutation,
  useUpdateAdminProviderSettingsMutation,
  useUpdateAdminStorageStatusMutation,
  useUpdateAdminUserMutation,
} from "@/features/admin/adminAPI";
import {
  useLazyGetGoogleAuthUrlQuery,
  useStartTelegramAuthMutation,
  useVerifyTelegramCodeMutation,
  useVerifyTelegramPasswordMutation,
} from "@/features/storageAccounts/storageAccountsAPI";
import { formatBytes } from "@/lib/format-utils";
import {
  Cloud,
  Download,
  Key,
  Power,
  RefreshCw,
  Save,
  Send,
  Shield,
  Trash2,
  Unlink,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const Admin = () => {
  const { data: dashboard } = useGetAdminDashboardQuery();
  const { data: users } = useGetAdminUsersQuery(undefined);
  const { data: files } = useGetAdminFilesQuery(undefined);
  const { data: storageAccounts } = useGetAdminStorageAccountsQuery();
  const { data: apiKeys } = useGetAdminApiKeysQuery();
  const { data: providerSettings } = useGetAdminProviderSettingsQuery();

  const [updateUser] = useUpdateAdminUserMutation();
  const [downloadFiles] = useDownloadAdminFilesMutation();
  const [deleteFiles] = useDeleteAdminFilesMutation();
  const [updateStorageStatus] = useUpdateAdminStorageStatusMutation();
  const [syncStorage] = useSyncAdminStorageAccountMutation();
  const [disconnectStorage] = useDisconnectAdminStorageAccountMutation();
  const [removeStorage] = useRemoveAdminStorageAccountMutation();
  const [createApiKey] = useCreateAdminApiKeyMutation();
  const [deleteApiKey] = useDeleteAdminApiKeyMutation();
  const [updateProviderSettings] = useUpdateAdminProviderSettingsMutation();
  const [getGoogleAuthUrl] = useLazyGetGoogleAuthUrlQuery();
  const [startTelegramAuth, { isLoading: isStartingTelegram }] =
    useStartTelegramAuthMutation();
  const [verifyTelegramCode, { isLoading: isVerifyingTelegramCode }] =
    useVerifyTelegramCodeMutation();
  const [verifyTelegramPassword, { isLoading: isVerifyingTelegramPassword }] =
    useVerifyTelegramPasswordMutation();

  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [apiKeyUserId, setApiKeyUserId] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");
  const [adminTelegramPhone, setAdminTelegramPhone] = useState("");
  const [adminTelegramAuthId, setAdminTelegramAuthId] = useState<string | null>(
    null
  );
  const [adminTelegramStep, setAdminTelegramStep] = useState<
    "PHONE" | "CODE" | "PASSWORD"
  >("PHONE");
  const [adminTelegramCode, setAdminTelegramCode] = useState("");
  const [adminTelegramPassword, setAdminTelegramPassword] = useState("");
  const [providerForms, setProviderForms] = useState({
    GOOGLE_DRIVE: {
      clientId: "",
      clientSecret: "",
      redirectUri: "http://localhost:3000/api/storage-accounts/google/callback",
    },
    TELEGRAM: {
      apiId: "",
      apiHash: "",
    },
    S3: {
      note: "Uses server environment credentials",
    },
  });

  const toggleFile = (id: string) => {
    setSelectedFiles((current) =>
      current.includes(id)
        ? current.filter((fileId) => fileId !== id)
        : [...current, id]
    );
  };

  const openDownload = async () => {
    if (!selectedFiles.length) {
      toast.error("Select files first");
      return;
    }
    try {
      const result = await downloadFiles(selectedFiles).unwrap();
      window.open(result.downloadUrl, "_blank");
      setSelectedFiles([]);
    } catch {
      toast.error("Download failed");
    }
  };

  const removeFiles = async () => {
    if (!selectedFiles.length) {
      toast.error("Select files first");
      return;
    }
    try {
      const result = await deleteFiles(selectedFiles).unwrap();
      toast.success(`Deleted ${result.deletedCount} file(s)`);
      setSelectedFiles([]);
    } catch {
      toast.error("Delete failed");
    }
  };

  const submitApiKey = async () => {
    if (!apiKeyUserId || !apiKeyName) {
      toast.error("User ID and key name are required");
      return;
    }
    try {
      const result = await createApiKey({
        userId: apiKeyUserId,
        name: apiKeyName,
      }).unwrap();
      toast.success(`New key: ${result.key}`);
      setApiKeyUserId("");
      setApiKeyName("");
    } catch {
      toast.error("Failed to create API key");
    }
  };

  const saveProvider = async (provider: "GOOGLE_DRIVE" | "TELEGRAM" | "S3") => {
    try {
      await updateProviderSettings({
        provider,
        config: providerForms[provider],
      }).unwrap();
      toast.success("Provider settings saved");
    } catch {
      toast.error("Failed to save provider settings");
    }
  };

  const toggleProvider = async (
    provider: "GOOGLE_DRIVE" | "TELEGRAM" | "S3",
    isEnabled: boolean
  ) => {
    try {
      await updateProviderSettings({
        provider,
        isEnabled,
      }).unwrap();
      toast.success(`${provider} ${isEnabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update provider");
    }
  };

  const connectAdminGoogle = async () => {
    try {
      const result = await getGoogleAuthUrl("ADMIN").unwrap();
      window.location.href = result.url;
    } catch {
      toast.error("Google Drive is not configured yet");
    }
  };

  const startAdminTelegram = async () => {
    if (!adminTelegramPhone.trim()) {
      toast.error("Enter a Telegram phone number");
      return;
    }
    try {
      const result = await startTelegramAuth({
        phoneNumber: adminTelegramPhone,
        ownerType: "ADMIN",
      }).unwrap();
      setAdminTelegramAuthId(result.authId);
      setAdminTelegramStep("CODE");
      toast.success("Telegram code sent");
    } catch {
      toast.error("Failed to start Telegram login");
    }
  };

  const submitAdminTelegramCode = async () => {
    if (!adminTelegramAuthId) return;
    try {
      const result = await verifyTelegramCode({
        authId: adminTelegramAuthId,
        code: adminTelegramCode,
      }).unwrap();
      if (result.nextStep === "PASSWORD") {
        setAdminTelegramStep("PASSWORD");
        return;
      }
      resetAdminTelegram();
      toast.success("Shared Telegram storage connected");
    } catch {
      toast.error("Telegram code verification failed");
    }
  };

  const submitAdminTelegramPassword = async () => {
    if (!adminTelegramAuthId) return;
    try {
      await verifyTelegramPassword({
        authId: adminTelegramAuthId,
        password: adminTelegramPassword,
      }).unwrap();
      resetAdminTelegram();
      toast.success("Shared Telegram storage connected");
    } catch {
      toast.error("Telegram password verification failed");
    }
  };

  const resetAdminTelegram = () => {
    setAdminTelegramStep("PHONE");
    setAdminTelegramAuthId(null);
    setAdminTelegramPhone("");
    setAdminTelegramCode("");
    setAdminTelegramPassword("");
  };

  const disconnectAdminStorage = async (id: string) => {
    try {
      const result = await disconnectStorage(id).unwrap();
      toast.success(
        result.deleted
          ? "Storage account removed"
          : "Storage account disconnected"
      );
    } catch {
      toast.error("Failed to disconnect storage account");
    }
  };

  const removeAdminStorage = async (id: string) => {
    const confirmed = window.confirm(
      "Remove this storage account from the admin list? Files linked to it may no longer be downloadable."
    );
    if (!confirmed) return;

    try {
      await removeStorage(id).unwrap();
      toast.success("Storage account removed");
    } catch {
      toast.error("Failed to remove storage account");
    }
  };

  return (
    <PageLayout title="Admin" subtitle="Manage users, files, storage, and provider settings.">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric title="Users" value={dashboard?.totals.users || 0} />
            <Metric title="Files" value={dashboard?.totals.files || 0} />
            <Metric title="API Keys" value={dashboard?.totals.api_keys || 0} />
            <Metric
              title="Stored"
              value={formatBytes(dashboard?.totals.total_file_bytes || 0)}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {dashboard?.providerStats.map((stat) => (
              <Card key={stat.provider}>
                <CardHeader>
                  <CardTitle className="text-base">{stat.provider}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div>{stat.active_accounts} active accounts</div>
                  <div>{formatBytes(stat.cached_usage_bytes)} cached usage</div>
                  <div>
                    {stat.cached_limit_bytes
                      ? `${formatBytes(stat.cached_limit_bytes)} cached limit`
                      : "No cached limit"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.users.map((user) => (
                  <tr key={user.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-muted-foreground">{user.email}</div>
                      <div className="text-xs text-muted-foreground">{user.id}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{user.role}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={user.status === "ACTIVE" ? "secondary" : "outline"}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="p-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateUser({
                              id: user.id,
                              role: user.role === "ADMIN" ? "USER" : "ADMIN",
                            })
                          }
                        >
                          <Shield className="size-4" />
                          {user.role === "ADMIN" ? "Make user" : "Make admin"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateUser({
                              id: user.id,
                              status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                            })
                          }
                        >
                          {user.status === "ACTIVE" ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="files">
          <div className="mb-3 flex gap-2">
            <Button variant="outline" onClick={openDownload}>
              <Download className="size-4" />
              Download
            </Button>
            <Button variant="outline" onClick={removeFiles}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3"></th>
                  <th className="p-3">File</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {files?.files.map((file) => (
                  <tr key={file._id} className="border-t">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file._id)}
                        onChange={() => toggleFile(file._id)}
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{file.originalName}</div>
                      <div className="text-xs text-muted-foreground">{file._id}</div>
                    </td>
                    <td className="p-3">{file.userEmail || file.userId}</td>
                    <td className="p-3">
                      <Badge variant="outline">{file.provider || "S3"}</Badge>
                      <div className="text-xs text-muted-foreground">
                        {file.storageAccountName}
                      </div>
                    </td>
                    <td className="p-3">{file.formattedSize}</td>
                    <td className="p-3">{new Date(file.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="storage">
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shared Google Drive</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={connectAdminGoogle}>
                  <Cloud className="size-4" />
                  Connect
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shared Telegram</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {adminTelegramStep === "PHONE" && (
                    <>
                      <Input
                        className="max-w-xs"
                        placeholder="+15551234567"
                        value={adminTelegramPhone}
                        onChange={(event) =>
                          setAdminTelegramPhone(event.target.value)
                        }
                      />
                      <Button
                        variant="outline"
                        onClick={startAdminTelegram}
                        disabled={isStartingTelegram}
                      >
                        <Send className="size-4" />
                        Send code
                      </Button>
                    </>
                  )}
                  {adminTelegramStep === "CODE" && (
                    <>
                      <Input
                        className="max-w-xs"
                        placeholder="Code"
                        value={adminTelegramCode}
                        onChange={(event) =>
                          setAdminTelegramCode(event.target.value)
                        }
                      />
                      <Button
                        variant="outline"
                        onClick={submitAdminTelegramCode}
                        disabled={isVerifyingTelegramCode}
                      >
                        Verify
                      </Button>
                    </>
                  )}
                  {adminTelegramStep === "PASSWORD" && (
                    <>
                      <Input
                        className="max-w-xs"
                        type="password"
                        placeholder="2FA password"
                        value={adminTelegramPassword}
                        onChange={(event) =>
                          setAdminTelegramPassword(event.target.value)
                        }
                      />
                      <Button
                        variant="outline"
                        onClick={submitAdminTelegramPassword}
                        disabled={isVerifyingTelegramPassword}
                      >
                        Connect
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Account</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Usage</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {storageAccounts?.accounts.map((account) => (
                  <tr key={account.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{account.displayName}</div>
                      <div className="text-muted-foreground">
                        {account.externalEmail || account.externalAccountId || account.id}
                      </div>
                    </td>
                    <td className="p-3">{account.provider}</td>
                    <td className="p-3">
                      <Badge variant={account.status === "ACTIVE" ? "secondary" : "outline"}>
                        {account.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {formatBytes(account.cachedUsageBytes)}
                      {account.cachedLimitBytes !== null &&
                        ` / ${formatBytes(account.cachedLimitBytes)}`}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncStorage(account.id)}
                        >
                          <RefreshCw className="size-4" />
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStorageStatus({
                              id: account.id,
                              status:
                                account.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                            })
                          }
                        >
                          {account.status === "ACTIVE" ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => disconnectAdminStorage(account.id)}
                        >
                          <Unlink className="size-4" />
                          Disconnect
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeAdminStorage(account.id)}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="keys">
          <Card className="mb-4">
            <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
              <Input
                value={apiKeyUserId}
                onChange={(event) => setApiKeyUserId(event.target.value)}
                placeholder="User ID"
              />
              <Input
                value={apiKeyName}
                onChange={(event) => setApiKeyName(event.target.value)}
                placeholder="API key name"
              />
              <Button onClick={submitApiKey}>
                <Key className="size-4" />
                Create
              </Button>
            </CardContent>
          </Card>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Display Key</th>
                  <th className="p-3">Last Used</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys?.apiKeys.map((apiKey) => (
                  <tr key={apiKey._id} className="border-t">
                    <td className="p-3">{apiKey.name}</td>
                    <td className="p-3">{apiKey.userEmail || apiKey.userId}</td>
                    <td className="p-3">{apiKey.displayKey}</td>
                    <td className="p-3">
                      {apiKey.lastUsedAt
                        ? new Date(apiKey.lastUsedAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteApiKey(apiKey._id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="providers">
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {providerSettings?.settings.map((setting) => (
              <Card key={setting.provider}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{setting.provider}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant={setting.isEnabled ? "secondary" : "outline"}>
                        {setting.isEnabled ? "Enabled" : "Off"}
                      </Badge>
                      <Badge variant="outline">
                        {setting.isConfigured ? "Configured" : "Missing config"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toggleProvider(setting.provider, !setting.isEnabled)
                    }
                  >
                    <Power className="size-4" />
                    {setting.isEnabled ? "Turn off" : "Turn on"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ProviderSettingsCard
              title="Google Drive"
              fields={providerForms.GOOGLE_DRIVE}
              onChange={(key, value) =>
                setProviderForms((current) => ({
                  ...current,
                  GOOGLE_DRIVE: { ...current.GOOGLE_DRIVE, [key]: value },
                }))
              }
              onSave={() => saveProvider("GOOGLE_DRIVE")}
            />
            <ProviderSettingsCard
              title="Telegram"
              fields={providerForms.TELEGRAM}
              onChange={(key, value) =>
                setProviderForms((current) => ({
                  ...current,
                  TELEGRAM: { ...current.TELEGRAM, [key]: value },
                }))
              }
              onSave={() => saveProvider("TELEGRAM")}
            />
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

const Metric = ({ title, value }: { title: string; value: string | number }) => (
  <Card>
    <CardContent className="p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </CardContent>
  </Card>
);

const ProviderSettingsCard = ({
  title,
  fields,
  onChange,
  onSave,
}: {
  title: string;
  fields: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {Object.entries(fields).map(([key, value]) => (
        <Input
          key={key}
          value={value}
          type={key.toLowerCase().includes("secret") ? "password" : "text"}
          onChange={(event) => onChange(key, event.target.value)}
          placeholder={key}
        />
      ))}
      <Button onClick={onSave}>
        <Save className="size-4" />
        Save
      </Button>
    </CardContent>
  </Card>
);

export default Admin;
