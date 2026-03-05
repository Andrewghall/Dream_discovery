/**
 * Unit Tests: Secrets Validation Startup Guard
 */

import { describe, it, expect, vi } from 'vitest';
import {
  validateSecrets,
  SecretsValidationError,
} from '@/lib/compliance/secrets-guard';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Secrets Validation Startup Guard', () => {
  const validEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/mydb',
    SESSION_SECRET: 'a-very-long-session-secret-that-is-at-least-32-characters',
    ENCRYPTION_KEY: 'a-valid-encryption-key-for-testing',
  };

  describe('happy path', () => {
    it('should return valid result when all required vars are set', () => {
      const result = validateSecrets(validEnv);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('should return valid result in production with proper config', () => {
      const prodEnv: NodeJS.ProcessEnv = {
        ...validEnv,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-that-is-very-long-and-secure-enough',
        ENCRYPTION_ENABLED: 'true',
      };

      const result = validateSecrets(prodEnv);

      expect(result.valid).toBe(true);
    });
  });

  describe('missing required variables', () => {
    it('should throw when DATABASE_URL is missing', () => {
      const env = { ...validEnv };
      delete env.DATABASE_URL;

      expect(() => validateSecrets(env)).toThrow(SecretsValidationError);

      try {
        validateSecrets(env);
      } catch (e) {
        const err = e as SecretsValidationError;
        expect(err.issues).toContainEqual(
          expect.stringContaining('DATABASE_URL')
        );
      }
    });

    it('should throw with all missing vars listed', () => {
      const env: NodeJS.ProcessEnv = { NODE_ENV: 'development' };

      try {
        validateSecrets(env);
        expect.fail('Should have thrown');
      } catch (e) {
        const err = e as SecretsValidationError;
        expect(err.issues.length).toBeGreaterThanOrEqual(3);
        expect(err.issues.some((i: string) => i.includes('DATABASE_URL'))).toBe(true);
        expect(err.issues.some((i: string) => i.includes('SESSION_SECRET'))).toBe(true);
        expect(err.issues.some((i: string) => i.includes('ENCRYPTION_KEY'))).toBe(true);
      }
    });

    it('should throw when SESSION_SECRET is empty string', () => {
      const env = { ...validEnv, SESSION_SECRET: '' };

      expect(() => validateSecrets(env)).toThrow(SecretsValidationError);
    });
  });

  describe('SESSION_SECRET length validation', () => {
    it('should throw when SESSION_SECRET is too short', () => {
      const env = { ...validEnv, SESSION_SECRET: 'short' };

      try {
        validateSecrets(env);
        expect.fail('Should have thrown');
      } catch (e) {
        const err = e as SecretsValidationError;
        expect(err.issues.some((i: string) => i.includes('at least 32 characters'))).toBe(true);
      }
    });

    it('should accept SESSION_SECRET of exactly 32 characters', () => {
      const env = {
        ...validEnv,
        SESSION_SECRET: 'abcdefghijklmnopqrstuvwxyz123456', // exactly 32
      };

      const result = validateSecrets(env);
      expect(result.valid).toBe(true);
    });
  });

  describe('production-specific checks', () => {
    it('should require ENCRYPTION_ENABLED=true in production', () => {
      const env = {
        ...validEnv,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-that-is-very-long-and-secure-enough',
      };

      try {
        validateSecrets(env);
        expect.fail('Should have thrown');
      } catch (e) {
        const err = e as SecretsValidationError;
        expect(err.issues.some((i: string) => i.includes('ENCRYPTION_ENABLED'))).toBe(true);
      }
    });

    it('should reject SESSION_SECRET containing "test" in production', () => {
      const env = {
        ...validEnv,
        NODE_ENV: 'production',
        SESSION_SECRET: 'this-is-a-test-secret-that-is-long-enough-for-production',
        ENCRYPTION_ENABLED: 'true',
      };

      try {
        validateSecrets(env);
        expect.fail('Should have thrown');
      } catch (e) {
        const err = e as SecretsValidationError;
        expect(err.issues.some((i: string) => i.includes('test'))).toBe(true);
      }
    });

    it('should reject SESSION_SECRET containing "default" in production', () => {
      const env = {
        ...validEnv,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-default-secret-long-enough-for-thirty-two-chars-total',
        ENCRYPTION_ENABLED: 'true',
      };

      try {
        validateSecrets(env);
        expect.fail('Should have thrown');
      } catch (e) {
        const err = e as SecretsValidationError;
        expect(err.issues.some((i: string) => i.includes('default'))).toBe(true);
      }
    });
  });

  describe('insecure default values', () => {
    it('should reject known insecure patterns', () => {
      const env = {
        ...validEnv,
        ENCRYPTION_KEY: 'changeme',
      };

      try {
        validateSecrets(env);
        expect.fail('Should have thrown');
      } catch (e) {
        const err = e as SecretsValidationError;
        expect(err.issues.some((i: string) => i.includes('insecure default'))).toBe(true);
      }
    });
  });

  describe('warnings', () => {
    it('should emit warning for test/default in non-production SESSION_SECRET', () => {
      const env = {
        ...validEnv,
        NODE_ENV: 'development',
        SESSION_SECRET: 'a-test-secret-that-is-at-least-32-characters-long',
      };

      const result = validateSecrets(env);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('acceptable in non-production');
    });
  });

  describe('SecretsValidationError', () => {
    it('should have correct name and issues array', () => {
      const error = new SecretsValidationError(['issue1', 'issue2']);

      expect(error.name).toBe('SecretsValidationError');
      expect(error.issues).toEqual(['issue1', 'issue2']);
      expect(error.message).toContain('2 issue(s)');
    });
  });
});
