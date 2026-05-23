import PageLayout from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/format-utils";
import {
  useDisconnectStorageAccountMutation,
  useGetStorageAccountsQuery,
  useLazyGetGoogleAuthUrlQuery,
  useStartTelegramAuthMutation,
  useSyncStorageAccountMutation,
  useVerifyTelegramCodeMutation,
  useVerifyTelegramPasswordMutation,
} from "@/features/storageAccounts/storageAccountsAPI";
import { Cloud, HardDrive, RefreshCw, Send, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const providerLabel = {
  S3: "AWS S3",
  GOOGLE_DRIVE: "Google Drive",
  TELEGRAM: "Telegram",
};

const StorageAccounts = () => {
  const { data, isFetching } = useGetStorageAccountsQuery();
  const [getGoogleAuthUrl] = useLazyGetGoogleAuthUrlQuery();
  const [startTelegramAuth, { isLoading: isStartingTelegram }] =
    useStartTelegramAuthMutation();
  const [verifyCode, { isLoading: isVerifyingCode }] =
    useVerifyTelegramCodeMutation();
  const [verifyPassword, { isLoading: isVerifyingPassword }] =
    useVerifyTelegramPasswordMutation();
  const [syncAccount] = useSyncStorageAccountMutation();
  const [disconnectAccount] = useDisconnectStorageAccountMutation();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [authId, setAuthId] = useState<string | null>(null);
  const [telegramStep, setTelegramStep] = useState<"PHONE" | "CODE" | "PASSWORD">(
    "PHONE"
  );
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const connectGoogle = async () => {
    try {
      const result = await getGoogleAuthUrl("USER").unwrap();
      window.location.href = result.url;
    } catch {
      toast.error("Google Drive is not configured yet");
    }
  };

  const sendTelegramCode = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Enter a Telegram phone number");
      return;
    }
    try {
      const result = await startTelegramAuth({ phoneNumber }).unwrap();
      setAuthId(result.authId);
      setTelegramStep("CODE");
      toast.success("Telegram code sent");
    } catch {
      toast.error("Failed to start Telegram login");
    }
  };

  const submitTelegramCode = async () => {
    if (!authId) return;
    try {
      const result = await verifyCode({ authId, code }).unwrap();
      if (result.nextStep === "PASSWORD") {
        setTelegramStep("PASSWORD");
      } else {
        setTelegramStep("PHONE");
        setAuthId(null);
        setPhoneNumber("");
        setCode("");
        toast.success("Telegram account connected");
      }
    } catch {
      toast.error("Telegram code verification failed");
    }
  };

  const submitTelegramPassword = async () => {
    if (!authId) return;
    try {
      await verifyPassword({ authId, password }).unwrap();
      setTelegramStep("PHONE");
      setAuthId(null);
      setPhoneNumber("");
      setCode("");
      setPassword("");
      toast.success("Telegram account connected");
    } catch {
      toast.error("Telegram password verification failed");
    }
  };

  return (
    <PageLayout
      title="Storage Accounts"
      subtitle="Connect storage accounts and monitor provider capacity."
    >
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connect Google Drive</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={connectGoogle} className="w-full">
                <Cloud className="size-4" />
                Connect Google Drive
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connect Telegram</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {telegramStep === "PHONE" && (
                <>
                  <Input
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+15551234567"
                  />
                  <Button
                    onClick={sendTelegramCode}
                    disabled={isStartingTelegram}
                    className="w-full"
                  >
                    <Send className="size-4" />
                    Send code
                  </Button>
                </>
              )}
              {telegramStep === "CODE" && (
                <>
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Telegram code"
                  />
                  <Button
                    onClick={submitTelegramCode}
                    disabled={isVerifyingCode}
                    className="w-full"
                  >
                    Verify code
                  </Button>
                </>
              )}
              {telegramStep === "PASSWORD" && (
                <>
                  <Input
                    value={password}
                    type="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Two-step password"
                  />
                  <Button
                    onClick={submitTelegramPassword}
                    disabled={isVerifyingPassword}
                    className="w-full"
                  >
                    Verify password
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          {isFetching && <div className="text-sm text-muted-foreground">Loading accounts...</div>}
          {data?.accounts.map((account) => {
            const remaining =
              account.cachedLimitBytes === null
                ? null
                : Math.max(account.cachedLimitBytes - account.cachedUsageBytes, 0);

            return (
              <Card key={account.id}>
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <HardDrive className="size-4" />
                      <span className="font-medium">{account.displayName}</span>
                      <Badge variant="outline">{providerLabel[account.provider]}</Badge>
                      <Badge
                        variant={
                          account.status === "ACTIVE" ? "secondary" : "outline"
                        }
                      >
                        {account.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {account.externalEmail || account.externalAccountId || "No external identity"}
                    </div>
                    <div className="text-sm">
                      {formatBytes(account.cachedUsageBytes)} used
                      {account.cachedLimitBytes !== null &&
                        ` of ${formatBytes(account.cachedLimitBytes)}`}
                      {remaining !== null && `, ${formatBytes(remaining)} free`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last sync:{" "}
                      {account.lastSyncedAt
                        ? new Date(account.lastSyncedAt).toLocaleString()
                        : "Never"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        syncAccount(account.id)
                          .unwrap()
                          .then(() => toast.success("Usage refreshed"))
                          .catch(() => toast.error("Sync failed"))
                      }
                    >
                      <RefreshCw className="size-4" />
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        disconnectAccount(account.id)
                          .unwrap()
                          .then(() => toast.success("Account disconnected"))
                          .catch(() => toast.error("Disconnect failed"))
                      }
                    >
                      <Unlink className="size-4" />
                      Disconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
};

export default StorageAccounts;
