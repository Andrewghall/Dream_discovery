/**
 * Password Policy — ISO 27001 A.9.4.3 / NIST SP 800-63B aligned
 *
 * Requirements:
 *   - Minimum 12 characters
 *   - At least 1 uppercase letter
 *   - At least 1 lowercase letter
 *   - At least 1 digit
 *   - At least 1 special character
 *   - Must not be a common/breached password (top-20 list)
 *
 * This module is the single source of truth for password validation.
 * It must be imported by every route that creates or updates passwords:
 *   - app/api/auth/reset-password/route.ts
 *   - app/api/admin/users/create/route.ts
 *   - app/api/admin/users/[id]/route.ts (password change)
 */

export const PASSWORD_MIN_LENGTH = 12;

/** Top-20 most commonly used / breached passwords (NIST-recommended check) */
const COMMON_PASSWORDS = new Set([
  'password123456',
  'qwerty123456',
  'administrator',
  'welcomewelcome',
  'letmein123456',
  'monkey1234567',
  'dragon1234567',
  '1q2w3e4r5t6y',
  'master123456',
  'sunshine12345',
  'princess12345',
  'iloveyou12345',
  'football12345',
  'baseball12345',
  'superman12345',
  'batman123456',
  'michael12345',
  'shadow1234567',
  'password1234',
  'abc123456789',
]);

export interface PasswordValidationResult {
  valid: boolean;
  /** Human-readable error string, undefined when valid */
  error?: string;
}

/**
 * Validate a plaintext password against the RAISE password policy.
 *
 * @param password - The plaintext password to validate
 * @returns `{ valid: true }` on success, `{ valid: false, error: string }` on failure
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one uppercase letter.',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one lowercase letter.',
    };
  }

  if (!/\d/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one digit.',
    };
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one special character.',
    };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      valid: false,
      error:
        'This password is too common. Please choose a more unique password.',
    };
  }

  return { valid: true };
}
