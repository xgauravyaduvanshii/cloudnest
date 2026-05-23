import { Readable } from 'stream';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { Env } from '../config/env.config';
import { s3 } from '../config/aws-s3.config';
import { InternalServerException } from '../utils/app-error';
import { sanitizeFilename } from '../utils/helper';
import { logger } from '../utils/logger';
import FileModel, { FileDocument } from '../models/file.model';
import StorageAccountModel, {
  StorageAccountDocument,
} from '../models/storage-account.model';
import { ProviderUploadOptions, StorageProvider } from './storage-provider';

export class S3StorageProvider implements StorageProvider {
  async upload(
    account: StorageAccountDocument,
    userId: string,
    file: Express.Multer.File,
    options: ProviderUploadOptions = {},
  ) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const cleanName = sanitizeFilename(basename).substring(0, 64);
    const folderPrefix = (options.folderPath || [])
      .map((part) => sanitizeFilename(part).substring(0, 80))
      .filter(Boolean)
      .join('/');
    const storageKey = `users/${userId}/${folderPrefix ? `${folderPrefix}/` : ''}${uuidv4()}-${cleanName}${ext}`;

    const command = new PutObjectCommand({
      Bucket: Env.AWS_S3_BUCKET!,
      Key: storageKey,
      Body: file.buffer,
    });

    await s3.send(command);

    return {
      storageKey,
      providerFileId: storageKey,
      metadata: {
        bucket: Env.AWS_S3_BUCKET,
        storageKey,
        storageAccountId: account.id,
        folderPath: options.folderPath || [],
      },
    };
  }

  async getReadStream(account: StorageAccountDocument, file: FileDocument) {
    const storageKey =
      (file.providerMetadata.storageKey as string | undefined) || file.storageKey;

    const command = new GetObjectCommand({
      Bucket: Env.AWS_S3_BUCKET!,
      Key: storageKey,
    });
    const response = await s3.send(command);

    if (!response.Body) {
      logger.error(`No S3 body returned for key: ${storageKey}`);
      throw new InternalServerException(`No body returned for key`);
    }

    return {
      stream: response.Body as Readable,
      contentType: file.mimeType,
      fileSize: file.size,
    };
  }

  async delete(account: StorageAccountDocument, file: FileDocument) {
    const storageKey =
      (file.providerMetadata.storageKey as string | undefined) || file.storageKey;
    await s3.send(
      new DeleteObjectCommand({
        Bucket: Env.AWS_S3_BUCKET!,
        Key: storageKey,
      }),
    );
  }

  async syncUsage(account: StorageAccountDocument) {
    const usageBytes = await StorageAccountModel.calculateAppUsage(account.id);
    return {
      usageBytes,
      limitBytes: account.softQuotaBytes,
      details: {
        source: 'app_files',
      },
    };
  }
}
