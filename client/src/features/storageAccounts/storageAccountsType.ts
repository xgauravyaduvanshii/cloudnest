export type StorageProvider = "S3" | "GOOGLE_DRIVE" | "TELEGRAM";
export type StorageAccountStatus = "ACTIVE" | "DISABLED" | "ERROR" | "PENDING_AUTH";
export type StorageOwnerType = "USER" | "ADMIN";

export interface StorageAccount {
  _id: string;
  id: string;
  userId: string | null;
  ownerType: StorageOwnerType;
  provider: StorageProvider;
  displayName: string;
  status: StorageAccountStatus;
  externalAccountId: string | null;
  externalEmail: string | null;
  softQuotaBytes: number | null;
  cachedUsageBytes: number;
  cachedLimitBytes: number | null;
  cachedUsageDetails: Record<string, unknown>;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorageAccountsResponse {
  message: string;
  accounts: StorageAccount[];
}

export interface EnabledProvidersResponse {
  message: string;
  providers: {
    provider: StorageProvider;
    isEnabled: boolean;
    isConfigured: boolean;
  }[];
}

export interface GoogleAuthUrlResponse {
  message: string;
  url: string;
}

export interface TelegramStartResponse {
  message: string;
  authId: string;
  isCodeViaApp: boolean;
  nextStep: "CODE";
}

export interface TelegramVerifyResponse {
  message: string;
  nextStep: "PASSWORD" | "DONE";
  account?: StorageAccount;
}
