/**
 * Preservation Property Tests for Google Drive Token Refresh Fix
 * 
 * **CRITICAL**: These tests MUST PASS on UNFIXED code
 * 
 * These tests capture baseline behavior that must be preserved after implementing
 * the token refresh fix. They test scenarios where tokens are valid and operations
 * should work exactly as before.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */

import { GoogleDriveStorageProvider } from '../google-drive.provider';
import { StorageAccountDocument } from '../../models/storage-account.model';
import StorageAccountModel from '../../models/storage-account.model';
import { google } from 'googleapis';
import { decryptJson } from '../../utils/crypto';
import * as fc from 'fast-check';

// Mock environment config before importing anything that depends on it
jest.mock('../../config/env.config', () => ({
  Env: {
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
    AWS_ACCESS_KEY: 'test-access-key',
    AWS_SECRET_KEY: 'test-secret-key',
    AWS_S3_BUCKET: 'test-bucket',
    AWS_REGION: 'us-east-1',
    DATABASE_URL: 'postgresql://test',
    JWT_SECRET: 'test-secret',
    PORT: 3000,
  },
}));

// Mock dependencies
jest.mock('googleapis');
jest.mock('../../utils/crypto');
jest.mock('../../models/storage-account.model');
jest.mock('../../models/provider-settings.model');

describe('Google Drive Preservation Property Tests', () => {
  let provider: GoogleDriveStorageProvider;
  let mockOAuth2Client: any;
  let mockDrive: any;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GoogleDriveStorageProvider();

    // Setup mock OAuth2 client
    mockOAuth2Client = {
      setCredentials: jest.fn(),
      getAccessToken: jest.fn(),
      credentials: {
        access_token: 'valid-access-token',
        expiry_date: Date.now() + 3600000, // Valid for 1 hour
      },
    };

    // Setup mock Drive client
    mockDrive = {
      files: {
        list: jest.fn(),
        get: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      about: {
        get: jest.fn(),
      },
    };

    (google.auth.OAuth2 as any) = jest.fn(() => mockOAuth2Client);
    (google.drive as any) = jest.fn(() => mockDrive);
  });

  /**
   * Property 1: Valid Token Operations Should Succeed Without Additional Refresh
   * 
   * **Validates: Requirement 3.1**
   * 
   * For all Google Drive operations with valid (non-expired) accessToken,
   * operations should succeed without any additional token refresh overhead.
   */
  describe('Property 1: Valid token operations succeed without refresh', () => {
    it('should successfully upload with valid accessToken without refresh', async () => {
      // Arrange: Account with valid token
      const mockAccount = {
        _id: 'account-valid-upload',
        id: 'account-valid-upload',
        userId: 'user-valid',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
        providerFolderId: 'root',
      } as unknown as StorageAccountDocument;

      // Mock valid credentials with non-expired accessToken
      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock successful upload
      const mockFile = {
        fieldname: 'file',
        originalname: 'test-upload.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 17,
        buffer: Buffer.from('test file content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      } as Express.Multer.File;

      mockDrive.files.create.mockResolvedValue({
        data: {
          id: 'file-upload-123',
          name: 'test-upload.txt',
          mimeType: 'text/plain',
          size: '17',
          createdTime: new Date().toISOString(),
          modifiedTime: new Date().toISOString(),
        },
      });

      // Act: Upload file
      const result = await provider.upload(
        mockAccount,
        'user-valid',
        mockFile,
        { providerFolderId: 'root' }
      );

      // Assert: Upload succeeds
      expect(result.providerFileId).toBe('file-upload-123');
      expect(result.metadata.name).toBe('test-upload.txt');
      expect(mockDrive.files.create).toHaveBeenCalledTimes(1);
      
      // Key preservation: No token refresh should occur for valid tokens
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });

    it('should successfully download with valid accessToken', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-valid-download',
        id: 'account-valid-download',
        userId: 'user-valid',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock file stream response
      const mockStream = Buffer.from('file content for download');
      mockDrive.files.get.mockResolvedValue({
        data: mockStream,
      });

      // Act: Download file
      const result = await provider.getItemReadStream(mockAccount, 'file-download-456');

      // Assert: Download succeeds
      expect(result).toBeDefined();
      expect(result.stream).toBeDefined();
      expect(mockDrive.files.get).toHaveBeenCalled();
      
      // Key preservation: No token refresh
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });

    it('should successfully list items with valid accessToken', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-valid-list',
        id: 'account-valid-list',
        userId: 'user-valid',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
        providerFolderId: 'root',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock list response
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'file-1',
              name: 'document.txt',
              mimeType: 'text/plain',
              size: '1024',
              createdTime: '2024-01-01T00:00:00Z',
              modifiedTime: '2024-01-02T00:00:00Z',
            },
            {
              id: 'file-2',
              name: 'spreadsheet.xlsx',
              mimeType: 'application/vnd.ms-excel',
              size: '2048',
              createdTime: '2024-01-03T00:00:00Z',
              modifiedTime: '2024-01-04T00:00:00Z',
            },
          ],
        },
      });

      // Act: List items
      const result = await provider.listItems(mockAccount);

      // Assert: List succeeds
      expect(result.files).toHaveLength(2);
      expect(result.files[0].name).toBe('document.txt');
      expect(result.files[1].name).toBe('spreadsheet.xlsx');
      
      // Key preservation: No token refresh
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });

    it('should successfully sync usage with valid accessToken', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-valid-sync',
        id: 'account-valid-sync',
        userId: 'user-valid',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock usage sync response
      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '5000000',
            limit: '15000000000',
          },
        },
      });

      // Act: Sync usage
      const result = await provider.syncUsage(mockAccount);

      // Assert: Sync succeeds
      expect(result.usageBytes).toBe(5000000);
      expect(result.limitBytes).toBe(15000000000);
      
      // Key preservation: No token refresh
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });

    it('should successfully delete item with valid accessToken', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-valid-delete',
        id: 'account-valid-delete',
        userId: 'user-valid',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock delete response
      mockDrive.files.delete.mockResolvedValue({});

      // Act: Delete item
      await provider.deleteItem(mockAccount, 'file-to-delete-789');

      // Assert: Delete succeeds
      expect(mockDrive.files.delete).toHaveBeenCalledWith({
        fileId: 'file-to-delete-789',
        supportsAllDrives: true,
      });
      
      // Key preservation: No token refresh
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });

    it('should successfully create folder with valid accessToken', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-valid-folder',
        id: 'account-valid-folder',
        userId: 'user-valid',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
        providerFolderId: 'root',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock folder creation (first check if exists, then create)
      mockDrive.files.list.mockResolvedValue({
        data: { files: [] }, // Folder doesn't exist
      });

      mockDrive.files.create.mockResolvedValue({
        data: {
          id: 'folder-new-123',
          name: 'New Folder',
          mimeType: 'application/vnd.google-apps.folder',
        },
      });

      // Act: Create folder
      const result = await provider.createFolderItem(mockAccount, 'New Folder', 'root');

      // Assert: Folder created successfully
      expect(result.id).toBe('folder-new-123');
      expect(result.isFolder).toBe(true);
      
      // Key preservation: No token refresh
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });

    it('should successfully move item with valid accessToken', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-valid-move',
        id: 'account-valid-move',
        userId: 'user-valid',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock get file to retrieve current parents
      mockDrive.files.get.mockResolvedValue({
        data: {
          id: 'file-to-move',
          parents: ['old-parent-id'],
        },
      });

      // Mock update to move file
      mockDrive.files.update.mockResolvedValue({
        data: {
          id: 'file-to-move',
          name: 'moved-file.txt',
          mimeType: 'text/plain',
        },
      });

      // Act: Move item
      const result = await provider.moveItem(
        mockAccount,
        'file-to-move',
        'new-parent-id'
      );

      // Assert: Move succeeds
      expect(result.id).toBe('file-to-move');
      expect(mockDrive.files.update).toHaveBeenCalled();
      
      // Key preservation: No token refresh
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });
  });

  /**
   * Property 2: Non-Authentication Errors Mark Account as ERROR
   * 
   * **Validates: Requirement 3.3**
   * 
   * For all non-authentication errors (not 401/403), the sync service
   * should mark the account as 'ERROR' status (existing behavior).
   */
  describe('Property 2: Non-auth errors mark account as ERROR', () => {
    it('should handle network errors by marking account as ERROR', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-network-error',
        id: 'account-network-error',
        userId: 'user-error',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock network error (500 Internal Server Error)
      const networkError = new Error('Network error');
      (networkError as any).code = 500;
      mockDrive.about.get.mockRejectedValue(networkError);

      // Act & Assert: Should throw error (current behavior)
      await expect(provider.syncUsage(mockAccount)).rejects.toThrow('Network error');
      
      // Key preservation: Non-auth errors should bubble up
      // (The service layer will mark as ERROR, not the provider)
    });

    it('should handle quota exceeded error appropriately', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-quota-error',
        id: 'account-quota-error',
        userId: 'user-quota',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock quota exceeded error (403 but not auth-related)
      const quotaError = new Error('User rate limit exceeded');
      (quotaError as any).code = 403;
      (quotaError as any).errors = [{ reason: 'rateLimitExceeded' }];
      mockDrive.about.get.mockRejectedValue(quotaError);

      // Act & Assert: Should throw error (current behavior)
      await expect(provider.syncUsage(mockAccount)).rejects.toThrow();
      
      // Key preservation: Non-auth 403 errors should bubble up
    });

    it('should handle file not found error (404)', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-notfound-error',
        id: 'account-notfound-error',
        userId: 'user-notfound',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid-token',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock file not found error
      const notFoundError = new Error('File not found');
      (notFoundError as any).code = 404;
      mockDrive.files.get.mockRejectedValue(notFoundError);

      // Act & Assert: Should throw error (current behavior)
      await expect(
        provider.getItemReadStream(mockAccount, 'non-existent-file')
      ).rejects.toThrow();
      
      // Key preservation: 404 errors should bubble up
    });
  });

  /**
   * Property 3: Old Credential Format Remains Accessible
   * 
   * **Validates: Requirement 3.4**
   * 
   * For all accounts with old credential format (only refreshToken),
   * credentials should remain accessible and operations should work
   * (current behavior before implementing accessToken storage).
   */
  describe('Property 3: Old credential format compatibility', () => {
    it('should work with old credential format (only refreshToken)', async () => {
      // Arrange: Account with old format (only refreshToken)
      const mockAccount = {
        _id: 'account-old-format',
        id: 'account-old-format',
        userId: 'user-old',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-old-format',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      // Mock old credential format (only refreshToken, no accessToken or expiryDate)
      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'old-format-refresh-token',
        // No accessToken or expiryDate fields
      });

      // Mock successful operation
      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '1000000',
            limit: '10000000000',
          },
        },
      });

      // Act: Sync usage should work with old format
      const result = await provider.syncUsage(mockAccount);

      // Assert: Operation succeeds with old format
      expect(result.usageBytes).toBe(1000000);
      expect(result.limitBytes).toBe(10000000000);
      
      // Key preservation: Old format should continue to work
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'old-format-refresh-token',
      });
    });

    it('should handle multiple operations with old credential format', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-old-multi',
        id: 'account-old-multi',
        userId: 'user-old-multi',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-old-format',
        status: 'ACTIVE',
        providerFolderId: 'root',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'old-format-token',
      });

      // Mock responses
      mockDrive.files.list.mockResolvedValue({
        data: { files: [] },
      });

      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '500000',
            limit: '5000000000',
          },
        },
      });

      // Act: Perform multiple operations
      const listResult = await provider.listItems(mockAccount);
      const syncResult = await provider.syncUsage(mockAccount);

      // Assert: Both operations succeed with old format
      expect(listResult.files).toEqual([]);
      expect(syncResult.usageBytes).toBe(500000);
    });
  });

  /**
   * Property-Based Test: All valid token operations succeed
   * 
   * **Validates: Requirement 3.1**
   * 
   * For any Google Drive operation with valid tokens, the operation should
   * succeed without additional token refresh overhead.
   */
  describe('Property-based: Valid token operations', () => {
    it('should handle any valid token scenario without refresh', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random valid scenarios
          fc.record({
            accountId: fc.uuid(),
            userId: fc.uuid(),
            operationType: fc.constantFrom('sync', 'list', 'delete'),
            usageBytes: fc.integer({ min: 0, max: 10000000000 }),
            limitBytes: fc.integer({ min: 1000000000, max: 100000000000 }),
          }),
          async (scenario) => {
            // Arrange
            const mockAccount = {
              _id: scenario.accountId,
              id: scenario.accountId,
              userId: scenario.userId,
              provider: 'GOOGLE_DRIVE',
              encryptedCredentials: 'encrypted-valid',
              status: 'ACTIVE',
              providerFolderId: 'root',
            } as unknown as StorageAccountDocument;

            (decryptJson as jest.Mock).mockReturnValue({
              refreshToken: 'valid-refresh-token',
              accessToken: 'valid-access-token',
              expiryDate: Date.now() + 3600000, // Valid for 1 hour
            });

            // Mock responses based on operation type
            if (scenario.operationType === 'sync') {
              mockDrive.about.get.mockResolvedValue({
                data: {
                  storageQuota: {
                    usage: String(scenario.usageBytes),
                    limit: String(scenario.limitBytes),
                  },
                },
              });

              // Act
              const result = await provider.syncUsage(mockAccount);

              // Assert
              expect(result.usageBytes).toBe(scenario.usageBytes);
              expect(result.limitBytes).toBe(scenario.limitBytes);
            } else if (scenario.operationType === 'list') {
              mockDrive.files.list.mockResolvedValue({
                data: { files: [] },
              });

              // Act
              const result = await provider.listItems(mockAccount);

              // Assert
              expect(result.files).toBeDefined();
              expect(Array.isArray(result.files)).toBe(true);
            } else if (scenario.operationType === 'delete') {
              mockDrive.files.delete.mockResolvedValue({});

              // Act
              await provider.deleteItem(mockAccount, 'file-id-123');

              // Assert
              expect(mockDrive.files.delete).toHaveBeenCalled();
            }

            // Key preservation: No token refresh should occur for valid tokens
            expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 } // Run 20 random scenarios
      );
    });
  });

  /**
   * Property 4: Operations Maintain Consistency
   * 
   * **Validates: Requirement 3.2**
   * 
   * Multiple sequential operations with valid tokens should maintain
   * consistent behavior without unnecessary token refreshes.
   */
  describe('Property 4: Sequential operations maintain consistency', () => {
    it('should handle multiple sequential operations consistently', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-sequential',
        id: 'account-sequential',
        userId: 'user-sequential',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid',
        status: 'ACTIVE',
        providerFolderId: 'root',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock all operation responses
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'file-seq-1',
              name: 'file1.txt',
              mimeType: 'text/plain',
              size: '100',
              createdTime: '2024-01-01T00:00:00Z',
              modifiedTime: '2024-01-01T00:00:00Z',
            },
          ],
        },
      });

      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '1000000',
            limit: '10000000000',
          },
        },
      });

      mockDrive.files.delete.mockResolvedValue({});

      // Act: Perform sequence of operations
      const listResult = await provider.listItems(mockAccount);
      const syncResult = await provider.syncUsage(mockAccount);
      await provider.deleteItem(mockAccount, 'file-seq-1');

      // Assert: All operations succeed consistently
      expect(listResult.files).toHaveLength(1);
      expect(syncResult.usageBytes).toBe(1000000);
      expect(mockDrive.files.delete).toHaveBeenCalledWith({ 
        fileId: 'file-seq-1',
        supportsAllDrives: true,
      });
      
      // Key preservation: No token refresh during valid token operations
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });

    it('should handle concurrent operations with valid tokens', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-concurrent-valid',
        id: 'account-concurrent-valid',
        userId: 'user-concurrent',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-valid',
        status: 'ACTIVE',
        providerFolderId: 'root',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'valid-refresh-token',
        accessToken: 'valid-access-token',
        expiryDate: Date.now() + 3600000, // Valid for 1 hour
      });

      // Mock responses
      mockDrive.files.list.mockResolvedValue({
        data: { files: [] },
      });

      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '2000000',
            limit: '20000000000',
          },
        },
      });

      // Act: Launch concurrent operations with different methods
      const operations = await Promise.all([
        provider.listItems(mockAccount),
        provider.syncUsage(mockAccount),
        provider.listItems(mockAccount),
      ]);

      // Assert: All operations succeed
      expect(operations[0].files).toBeDefined();
      expect(operations[1].usageBytes).toBe(2000000);
      expect(operations[2].files).toBeDefined();
      
      // Key preservation: No token refresh for valid tokens
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });
  });

  /**
   * Property 5: Credential Decryption Works Correctly
   * 
   * **Validates: Requirement 3.5**
   * 
   * The current credential decryption and handling should continue to work
   * exactly as before for existing accounts.
   */
  describe('Property 5: Credential handling preservation', () => {
    it('should correctly decrypt and use credentials', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-decrypt',
        id: 'account-decrypt',
        userId: 'user-decrypt',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-credentials-string',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      const expectedCredentials = {
        refreshToken: 'decrypted-refresh-token',
      };

      (decryptJson as jest.Mock).mockReturnValue(expectedCredentials);

      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '3000000',
            limit: '30000000000',
          },
        },
      });

      // Act
      await provider.syncUsage(mockAccount);

      // Assert: Credentials decrypted correctly
      expect(decryptJson).toHaveBeenCalledWith('encrypted-credentials-string');
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'decrypted-refresh-token',
      });
    });

    it('should handle missing credentials appropriately', async () => {
      // Arrange: Account without credentials
      const mockAccount = {
        _id: 'account-no-creds',
        id: 'account-no-creds',
        userId: 'user-no-creds',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: null,
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      // Act & Assert: Should throw appropriate error
      await expect(provider.syncUsage(mockAccount)).rejects.toThrow(
        'Google Drive account is missing credentials'
      );
    });
  });
});
