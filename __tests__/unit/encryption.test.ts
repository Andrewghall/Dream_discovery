/**
 * Unit Tests - Encryption Module
 * Tests for AES-256-GCM encryption/decryption and PBKDF2 key derivation
 */

import { describe, it, expect } from 'vitest';
import { encryptData, decryptData } from '@/lib/encryption';

describe('Encryption Module', () => {
  const testPassword = 'test-password-123';
  const testData = { userId: 'test-123', email: 'test@example.com', secret: 'sensitive-data' };

  describe('encryptData', () => {
    it('should successfully encrypt data with valid password', () => {
      const encrypted = encryptData(testData, testPassword);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
      expect(encrypted).not.toContain(testData.email); // Should not contain plaintext
    });

    it('should produce different ciphertext for same data (random IV)', () => {
      const encrypted1 = encryptData(testData, testPassword);
      const encrypted2 = encryptData(testData, testPassword);

      expect(encrypted1).not.toBe(encrypted2); // Different IVs produce different ciphertext
    });

    it('should handle empty objects', () => {
      const encrypted = encryptData({}, testPassword);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, 3],
              boolean: true,
              null: null,
            },
          },
        },
      };

      const encrypted = encryptData(complexData, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      expect(decrypted).toEqual(complexData);
    });

    it('should handle special characters in data', () => {
      const specialData = {
        emoji: '🔐🔑',
        unicode: 'こんにちは',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      };

      const encrypted = encryptData(specialData, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      expect(decrypted).toEqual(specialData);
    });
  });

  describe('decryptData', () => {
    it('should successfully decrypt data with correct password', () => {
      const encrypted = encryptData(testData, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      expect(decrypted).toEqual(testData);
    });

    it('should return null with incorrect password', () => {
      const encrypted = encryptData(testData, testPassword);
      const decrypted = decryptData(encrypted, 'wrong-password');

      expect(decrypted).toBeNull();
    });

    it('should return null for invalid ciphertext format', () => {
      const invalidCiphertext = 'not-a-valid-encrypted-string';
      const decrypted = decryptData(invalidCiphertext, testPassword);

      expect(decrypted).toBeNull();
    });

    it('should return null for corrupted ciphertext', () => {
      const encrypted = encryptData(testData, testPassword);
      const corrupted = encrypted.slice(0, -10) + 'xxxxxxxxxx'; // Corrupt the end
      const decrypted = decryptData(corrupted, testPassword);

      expect(decrypted).toBeNull();
    });

    it('should return null for empty string', () => {
      const decrypted = decryptData('', testPassword);

      expect(decrypted).toBeNull();
    });

    it('should handle large data payloads', () => {
      const largeData = {
        array: new Array(1000).fill({ name: 'test', value: 'data', nested: { deep: true } }),
      };

      const encrypted = encryptData(largeData, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      expect(decrypted).toEqual(largeData);
    });
  });

  describe('Encryption Roundtrip', () => {
    it('should successfully encrypt and decrypt boolean values', () => {
      const data = { isActive: true, isDeleted: false };
      const encrypted = encryptData(data, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      expect(decrypted).toEqual(data);
    });

    it('should successfully encrypt and decrypt numbers', () => {
      const data = { count: 42, price: 19.99, negative: -100 };
      const encrypted = encryptData(data, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      expect(decrypted).toEqual(data);
    });

    it('should successfully encrypt and decrypt null values', () => {
      const data = { nullable: null };
      const encrypted = encryptData(data, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      expect(decrypted).toEqual(data);
    });

    it('should successfully encrypt and decrypt arrays', () => {
      const data = { items: ['one', 'two', 'three'], numbers: [1, 2, 3] };
      const encrypted = encryptData(data, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      expect(decrypted).toEqual(data);
    });

    it('should preserve data types after roundtrip', () => {
      const data = {
        string: 'text',
        number: 123,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' },
      };

      const encrypted = encryptData(data, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      expect(decrypted).toEqual(data);
      expect(typeof decrypted.string).toBe('string');
      expect(typeof decrypted.number).toBe('number');
      expect(typeof decrypted.boolean).toBe('boolean');
      expect(decrypted.null).toBeNull();
      expect(Array.isArray(decrypted.array)).toBe(true);
      expect(typeof decrypted.object).toBe('object');
    });
  });

  describe('Security Properties', () => {
    it('should use different salt for same password (PBKDF2)', () => {
      // Encrypt same data with same password twice
      const encrypted1 = encryptData(testData, testPassword);
      const encrypted2 = encryptData(testData, testPassword);

      // Extract salt from both (first 32 bytes of base64 decoded string)
      const decoded1 = Buffer.from(encrypted1, 'base64');
      const decoded2 = Buffer.from(encrypted2, 'base64');

      const salt1 = decoded1.slice(0, 16);
      const salt2 = decoded2.slice(0, 16);

      // Salts should be different
      expect(salt1.equals(salt2)).toBe(false);
    });

    it('should use different IV for same data (AES-GCM)', () => {
      const encrypted1 = encryptData(testData, testPassword);
      const encrypted2 = encryptData(testData, testPassword);

      // Extract IV from both (bytes 16-28 of base64 decoded string)
      const decoded1 = Buffer.from(encrypted1, 'base64');
      const decoded2 = Buffer.from(encrypted2, 'base64');

      const iv1 = decoded1.slice(16, 28);
      const iv2 = decoded2.slice(16, 28);

      // IVs should be different
      expect(iv1.equals(iv2)).toBe(false);
    });

    it('should produce different ciphertext with different passwords', () => {
      const encrypted1 = encryptData(testData, 'password1');
      const encrypted2 = encryptData(testData, 'password2');

      expect(encrypted1).not.toBe(encrypted2);

      // Verify both can be decrypted with correct passwords
      const decrypted1 = decryptData(encrypted1, 'password1');
      const decrypted2 = decryptData(encrypted2, 'password2');

      expect(decrypted1).toEqual(testData);
      expect(decrypted2).toEqual(testData);

      // Verify cross-decryption fails
      expect(decryptData(encrypted1, 'password2')).toBeNull();
      expect(decryptData(encrypted2, 'password1')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long passwords', () => {
      const longPassword = 'a'.repeat(1000);
      const encrypted = encryptData(testData, longPassword);
      const decrypted = decryptData(encrypted, longPassword);

      expect(decrypted).toEqual(testData);
    });

    it('should handle single character password', () => {
      const shortPassword = 'a';
      const encrypted = encryptData(testData, shortPassword);
      const decrypted = decryptData(encrypted, shortPassword);

      expect(decrypted).toEqual(testData);
    });

    it('should handle data with circular references gracefully', () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData; // Create circular reference

      // JSON.stringify will throw on circular references
      expect(() => encryptData(circularData, testPassword)).toThrow();
    });

    it('should handle undefined values in objects', () => {
      const dataWithUndefined = { defined: 'value', undefined: undefined };
      const encrypted = encryptData(dataWithUndefined, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      // JSON.stringify removes undefined, so it won't be in decrypted data
      expect(decrypted).toEqual({ defined: 'value' });
    });

    it('should handle Date objects', () => {
      const dataWithDate = { timestamp: new Date('2024-01-01T00:00:00Z') };
      const encrypted = encryptData(dataWithDate, testPassword);
      const decrypted = decryptData(encrypted, testPassword);

      // Dates become ISO strings after JSON roundtrip
      expect(decrypted).toEqual({ timestamp: '2024-01-01T00:00:00.000Z' });
    });
  });
});
