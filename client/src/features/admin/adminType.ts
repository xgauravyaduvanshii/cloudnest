import { ApiKeyType } from "../apikeys/apikeysType";
import { FileType } from "../files/filesType";
import { StorageAccount, StorageAccountStatus, StorageProvider } from "../storageAccounts/storageAccountsType";

export interface AdminDashboardResponse {
  message: string;
  totals: {
    users: number;
    files: number;
    api_keys: number;
    storage_accounts: number;
    total_file_bytes: number;
  };
  providerStats: {
    provider: StorageProvider;
    accounts: number;
    active_accounts: number;
    cached_usage_bytes: number;
    cached_limit_bytes: number | null;
  }[];
}

export interface AdminUser {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  profilePicture: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  pageSize: number;
  pageNumber: number;
  totalCount: number;
  totalPages: number;
  skip: number;
}

export interface AdminUsersResponse {
  message: string;
  users: AdminUser[];
  pagination: Pagination;
}

export interface AdminFilesResponse {
  message: string;
  files: (FileType & { userEmail?: string; userName?: string })[];
  pagination: Pagination;
}

export interface AdminStorageAccountsResponse {
  message: string;
  accounts: StorageAccount[];
  pagination: Pagination;
}

export interface AdminApiKeysResponse {
  message: string;
  apiKeys: (ApiKeyType & { userEmail?: string; userName?: string })[];
  pagination: Pagination;
}

export interface AdminProviderSettingsResponse {
  message: string;
  settings: {
    provider: StorageProvider;
    isConfigured: boolean;
    isEnabled: boolean;
    updatedAt: string;
  }[];
}

export type AdminStorageStatusPayload = {
  id: string;
  status: StorageAccountStatus;
};
