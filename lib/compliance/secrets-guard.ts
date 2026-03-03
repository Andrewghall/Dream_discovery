/**
 * Secrets Validation Startup Guard
 *
 * Validates that required environment variables are set and meet minimum
 * security requirements before the application starts. Fails fast with
 * a clear error message listing all issues found.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class SecretsValidationError extends Error {
  public issues: string[];

  constructor(issues: string[]) {
    super(
      `Secrets validation failed with ${issues.length} issue(s):\n${issues.map((i) => `  - ${i}`).join('\n')}`
    );
    this.name = 'SecretsValidationError';
    this.issues = issues;
  }
}

export interface SecretsValidationResult {
  valid: true;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REQUIRED_VARS = ['DATABASE_URL', 'SESSION_SECRET', 'ENCRYPTION_KEY'] as const;
const MIN_SESSION_SECRET_LENGTH = 32;

const INSECURE_PATTERNS = [
  'changeme',
  'password',
  'secret123',
  'placeholder',
  'example',
  'your-secret-here',
  'replace-me',
  'xxxxxxxx',
];

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Validate that required secrets/environment variables are present and
 * meet minimum security requirements.
 *
 * In production mode (NODE_ENV=production), additional checks are enforced:
 *   - ENCRYPTION_ENABLED must be set to "true"
 *   - SESSION_SECRET must not contain "test" or "default"
 *
 * Throws SecretsValidationError if any issues are found.
 * Returns { valid: true, warnings: [] } on success.
 */
export function validateSecrets(
  env: NodeJS.ProcessEnv = process.env
): SecretsValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const isProduction = env.NODE_ENV === 'production';

  // Check required variables are present and non-empty
  for (const varName of REQUIRED_VARS) {
    const value = env[varName];
    if (!value || value.trim() === '') {
      issues.push(`Required environment variable ${varName} is missing or empty`);
    }
  }

  // SESSION_SECRET minimum length check
  const sessionSecret = env.SESSION_SECRET;
  if (sessionSecret && sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    issues.push(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters (currently ${sessionSecret.length})`
    );
  }

  // Check for insecure default values across all required vars
  for (const varName of REQUIRED_VARS) {
    const value = env[varName]?.toLowerCase() ?? '';
    for (const pattern of INSECURE_PATTERNS) {
      if (value === pattern) {
        issues.push(`${varName} appears to contain an insecure default value`);
        break;
      }
    }
  }

  // Production-specific checks
  if (isProduction) {
    const encryptionEnabled = env.ENCRYPTION_ENABLED;
    if (encryptionEnabled !== 'true') {
      issues.push('ENCRYPTION_ENABLED must be set to "true" in production');
    }

    if (sessionSecret) {
      const lower = sessionSecret.toLowerCase();
      if (lower.includes('test')) {
        issues.push('SESSION_SECRET must not contain "test" in production');
      }
      if (lower.includes('default')) {
        issues.push('SESSION_SECRET must not contain "default" in production');
      }
    }
  }

  // Non-fatal warnings
  if (!isProduction && sessionSecret) {
    const lower = sessionSecret.toLowerCase();
    if (lower.includes('test') || lower.includes('default')) {
      warnings.push('SESSION_SECRET contains "test" or "default"; acceptable in non-production');
    }
  }

  if (issues.length > 0) {
    throw new SecretsValidationError(issues);
  }

  return { valid: true, warnings };
}
