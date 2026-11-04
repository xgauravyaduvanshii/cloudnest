export interface Params {
  pageNumber?: number;
  pageSize?: number;
}

export const API_KEY_SCOPES = [
  "files:read",
  "files:write",
  "upload:write",
  "share:write",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface CreateApiKeyInput {
  name: string;
  scopes?: ApiKeyScope[];
  expiresInDays?: number | null;
}

export interface CreateApiKeyResponse {
  message: string;
  key: string;
}

export interface ApiKeyType {
  _id: string;
  userId: string;
  name: string;
  displayKey: string;
  scopes: string[];
  expiresAt: string | null;
  isRevoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetAllApiKeysResponse {
  message: string;
  apiKeys: ApiKeyType[];
  pagination: {
    pageSize: number;
    pageNumber: number;
    totalCount: number;
    totalPages: number;
    skip: number;
  };
}
