import { Readable } from 'stream';
import { Api, TelegramClient } from 'telegram';
import { CustomFile } from 'telegram/client/uploads';
import { StringSession } from 'telegram/sessions';
import { Env } from '../config/env.config';
import { FileDocument } from '../models/file.model';
import ProviderSettingsModel from '../models/provider-settings.model';
import StorageAccountModel, {
  StorageAccountDocument,
} from '../models/storage-account.model';
import { decryptJson } from '../utils/crypto';
import { BadRequestException } from '../utils/app-error';
import {
  ProviderUploadFile,
  ProviderUploadInput,
  ProviderUploadOptions,
  StorageProvider,
} from './storage-provider';

interface TelegramAccountCredentials {
  session: string;
}

interface TelegramProviderConfig {
  apiId?: number | string;
  apiHash?: string;
}

export const getTelegramCredentials = async () => {
  const setting = await ProviderSettingsModel.findByProvider('TELEGRAM');
  const config = setting?.encryptedConfig
    ? decryptJson<TelegramProviderConfig>(setting.encryptedConfig)
    : {};

  const apiId = Number(config.apiId || Env.TELEGRAM_API_ID);
  const apiHash = config.apiHash || Env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    throw new BadRequestException('Telegram provider is not configured');
  }

  return {
    apiId,
    apiHash,
  };
};

export const createTelegramClient = async (session: string) => {
  const { apiId, apiHash } = await getTelegramCredentials();
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5,
  });
};

export class TelegramStorageProvider implements StorageProvider {
  private async getClient(account: StorageAccountDocument) {
    if (!account.encryptedCredentials) {
      throw new BadRequestException('Telegram account is missing credentials');
    }

    const credentials = decryptJson<TelegramAccountCredentials>(
      account.encryptedCredentials,
    );
    const client = await createTelegramClient(credentials.session);
    await client.connect();
    return client;
  }

  async upload(
    account: StorageAccountDocument,
    userId: string,
    file: ProviderUploadInput,
    options: ProviderUploadOptions = {},
  ) {
    const client = await this.getClient(account);
    // Prefer a disk temp path (streams large files without full buffering);
    // fall back to the in-memory buffer for legacy memoryStorage uploads.
    const source = file as ProviderUploadFile;
    const toUpload =
      typeof source.path === 'string' && source.path.length > 0
        ? new CustomFile(file.originalname, file.size, source.path)
        : new CustomFile(file.originalname, file.size, '', source.buffer);

    try {
      const message = await client.sendFile('me', {
        file: toUpload,
        forceDocument: true,
        workers: 4,
      });
      const peer = message.peerId as Api.PeerUser;
      const chatId = peer.userId?.valueOf().toString() || 'me';
      const messageId = message.id.toString();

      return {
        storageKey: `telegram/${account.id}/${messageId}`,
        providerFileId: messageId,
        metadata: {
          chatId,
          messageId,
          documentId: message.document?.id?.valueOf().toString(),
          folderPath: options.folderPath || [],
        },
      };
    } finally {
      await client.disconnect();
    }
  }

  async getReadStream(account: StorageAccountDocument, file: FileDocument) {
    const client = await this.getClient(account);
    const messageId = Number(file.providerMetadata.messageId || file.providerFileId);
    if (!messageId) throw new BadRequestException('Telegram message ID missing');

    try {
      const messages = await client.getMessages('me', {
        ids: messageId,
      });
      const message = messages[0];
      if (!message) throw new BadRequestException('Telegram message not found');

      const buffer = await client.downloadMedia(message);
      if (!buffer || typeof buffer === 'string') {
        throw new BadRequestException('Telegram file download failed');
      }

      return {
        stream: Readable.from(buffer),
        contentType: file.mimeType,
        fileSize: file.size,
      };
    } finally {
      await client.disconnect();
    }
  }

  async delete(account: StorageAccountDocument, file: FileDocument) {
    const client = await this.getClient(account);
    const messageId = Number(file.providerMetadata.messageId || file.providerFileId);
    if (!messageId) throw new BadRequestException('Telegram message ID missing');

    try {
      await client.deleteMessages('me', [messageId], {
        revoke: true,
      });
    } finally {
      await client.disconnect();
    }
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
