import { FileType } from "@/features/files/filesType";

export interface FileVersion extends FileType {
  checksumSha256: string | null;
  versionNumber: number;
  isLatest: boolean;
  supersedesFileId: string | null;
}

export interface VersionHistoryResponse {
  versionGroupId: string;
  currentFileId: string;
  versions: FileVersion[];
}

export interface RestoreVersionResponse {
  message: string;
  file: FileType;
}
