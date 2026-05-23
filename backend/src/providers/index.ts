import { StorageProviderType } from '../models/storage-account.model';
import { GoogleDriveStorageProvider } from './google-drive.provider';
import { S3StorageProvider } from './s3.provider';
import { StorageProvider } from './storage-provider';
import { TelegramStorageProvider } from './telegram.provider';

const providers: Record<StorageProviderType, StorageProvider> = {
  S3: new S3StorageProvider(),
  GOOGLE_DRIVE: new GoogleDriveStorageProvider(),
  TELEGRAM: new TelegramStorageProvider(),
};

export const getStorageProvider = (provider: StorageProviderType) =>
  providers[provider];
