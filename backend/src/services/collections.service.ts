import CollectionModel, { CollectionDocument } from '../models/collection.model';
import FileModel from '../models/file.model';
import { toPublicFile } from './files.service';
import ActivityModel from '../models/activity.model';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '../utils/app-error';
import { withTransaction } from '../config/database.config';

const assertUser = (userId: string | undefined) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  return userId;
};

const toCollectionWithFiles = async (collection: CollectionDocument) => {
  const fileIds = await CollectionModel.findItemIds(collection._id);
  const files = await FileModel.findByIdsForUser(fileIds, collection.userId);
  // Preserve insertion order of the collection.
  const byId = new Map(files.map((f) => [f._id, f]));
  const ordered = fileIds.map((id) => byId.get(id)).filter(Boolean);
  return { ...collection, files: ordered.map((f) => toPublicFile(f!)) };
};

export const listCollectionsService = async (userId: string | undefined) => {
  return CollectionModel.findAllForUser(assertUser(userId));
};

export const getCollectionService = async (
  userId: string | undefined,
  collectionId: string,
) => {
  const uid = assertUser(userId);
  const collection = await CollectionModel.findByIdForUser(collectionId, uid);
  if (!collection) throw new NotFoundException('Collection not found');
  return toCollectionWithFiles(collection);
};

export const createCollectionService = async (
  userId: string | undefined,
  data: { name: string; description?: string | null; color?: string | null; fileIds?: string[] },
) => {
  const uid = assertUser(userId);
  const existing = await CollectionModel.findByNameForUser(uid, data.name);
  if (existing) throw new ConflictException('A collection with that name already exists');

  const collection = await CollectionModel.create({
    userId: uid,
    name: data.name,
    description: data.description ?? null,
    color: data.color ?? null,
  });

  if (data.fileIds?.length) {
    const owned = await FileModel.findByIdsForUser(data.fileIds, uid);
    await CollectionModel.addItems(
      collection._id,
      owned.map((f) => f._id),
    );
  }

  await ActivityModel.record({
    userId: uid,
    action: 'collection.create',
    entityType: 'collection',
    entityId: collection._id,
    metadata: { name: collection.name },
  }).catch(() => undefined);

  return toCollectionWithFiles(collection);
};

export const updateCollectionService = async (
  userId: string | undefined,
  collectionId: string,
  data: { name?: string; description?: string | null; color?: string | null },
) => {
  const uid = assertUser(userId);
  const found = await CollectionModel.findByIdForUser(collectionId, uid);
  if (!found) throw new NotFoundException('Collection not found');

  if (data.name && data.name.trim().toLowerCase() !== found.name.toLowerCase()) {
    const dupe = await CollectionModel.findByNameForUser(uid, data.name);
    if (dupe && dupe._id !== collectionId)
      throw new ConflictException('A collection with that name already exists');
  }

  const updated = await CollectionModel.update(collectionId, uid, data);
  if (!updated) throw new NotFoundException('Collection not found');
  return updated;
};

export const deleteCollectionService = async (
  userId: string | undefined,
  collectionId: string,
) => {
  const uid = assertUser(userId);
  const found = await CollectionModel.findByIdForUser(collectionId, uid);
  if (!found) throw new NotFoundException('Collection not found');
  await CollectionModel.deleteByIdForUser(collectionId, uid);
  await ActivityModel.record({
    userId: uid,
    action: 'collection.delete',
    entityType: 'collection',
    entityId: collectionId,
    metadata: { name: found.name },
  }).catch(() => undefined);
  return { deleted: true };
};

export const addFilesToCollectionService = async (
  userId: string | undefined,
  collectionId: string,
  fileIds: string[],
) => {
  const uid = assertUser(userId);
  const found = await CollectionModel.findByIdForUser(collectionId, uid);
  if (!found) throw new NotFoundException('Collection not found');
  const owned = await FileModel.findByIdsForUser(fileIds, uid);
  if (!owned.length) throw new BadRequestException('No valid files provided');
  await CollectionModel.addItems(
    collectionId,
    owned.map((f) => f._id),
  );
  return toCollectionWithFiles(found);
};

export const removeFilesFromCollectionService = async (
  userId: string | undefined,
  collectionId: string,
  fileIds: string[],
) => {
  const uid = assertUser(userId);
  const found = await CollectionModel.findByIdForUser(collectionId, uid);
  if (!found) throw new NotFoundException('Collection not found');
  await CollectionModel.removeItems(collectionId, fileIds);
  return toCollectionWithFiles(found);
};

/** Collections that contain a given file. */
export const listCollectionsForFileService = async (
  userId: string | undefined,
  fileId: string,
) => {
  const uid = assertUser(userId);
  const file = await FileModel.findById(fileId);
  if (!file || file.userId !== uid) throw new NotFoundException('File not found');
  return CollectionModel.listCollectionsForFile(fileId, uid);
};

/**
 * Called when files are deleted: drop membership and any shares pointing at the
 * files, inside the caller's transaction when provided.
 */
export const cleanupCollectionsForDeletedFiles = async (
  fileIds: string[],
  client?: import('pg').PoolClient,
) => {
  if (!fileIds.length) return;
  await withTransaction(async (tx) => {
    const c = client ?? tx;
    await CollectionModel.deleteItemsForFileIds(fileIds, c);
  });
};
