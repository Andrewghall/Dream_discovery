/**
 * Encryption utilities for data at rest
 * Uses AES-256-GCM for encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM mode
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get encryption key from environment variable
 * Derives a cryptographic key using PBKDF2
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;

  if (!secret) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Use a fixed salt for key derivation (stored separately in production)
  const salt = Buffer.from(process.env.ENCRYPTION_SALT || 'dream-discovery-salt-2026', 'utf-8');

  return crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a string value
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: iv:encrypted:authTag (hex encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:encrypted:authTag (all hex encoded)
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 *
 * @param ciphertext - The encrypted string in format: iv:encrypted:authTag
 * @returns Decrypted plaintext string
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext;

  // Check if data is encrypted (has the format iv:encrypted:authTag)
  if (!ciphertext.includes(':')) {
    // Data is not encrypted, return as-is (for backward compatibility)
    return ciphertext;
  }

  try {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, encryptedHex, authTagHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt a JSON object
 *
 * @param data - Object to encrypt
 * @returns Encrypted JSON string
 */
export function encryptJSON(data: any): string {
  if (!data) return data;

  const jsonString = JSON.stringify(data);
  return encrypt(jsonString);
}

/**
 * Decrypt a JSON string back to object
 *
 * @param encryptedData - Encrypted JSON string
 * @returns Decrypted object
 */
export function decryptJSON(encryptedData: string): any {
  if (!encryptedData) return encryptedData;

  const decrypted = decrypt(encryptedData);

  try {
    return JSON.parse(decrypted);
  } catch (error) {
    // If not valid JSON, return as string
    return decrypted;
  }
}

/**
 * Check if encryption is enabled
 */
export function isEncryptionEnabled(): boolean {
  return process.env.ENCRYPTION_ENABLED === 'true' && !!process.env.ENCRYPTION_KEY;
}

/**
 * Encrypt sensitive fields in an object (selective encryption)
 *
 * @param data - Object with fields to encrypt
 * @param fields - Array of field names to encrypt
 * @returns Object with encrypted fields
 */
export function encryptFields<T extends Record<string, any>>(
  data: T,
  fields: (keyof T)[]
): T {
  if (!isEncryptionEnabled()) {
    return data;
  }

  const encrypted = { ...data };

  for (const field of fields) {
    if (encrypted[field]) {
      if (typeof encrypted[field] === 'string') {
        encrypted[field] = encrypt(encrypted[field] as string) as T[keyof T];
      } else if (typeof encrypted[field] === 'object') {
        encrypted[field] = encryptJSON(encrypted[field]) as T[keyof T];
      }
    }
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in an object
 *
 * @param data - Object with encrypted fields
 * @param fields - Array of field names to decrypt
 * @returns Object with decrypted fields
 */
export function decryptFields<T extends Record<string, any>>(
  data: T,
  fields: (keyof T)[]
): T {
  if (!isEncryptionEnabled()) {
    return data;
  }

  const decrypted = { ...data };

  for (const field of fields) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      try {
        // Try to decrypt as JSON first
        const decryptedValue = decrypt(decrypted[field] as string);
        try {
          decrypted[field] = JSON.parse(decryptedValue) as T[keyof T];
        } catch {
          // Not JSON, use as string
          decrypted[field] = decryptedValue as T[keyof T];
        }
      } catch (error) {
        console.error(`Failed to decrypt field ${String(field)}:`, error);
        // Null out the field rather than exposing raw ciphertext to the UI.
        // This happens when data was encrypted with a different key (e.g. after
        // key rotation). The user will need to re-enter the value.
        decrypted[field] = null as T[keyof T];
      }
    }
  }

  return decrypted;
}

/**
 * Generate a secure random encryption key
 * Use this to generate ENCRYPTION_KEY for .env
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

// ══════════════════════════════════════════════════════════════
// PASSWORD-BASED ENCRYPTION (used by GDPR export/delete flows)
// ══════════════════════════════════════════════════════════════

const PB_SALT_LENGTH = 16;
const PB_IV_LENGTH = 12; // GCM recommended 12-byte nonce
const PB_TAG_LENGTH = 16;
const PB_KEY_LENGTH = 32;
const PB_ITERATIONS = 100000;

/**
 * Encrypt an object with a user-supplied password.
 * Uses PBKDF2 key derivation + AES-256-GCM.
 * Output: base64( salt || iv || authTag || ciphertext )
 *
 * @param data - Object to encrypt (will be JSON-serialised)
 * @param password - Encryption password
 * @returns base64-encoded ciphertext
 */
export function encryptData(data: unknown, password: string): string {
  const plaintext = JSON.stringify(data);

  const salt = crypto.randomBytes(PB_SALT_LENGTH);
  const iv = crypto.randomBytes(PB_IV_LENGTH);
  const key = crypto.pbkdf2Sync(password, salt, PB_ITERATIONS, PB_KEY_LENGTH, 'sha256');

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: salt(16) | iv(12) | authTag(16) | ciphertext(...)
  const packed = Buffer.concat([salt, iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt a base64 ciphertext produced by encryptData.
 * Returns the parsed object on success, or null on any failure
 * (wrong password, corrupt data, invalid format).
 *
 * @param ciphertext - base64-encoded ciphertext from encryptData
 * @param password - Decryption password
 * @returns Parsed object or null
 */
export function decryptData(ciphertext: string, password: string): any {
  if (!ciphertext) return null;

  try {
    const packed = Buffer.from(ciphertext, 'base64');

    // Minimum length: salt(16) + iv(12) + authTag(16) + at least 1 byte
    if (packed.length < PB_SALT_LENGTH + PB_IV_LENGTH + PB_TAG_LENGTH + 1) {
      return null;
    }

    const salt = packed.subarray(0, PB_SALT_LENGTH);
    const iv = packed.subarray(PB_SALT_LENGTH, PB_SALT_LENGTH + PB_IV_LENGTH);
    const authTag = packed.subarray(PB_SALT_LENGTH + PB_IV_LENGTH, PB_SALT_LENGTH + PB_IV_LENGTH + PB_TAG_LENGTH);
    const encrypted = packed.subarray(PB_SALT_LENGTH + PB_IV_LENGTH + PB_TAG_LENGTH);

    const key = crypto.pbkdf2Sync(password, salt, PB_ITERATIONS, PB_KEY_LENGTH, 'sha256');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    // Wrong password, corrupt data, invalid base64, etc.
    return null;
  }
}
