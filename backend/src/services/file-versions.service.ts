import { randomUUID } from 'crypto';
import FileModel from '../models/file.model';
import { withTransaction } from '../config/database.config';
import { NotFoundException, UnauthorizedException } from '../utils/app-error';
import { toPublicFile } from './files.service';
import ActivityModel from '../models/activity.model';

/**
 * Version history for a single file. Versions form when a same-name/different-checksum
 * upload is stored with the VERSION conflict policy (see upload-jobs worker), which
 * links the rows via `version_group_id`. A file without a group is its own v1.
 */
export const getVersionHistoryService = async (userId: string | undefined, fileId: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const file = await FileModel.findById(fileId);
  if (!file) throw new NotFoundException('File not found');
  if (file.userId !== userId) throw new NotFoundException('File not found');

  const groupId = file.versionGroupId || file._id;
  const versions = file.versionGroupId
    ? await FileModel.findVersionsByGroup(userId, file.versionGroupId)
    : [file];

  return {
    versionGroupId: groupId,
    currentFileId: file._id,
    versions: versions.map((v) => ({
      ...toPublicFile(v),
      checksumSha256: v.checksumSha256,
      versionNumber: v.versionNumber,
      isLatest: v.isLatest,
      supersedesFileId: v.supersedesFileId,
    })),
  };
};

/**
 * Restore an older version by copy-forward: create a new file row that points at the
 * same provider object (no re-download), tag it as the newest version in the group, and
 * demote the previous latest. The original version rows are never mutated or deleted.
 */
export const restoreFileVersionService = async (
  userId: string | undefined,
  versionFileId: string,
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const version = await FileModel.findById(versionFileId);
  if (!version) throw new NotFoundException('Version not found');
  if (version.userId !== userId) throw new NotFoundException('Version not found');

  const groupId = version.versionGroupId || version._id;

  const restored = await withTransaction(async (client) => {
    // Ensure the whole group shares a version_group_id (bootstrap single-version case).
    if (!version.versionGroupId) {
      await FileModel.setVersionGroup(version._id, groupId, client);
    }

    const maxVersion = await FileModel.getLatestVersionNumber(userId, groupId);
    await FileModel.clearGroupLatest(userId, groupId, client);

    const created = await FileModel.create({
      userId,
      originalName: version.originalName,
      storageKey: version.storageKey,
      provider: version.provider,
      storageAccountId: version.storageAccountId as string,
      folderId: version.folderId,
      providerFileId: version.providerFileId,
      providerMetadata: version.providerMetadata,
      mimeType: version.mimeType,
      size: version.size,
      ext: version.ext,
      uploadVia: version.uploadVia,
      url: version.url,
      checksumSha256: version.checksumSha256,
      originalPath: version.originalPath,
      providerFolderId: version.providerFolderId,
      versionGroupId: groupId,
      supersedesFileId: version._id,
      versionNumber: maxVersion + 1,
      isLatest: true,
    });
    return created;
  });

  await ActivityModel.record({
    userId,
    action: 'file.version.restore',
    entityType: 'file',
    entityId: restored._id,
    metadata: { versionGroupId: groupId, restoredFrom: version._id },
  }).catch(() => undefined);

  return toPublicFile(restored);
};

/**
 * Ensure a caller owns a file id before exposing a per-version download. Returns the
 * resolved file so callers can stream it through the standard provider read path.
 */
export const getVersionFileService = async (userId: string | undefined, fileId: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const file = await FileModel.findById(fileId);
  if (!file || file.userId !== userId) throw new NotFoundException('File not found');
  return file;
};

export const newVersionGroupId = () => randomUUID();
