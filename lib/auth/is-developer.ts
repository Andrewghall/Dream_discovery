/**
 * Developer mode check.
 * Controlled by the DEV_EMAILS environment variable (comma-separated list).
 * No DB access — pure function.
 */
export function isDeveloperEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const devEmails = process.env.DEV_EMAILS || '';
  if (!devEmails) return false;
  const list = devEmails.split(',').map((e) => e.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}
