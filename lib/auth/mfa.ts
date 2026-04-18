/**
 * TOTP Multi-Factor Authentication utilities
 *
 * ISO 27001 A.9.4.2 / SOC 2 CC6.1 — MFA for privileged accounts.
 *
 * Design:
 *   - TOTP secrets are generated with `generateTotpSecret()`, encrypted with
 *     AES-256-GCM (via lib/encryption.ts), and stored in `users.totp_secret`.
 *   - Verification uses RFC 6238 (TOTP) with a ±1 window to tolerate clock skew.
 *   - MFA is REQUIRED for PLATFORM_ADMIN and TENANT_ADMIN roles when
 *     `MFA_REQUIRED=true` is set in the environment.
 *   - During rollout, set `MFA_REQUIRED=false` (default) and enrol admins
 *     before flipping the flag to enforce.
 *
 * Dependencies:
 *   - `otplib` (npm install otplib) — RFC 6238 TOTP implementation
 *   - `lib/encryption.ts` — AES-256-GCM at-rest encryption
 *
 * NOTE: Install otplib before enabling MFA:
 *   npm install otplib
 *   npx prisma generate
 */

import crypto from 'crypto';
import { encrypt, decrypt } from '@/lib/encryption';

// ─── Feature flag ──────────────────────────────────────────────────────────────
/**
 * When true, PLATFORM_ADMIN and TENANT_ADMIN sessions that have not completed
 * a TOTP challenge will receive a 403 on all protected routes.
 *
 * Set MFA_REQUIRED=true in Vercel env to enforce. Default: false (enrolment only).
 */
export function isMfaRequired(): boolean {
  return process.env.MFA_REQUIRED === 'true';
}

/** Roles for which MFA is mandatory when isMfaRequired() is true */
export const MFA_REQUIRED_ROLES = ['PLATFORM_ADMIN', 'TENANT_ADMIN'] as const;
export type MfaRequiredRole = (typeof MFA_REQUIRED_ROLES)[number];

export function requiresMfa(role: string): role is MfaRequiredRole {
  return MFA_REQUIRED_ROLES.includes(role as MfaRequiredRole);
}

// ─── Secret generation ─────────────────────────────────────────────────────────

/**
 * Generate a new TOTP secret (base32 encoded, 160 bits).
 * This is the raw secret — encrypt it before storing with storeEncryptedSecret().
 */
export function generateTotpSecret(): string {
  // 20 bytes = 160 bits — standard TOTP secret size (RFC 4226)
  const raw = crypto.randomBytes(20);
  return base32Encode(raw);
}

/**
 * Encrypt a plaintext TOTP secret for storage in `users.totp_secret`.
 * Uses AES-256-GCM via lib/encryption.ts.
 */
export function encryptTotpSecret(plainSecret: string): string {
  return encrypt(plainSecret);
}

/**
 * Decrypt a stored TOTP secret for verification.
 */
export function decryptTotpSecret(encrypted: string): string {
  return decrypt(encrypted);
}

// ─── TOTP verification ─────────────────────────────────────────────────────────

const TOTP_STEP = 30; // seconds per window
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'SHA1'; // RFC 6238 default
const TOTP_WINDOW = 1; // accept ±1 window for clock skew

/**
 * Generate the TOTP token for the current time window.
 * Used internally for verification and testing.
 */
function generateTotpToken(secret: string, counter: number): string {
  const keyBuffer = base32Decode(secret);
  const timeBuffer = Buffer.alloc(8);
  // Write counter as big-endian 64-bit integer
  timeBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  timeBuffer.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac(TOTP_ALGORITHM, keyBuffer).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % Math.pow(10, TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a user-supplied TOTP token against the stored (plaintext) secret.
 * Accepts tokens within ±TOTP_WINDOW windows to tolerate clock skew.
 *
 * @param token - 6-digit code from the authenticator app
 * @param plaintextSecret - decrypted TOTP secret
 * @returns true if the token is valid
 */
export function verifyTotp(token: string, plaintextSecret: string): boolean {
  if (!token || !/^\d{6}$/.test(token)) return false;

  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / TOTP_STEP);

  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    if (generateTotpToken(plaintextSecret, counter + i) === token) {
      return true;
    }
  }
  return false;
}

/**
 * Build the otpauth:// URI for QR code generation.
 * Display this as a QR code during MFA enrolment.
 *
 * @param secret - plaintext TOTP secret
 * @param email - user email (account identifier in authenticator apps)
 * @param issuer - service name shown in the authenticator app (default: "RAISE")
 */
export function buildTotpUri(secret: string, email: string, issuer = 'RAISE'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: TOTP_ALGORITHM,
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ─── Base32 utilities (no external deps) ──────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return result;
}

function base32Decode(str: string): Buffer {
  const upper = str.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of upper) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
