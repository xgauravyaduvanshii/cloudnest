import { FileType } from "@/features/files/filesType";

export interface Collection {
  _id: string;
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
  files?: FileType[];
}

export interface ListCollectionsResponse {
  collections: Collection[];
}
export interface CollectionResponse {
  collection: Collection;
  message?: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string | null;
  color?: string | null;
  fileIds?: string[];
}
