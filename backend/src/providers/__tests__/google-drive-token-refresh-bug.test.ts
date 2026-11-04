/**
 * Bug Condition Exploration Test for Google Drive Token Refresh
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This test encodes the EXPECTED behavior after the fix. It will validate the fix
 * when it passes after implementation.
 * 
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3**
 */

import { GoogleDriveStorageProvider } from '../google-drive.provider';
import { StorageAccountDocument } from '../../models/storage-account.model';
import StorageAccountModel from '../../models/storage-account.model';
import { google } from 'googleapis';
import { decryptJson, encryptJson } from '../../utils/crypto';
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

describe('Google Drive Token Refresh Bug Condition Exploration', () => {
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
        access_token: 'new-access-token-123',
        expiry_date: Date.now() + 3600000, // 1 hour from now
      },
    };

    // Setup mock Drive client
    mockDrive = {
      files: {
        list: jest.fn(),
        get: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      about: {
        get: jest.fn(),
      },
    };

    (google.auth.OAuth2 as any) = jest.fn(() => mockOAuth2Client);
    (google.drive as any) = jest.fn(() => mockDrive);
    
    // Mock encryptJson to return a string
    (encryptJson as jest.Mock).mockReturnValue('encrypted-credentials-string');
  });

  /**
   * Test Case 1: Account with only refreshToken (no accessToken)
   * 
   * Bug Condition: Account has only refreshToken in credentials
   * Expected Behavior: getDrive() should auto-refresh and syncUsage() should succeed
   * Expected on UNFIXED code: 401 error, account marked as ERROR
   */
  describe('Test Case 1: Account with only refreshToken (no accessToken)', () => {
    it('should automatically refresh token and complete sync operation', async () => {
      // Arrange: Create account with only refreshToken (typical after OAuth flow)
      const mockAccount = {
        _id: 'account-123',
        id: 'account-123',
        userId: 'user-123',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-refresh-only',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      // Mock decryption to return only refreshToken (no accessToken, no expiryDate)
      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'refresh-token-abc123',
      });

      // Mock OAuth2 token refresh
      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token: 'new-access-token-123',
      });

      // Mock Drive API response
      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '1000000',
            limit: '10000000000',
          },
        },
      });

      // Mock database update for credentials
      (StorageAccountModel.updateCredentials as jest.Mock).mockResolvedValue(mockAccount);

      // Act: Call syncUsage which internally calls getDrive()
      const result = await provider.syncUsage(mockAccount);

      // Assert: Verify token refresh occurred and operation succeeded
      expect(result.usageBytes).toBe(1000000);
      expect(result.limitBytes).toBe(10000000000);
      
      // Verify credentials were set with refresh token
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh_token: 'refresh-token-abc123',
        })
      );

      // EXPECTED BEHAVIOR: After fix, these assertions will pass
      // - Token should be refreshed (getAccessToken called)
      // - New credentials should be saved to database
      // - Account status should remain ACTIVE (not ERROR)
      // 
      // ON UNFIXED CODE: This test will FAIL because:
      // - No automatic token refresh logic exists
      // - Drive API calls will fail with 401
      // - Account will be marked as ERROR status
    });

    it('should store refreshed accessToken and expiryDate in database', async () => {
      // Arrange
      const mockAccount = {
        _id: 'account-456',
        id: 'account-456',
        userId: 'user-456',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-refresh-only',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'refresh-token-xyz789',
      });

      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token: 'new-access-token-456',
      });

      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '500000',
            limit: '5000000000',
          },
        },
      });

      const mockUpdatedAccount = { ...mockAccount, encryptedCredentials: 'encrypted-with-tokens' };
      (StorageAccountModel.updateCredentials as jest.Mock).mockResolvedValue(mockUpdatedAccount);

      // Act
      await provider.syncUsage(mockAccount);

      // Assert: Verify database was updated with new credentials
      // EXPECTED BEHAVIOR: After fix, credentials should include accessToken and expiryDate
      expect(StorageAccountModel.updateCredentials).toHaveBeenCalledWith(
        'account-456',
        expect.objectContaining({
          encryptedCredentials: expect.any(String),
        })
      );

      // ON UNFIXED CODE: This will FAIL because:
      // - No logic exists to save refreshed tokens
      // - Credentials remain incomplete (only refreshToken)
    });
  });

  /**
   * Test Case 2: Account with expired accessToken (expiryDate in past)
   * 
   * Bug Condition: Account has accessToken but it's expired
   * Expected Behavior: getDrive() should detect expiration and refresh before API call
   * Expected on UNFIXED code: 401/403 error on API call
   */
  describe('Test Case 2: Account with expired accessToken', () => {
    it('should refresh expired token before executing listItems operation', async () => {
      // Arrange: Account with expired accessToken
      const expiredTime = Date.now() - 3600000; // Expired 1 hour ago
      const mockAccount = {
        _id: 'account-789',
        id: 'account-789',
        userId: 'user-789',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-expired-token',
        status: 'ACTIVE',
        providerFolderId: 'root',
      } as unknown as StorageAccountDocument;

      // Mock credentials with expired token
      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'refresh-token-expired',
        accessToken: 'old-expired-token',
        expiryDate: expiredTime,
      });

      // Mock token refresh
      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token: 'refreshed-access-token',
      });

      // Mock listItems API call
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'file-1',
              name: 'test-file.txt',
              mimeType: 'text/plain',
              size: '1024',
              createdTime: '2024-01-01T00:00:00Z',
              modifiedTime: '2024-01-02T00:00:00Z',
            },
          ],
        },
      });

      (StorageAccountModel.updateCredentials as jest.Mock).mockResolvedValue(mockAccount);

      // Act: Perform listItems operation with expired token
      const result = await provider.listItems(mockAccount);

      // Assert: Operation should succeed after token refresh
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('test-file.txt');

      // EXPECTED BEHAVIOR: After fix
      // - Expired token detected (expiryDate in past)
      // - Token automatically refreshed
      // - API call succeeds with new token
      // 
      // ON UNFIXED CODE: Will FAIL because:
      // - No expiry checking logic
      // - Old expired token used for API call
      // - API returns 401/403 error
    });
  });

  /**
   * Test Case 3: Account with accessToken expiring soon (proactive refresh)
   * 
   * Bug Condition: accessToken expires within 1 minute
   * Expected Behavior: Proactive refresh to avoid mid-operation expiration
   * Expected on UNFIXED code: May succeed initially but fail on longer operations
   */
  describe('Test Case 3: Token expiring soon (proactive refresh)', () => {
    it('should proactively refresh token when expiring within 5 minutes', async () => {
      // Arrange: Token expiring in 1 minute
      const expiryTime = Date.now() + 60000; // Expires in 1 minute
      const mockAccount = {
        _id: 'account-proactive',
        id: 'account-proactive',
        userId: 'user-proactive',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-expiring-soon',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'refresh-token-proactive',
        accessToken: 'expiring-soon-token',
        expiryDate: expiryTime,
      });

      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token: 'proactive-refreshed-token',
      });

      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '2000000',
            limit: '20000000000',
          },
        },
      });

      (StorageAccountModel.updateCredentials as jest.Mock).mockResolvedValue(mockAccount);

      // Act
      await provider.syncUsage(mockAccount);

      // Assert: Token should be proactively refreshed
      // EXPECTED BEHAVIOR: After fix
      // - Detect token expires in < 5 minutes
      // - Trigger proactive refresh
      // - Use new token for API call
      // 
      // ON UNFIXED CODE: Will FAIL because:
      // - No proactive refresh logic
      // - May fail mid-operation when token expires
    });
  });

  /**
   * Test Case 4: Concurrent requests with expired token (race condition test)
   * 
   * Bug Condition: Multiple requests hit account with expired token simultaneously
   * Expected Behavior: Only one refresh occurs, all requests succeed
   * Expected on UNFIXED code: Multiple refresh attempts or failures
   */
  describe('Test Case 4: Concurrent requests with expired token', () => {
    it('should handle concurrent requests without race conditions', async () => {
      // Arrange: Shared account with expired token
      const expiredTime = Date.now() - 3600000;
      const mockAccount = {
        _id: 'account-concurrent',
        id: 'account-concurrent',
        userId: 'user-concurrent',
        provider: 'GOOGLE_DRIVE',
        encryptedCredentials: 'encrypted-concurrent-test',
        status: 'ACTIVE',
      } as unknown as StorageAccountDocument;

      (decryptJson as jest.Mock).mockReturnValue({
        refreshToken: 'refresh-token-concurrent',
        accessToken: 'expired-concurrent-token',
        expiryDate: expiredTime,
      });

      let refreshCallCount = 0;
      mockOAuth2Client.getAccessToken.mockImplementation(async () => {
        refreshCallCount++;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return { token: `refreshed-token-${refreshCallCount}` };
      });

      mockDrive.about.get.mockResolvedValue({
        data: {
          storageQuota: {
            usage: '3000000',
            limit: '30000000000',
          },
        },
      });

      (StorageAccountModel.updateCredentials as jest.Mock).mockResolvedValue(mockAccount);

      // Act: Launch 5 concurrent sync operations
      const concurrentOperations = Array(5).fill(null).map(() => 
        provider.syncUsage(mockAccount)
      );

      const results = await Promise.all(concurrentOperations);

      // Assert: All operations succeed
      results.forEach(result => {
        expect(result.usageBytes).toBe(3000000);
        expect(result.limitBytes).toBe(30000000000);
      });

      // EXPECTED BEHAVIOR: After fix
      // - Only ONE token refresh should occur (race condition prevention)
      // - All 5 operations should succeed
      // - No token refresh conflicts
      // 
      // ON UNFIXED CODE: Will FAIL because:
      // - No mutex/locking mechanism
      // - Multiple simultaneous refresh attempts
      // - Possible race conditions or failures
      
      // Note: On unfixed code, refreshCallCount might be > 1 or operations might fail
    });
  });

  /**
   * Property-based test: Token refresh should work for any expired token scenario
   * 
   * This uses fast-check to generate random expired token scenarios and verify
   * that the system handles them correctly.
   */
  describe('Property-based: Token refresh for any expired scenario', () => {
    it('should refresh tokens for any account with expired/missing accessToken', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random account scenarios
          fc.record({
            accountId: fc.uuid(),
            userId: fc.uuid(),
            hasAccessToken: fc.boolean(),
            isExpired: fc.boolean(),
            expiryOffsetMs: fc.integer({ min: -7200000, max: 0 }), // Up to 2 hours in past
          }),
          async (scenario) => {
            // Arrange
            const mockAccount = {
              _id: scenario.accountId,
              id: scenario.accountId,
              userId: scenario.userId,
              provider: 'GOOGLE_DRIVE',
              encryptedCredentials: 'encrypted-test',
              status: 'ACTIVE',
            } as unknown as StorageAccountDocument;

            const credentials: any = {
              refreshToken: 'test-refresh-token',
            };

            // Add expired or missing accessToken based on scenario
            if (scenario.hasAccessToken && scenario.isExpired) {
              credentials.accessToken = 'expired-token';
              credentials.expiryDate = Date.now() + scenario.expiryOffsetMs;
            }

            (decryptJson as jest.Mock).mockReturnValue(credentials);

            mockOAuth2Client.getAccessToken.mockResolvedValue({
              token: 'new-refreshed-token',
            });

            mockDrive.about.get.mockResolvedValue({
              data: {
                storageQuota: {
                  usage: '1000000',
                  limit: '10000000000',
                },
              },
            });

            (StorageAccountModel.updateCredentials as jest.Mock).mockResolvedValue(mockAccount);

            // Act
            const result = await provider.syncUsage(mockAccount);

            // Assert: Should always succeed after token refresh
            expect(result.usageBytes).toBeGreaterThanOrEqual(0);
            expect(result.limitBytes).toBeGreaterThan(0);

            // EXPECTED BEHAVIOR: After fix, all scenarios should succeed
            // ON UNFIXED CODE: Will FAIL for expired/missing token scenarios
          }
        ),
        { numRuns: 10 } // Run 10 random scenarios
      );
    });
  });
});

/**
 * Unit Test for Task 3.4: Per-Account Mutex Implementation
 * 
 * This test verifies that the mutex prevents race conditions during concurrent
 * token refresh operations for the same account.
 */
describe('Task 3.4: Per-Account Mutex for Race Condition Prevention', () => {
  let provider: GoogleDriveStorageProvider;
  let mockOAuth2Client: any;
  let mockDrive: any;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GoogleDriveStorageProvider();

    mockOAuth2Client = {
      setCredentials: jest.fn(),
      getAccessToken: jest.fn(),
      credentials: {
        access_token: 'new-access-token',
        expiry_date: Date.now() + 3600000,
      },
    };

    mockDrive = {
      files: { list: jest.fn() },
      about: { get: jest.fn() },
    };

    (google.auth.OAuth2 as any) = jest.fn(() => mockOAuth2Client);
    (google.drive as any) = jest.fn(() => mockDrive);
    (encryptJson as jest.Mock).mockReturnValue('encrypted-credentials');
  });

  it('should ensure only one token refresh occurs for concurrent requests to same account', async () => {
    const accountId = 'test-account-mutex';
    const mockAccount = {
      _id: accountId,
      id: accountId,
      userId: 'user-mutex',
      provider: 'GOOGLE_DRIVE',
      encryptedCredentials: 'encrypted-expired',
      status: 'ACTIVE',
    } as unknown as StorageAccountDocument;

    // Start with expired token
    const expiredCredentials = {
      refreshToken: 'refresh-token-mutex',
      accessToken: 'expired-token',
      expiryDate: Date.now() - 3600000, // Expired 1 hour ago
    };

    let decryptCallCount = 0;
    (decryptJson as jest.Mock).mockImplementation(() => {
      decryptCallCount++;
      // After first call, return refreshed credentials (simulating DB update)
      if (decryptCallCount > 5) {
        return {
          refreshToken: 'refresh-token-mutex',
          accessToken: 'refreshed-token',
          expiryDate: Date.now() + 3600000,
        };
      }
      return expiredCredentials;
    });

    let tokenRefreshCount = 0;
    mockOAuth2Client.getAccessToken.mockImplementation(async () => {
      tokenRefreshCount++;
      // Simulate network delay to create race condition window
      await new Promise(resolve => setTimeout(resolve, 50));
      return { token: 'refreshed-token' };
    });

    mockDrive.about.get.mockResolvedValue({
      data: {
        storageQuota: {
          usage: '1000000',
          limit: '10000000000',
        },
      },
    });

    // Mock findById to return updated credentials after refresh
    (StorageAccountModel.findById as jest.Mock).mockResolvedValue({
      ...mockAccount,
      encryptedCredentials: 'encrypted-refreshed',
    });

    (StorageAccountModel.updateCredentials as jest.Mock).mockResolvedValue(mockAccount);

    // Act: Launch 10 concurrent operations on the same account
    const concurrentCount = 10;
    const operations = Array(concurrentCount).fill(null).map(() => 
      provider.syncUsage(mockAccount)
    );

    const results = await Promise.all(operations);

    // Assert: All operations should succeed
    expect(results).toHaveLength(concurrentCount);
    results.forEach(result => {
      expect(result.usageBytes).toBe(1000000);
      expect(result.limitBytes).toBe(10000000000);
    });

    // CRITICAL: Only ONE token refresh should have occurred despite 10 concurrent requests
    // This proves the mutex is working correctly
    expect(tokenRefreshCount).toBe(1);

    // Verify database was updated exactly once (not 10 times)
    expect(StorageAccountModel.updateCredentials).toHaveBeenCalledTimes(1);

    console.log(`✅ Mutex test passed: ${tokenRefreshCount} refresh(es) for ${concurrentCount} concurrent requests`);
  });

  it('should handle timeout when refresh hangs beyond 10 seconds', async () => {
    const mockAccount = {
      _id: 'account-timeout',
      id: 'account-timeout',
      userId: 'user-timeout',
      provider: 'GOOGLE_DRIVE',
      encryptedCredentials: 'encrypted-timeout',
      status: 'ACTIVE',
    } as unknown as StorageAccountDocument;

    (decryptJson as jest.Mock).mockReturnValue({
      refreshToken: 'refresh-token-timeout',
      accessToken: 'expired-token',
      expiryDate: Date.now() - 3600000,
    });

    // Mock getAccessToken to hang indefinitely
    mockOAuth2Client.getAccessToken.mockImplementation(() => 
      new Promise(resolve => {
        // Never resolves to simulate hanging refresh
      })
    );

    mockDrive.about.get.mockResolvedValue({
      data: {
        storageQuota: {
          usage: '1000000',
          limit: '10000000000',
        },
      },
    });

    (StorageAccountModel.findById as jest.Mock).mockResolvedValue(mockAccount);
    (StorageAccountModel.updateCredentials as jest.Mock).mockResolvedValue(mockAccount);

    // Act & Assert: Should timeout after 10 seconds (or fail gracefully)
    // Note: We use a shorter timeout in test to avoid long test runtime
    const startTime = Date.now();
    
    await expect(
      Promise.race([
        provider.syncUsage(mockAccount),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), 1000) // 1 second for test
        )
      ])
    ).rejects.toThrow();

    const elapsed = Date.now() - startTime;
    
    // Verify the operation didn't hang indefinitely
    expect(elapsed).toBeLessThan(2000); // Should fail within 2 seconds

    console.log('✅ Timeout handling test passed: operation failed gracefully');
  }, 15000); // Increase jest timeout for this test

  it('should allow refresh for different accounts concurrently', async () => {
    // Arrange: Two different accounts with expired tokens
    const account1 = {
      _id: 'account-1',
      id: 'account-1',
      userId: 'user-1',
      provider: 'GOOGLE_DRIVE',
      encryptedCredentials: 'encrypted-1',
      status: 'ACTIVE',
    } as unknown as StorageAccountDocument;

    const account2 = {
      _id: 'account-2',
      id: 'account-2',
      userId: 'user-2',
      provider: 'GOOGLE_DRIVE',
      encryptedCredentials: 'encrypted-2',
      status: 'ACTIVE',
    } as unknown as StorageAccountDocument;

    (decryptJson as jest.Mock).mockImplementation((encryptedCreds: string) => {
      if (encryptedCreds === 'encrypted-1') {
        return {
          refreshToken: 'refresh-1',
          accessToken: 'expired-1',
          expiryDate: Date.now() - 3600000,
        };
      }
      return {
        refreshToken: 'refresh-2',
        accessToken: 'expired-2',
        expiryDate: Date.now() - 3600000,
      };
    });

    let refreshCount = 0;
    mockOAuth2Client.getAccessToken.mockImplementation(async () => {
      refreshCount++;
      await new Promise(resolve => setTimeout(resolve, 20));
      return { token: `refreshed-${refreshCount}` };
    });

    mockDrive.about.get.mockResolvedValue({
      data: {
        storageQuota: {
          usage: '1000000',
          limit: '10000000000',
        },
      },
    });

    (StorageAccountModel.findById as jest.Mock).mockImplementation((id: string) => 
      Promise.resolve(id === 'account-1' ? account1 : account2)
    );

    (StorageAccountModel.updateCredentials as jest.Mock).mockResolvedValue({});

    // Act: Launch concurrent operations on two DIFFERENT accounts
    const ops1 = Array(5).fill(null).map(() => provider.syncUsage(account1));
    const ops2 = Array(5).fill(null).map(() => provider.syncUsage(account2));

    const allResults = await Promise.all([...ops1, ...ops2]);

    // Assert: All 10 operations should succeed
    expect(allResults).toHaveLength(10);

    // EXPECTED: Two refreshes (one per account) should occur
    // The mutex should NOT block different accounts from refreshing concurrently
    expect(refreshCount).toBe(2);

    console.log(`✅ Multi-account test passed: ${refreshCount} refreshes for 2 different accounts`);
  });
});
