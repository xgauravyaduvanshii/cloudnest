import { FileType } from "@/features/files/filesType";

export type ShareResourceType = "file" | "folder" | "collection";
export type ShareVisibility = "PUBLIC" | "PRIVATE";
export type SharePermission = "view" | "download" | "upload" | "edit";

export interface Share {
  _id: string;
  id: string;
  resourceType: ShareResourceType;
  resourceId: string;
  token: string;
  visibility: ShareVisibility;
  permission: SharePermission;
  hasPassword: boolean;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  viewCount: number;
  isActive: boolean;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShareAuditEntry {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ListSharesResponse {
  shares: Share[];
}
export interface ShareResponse {
  share: Share;
  message?: string;
}
export interface ResolveShareResponse {
  share: Share;
  resourceType: ShareResourceType;
  files: FileType[];
}

export interface CreateShareInput {
  resourceType: ShareResourceType;
  resourceId: string;
  visibility?: ShareVisibility;
  permission?: SharePermission;
  password?: string | null;
  expiresAt?: string | null;
  maxDownloads?: number | null;
}
