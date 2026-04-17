/**
 * Centralised Zod validation schemas for DREAM Discovery API routes.
 *
 * All schemas validate and sanitise user-supplied input before it reaches
 * business logic or the database. This provides:
 *  - Protection against prototype pollution and type confusion attacks
 *  - Consistent error messages for API consumers
 *  - Documented accepted shape for each endpoint (living API contract)
 *
 * Usage pattern:
 *   const result = SomeSchema.safeParse(await request.json());
 *   if (!result.success) {
 *     return NextResponse.json(
 *       { error: 'Invalid input', details: result.error.flatten().fieldErrors },
 *       { status: 400 }
 *     );
 *   }
 *   const { field1, field2 } = result.data;
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/** CUID / cuid2 — Prisma default ID format */
const cuid = z
  .string()
  .min(1, 'ID is required')
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, 'Invalid ID format');

/** Email — normalised to lowercase */
const email = z
  .string()
  .min(1, 'Email is required')
  .max(254)
  .email('Invalid email address')
  .transform((v) => v.toLowerCase().trim());

/** Non-empty trimmed string with max length */
const nonEmptyStr = (max = 500) =>
  z.string().min(1, 'This field is required').max(max).transform((v) => v.trim());

/** Optional trimmed string */
const optStr = (max = 500) =>
  z.string().max(max).transform((v) => v.trim()).optional().or(z.null()).optional();

// ─────────────────────────────────────────────────────────────────────────────
// Auth schemas
// ─────────────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(1024),
});

export const ResetPasswordSchema = z.object({
  token: nonEmptyStr(512),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long')
    .max(1024),
});

export const RequestPasswordResetSchema = z.object({
  email,
});

// ─────────────────────────────────────────────────────────────────────────────
// Workshop schemas
// ─────────────────────────────────────────────────────────────────────────────

const ENGAGEMENT_TYPES = [
  'DIAGNOSTIC_BASELINE',
  'OPERATIONAL_DEEP_DIVE',
  'AI_ENABLEMENT',
  'TRANSFORMATION_SPRINT',
  'CULTURAL_ALIGNMENT',
  'GO_TO_MARKET',
] as const;

const DREAM_TRACKS = ['ENTERPRISE', 'DOMAIN'] as const;

const WORKSHOP_TYPES = [
  'CUSTOM',
  'STRATEGY',
  'PROCESS',
  'CHANGE',
  'TEAM',
  'CUSTOMER',
  'INNOVATION',
  'CULTURE',
  'SALES',
] as const;

export const CreateWorkshopSchema = z.object({
  name: nonEmptyStr(200),
  description: optStr(2000),
  businessContext: optStr(5000),
  workshopType: z.enum(WORKSHOP_TYPES).optional(),
  scheduledDate: z.string().datetime().optional().or(z.null()).optional(),
  responseDeadline: z.string().datetime().optional().or(z.null()).optional(),
  includeRegulation: z.boolean().optional(),
  // DREAM prep fields
  clientName: optStr(200),
  industry: optStr(100),
  companyWebsite: z.string().url('Invalid URL').max(500).optional().or(z.literal('')).optional(),
  dreamTrack: z.enum(DREAM_TRACKS).optional().or(z.null()).optional(),
  targetDomain: optStr(200),
  engagementType: z.enum(ENGAGEMENT_TYPES).optional().or(z.null()).optional(),
});

export const PatchWorkshopSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: optStr(2000),
  businessContext: optStr(5000),
  includeRegulation: z.boolean().optional(),
  clientName: optStr(200),
  industry: optStr(100),
  companyWebsite: z.string().url('Invalid URL').max(500).optional().or(z.literal('')).optional(),
  dreamTrack: z.enum(DREAM_TRACKS).optional().or(z.null()).optional(),
  targetDomain: optStr(200),
  engagementType: z.enum(ENGAGEMENT_TYPES).optional().or(z.null()).optional(),
  domainPack: optStr(100),
  // JSON blobs — validated as non-null objects but not deeply validated here
  prepResearch: z.record(z.string(), z.unknown()).optional().or(z.null()).optional(),
  customQuestions: z.unknown().optional(),
  discoveryBriefing: z.unknown().optional(),
  blueprint: z.record(z.string(), z.unknown()).optional().or(z.null()).optional(),
}).strict();

// ─────────────────────────────────────────────────────────────────────────────
// Participant schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CreateParticipantSchema = z.object({
  name: nonEmptyStr(200),
  email,
  role: optStr(200),
  department: optStr(200),
});

export const PatchParticipantSchema = z.object({
  participantId: cuid,
  doNotSendAgain: z.boolean(),
});

export const DeleteParticipantSchema = z.object({
  participantId: cuid,
});

// ─────────────────────────────────────────────────────────────────────────────
// User management schemas
// ─────────────────────────────────────────────────────────────────────────────

const USER_ROLES = ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'] as const;

export const CreateUserSchema = z.object({
  email,
  name: nonEmptyStr(200),
  role: z.enum(USER_ROLES),
  organizationId: cuid.optional().or(z.null()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Organisation schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CreateOrganisationSchema = z.object({
  name: nonEmptyStr(200),
  billingEmail: email.optional(),
  adminName: optStr(200),
  maxSeats: z.number().int().min(1).max(1000).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex colour').optional().or(z.null()).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex colour').optional().or(z.null()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Executive portal schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ExecLoginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(1024),
});

/** Used by the admin POST /api/admin/organizations/[id]/exec-licences route.
 *  Password is generated server-side and never accepted from the client body. */
export const CreateExecLicenceSchema = z.object({
  email,
  name: nonEmptyStr(200),
  title: optStr(200),
});

// PatchExecLicenceSchema is defined below in the Exec licence management section

// ─────────────────────────────────────────────────────────────────────────────
// User management
// ─────────────────────────────────────────────────────────────────────────────

export const PatchUserSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: email.optional(),
  role: z.enum(['PLATFORM_ADMIN', 'TENANT_ADMIN', 'TENANT_USER']).optional(),
  organizationId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Exec licence management
// ─────────────────────────────────────────────────────────────────────────────

export const PatchExecLicenceSchema = z.object({
  action: z.enum(['revoke', 'reactivate']),
});

// ─────────────────────────────────────────────────────────────────────────────
// Findings
// ─────────────────────────────────────────────────────────────────────────────

export const CreateFindingSchema = z.object({
  sourceStream: z.string().min(1).max(50),
  lens: z.string().min(1).max(50),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(500).trim(),
  description: z.string().min(1).max(5000).trim(),
  severityScore: z.number().min(0).max(10).optional(),
  frequencyCount: z.number().int().min(0).optional(),
  roleCoverage: z.number().min(0).max(1).optional(),
  supportingQuotes: z.array(z.string().max(2000)).max(20).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  captureSessionId: z.string().optional(),
});

export const PatchFindingSchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  description: z.string().min(1).max(5000).trim().optional(),
  severityScore: z.number().min(0).max(10).optional(),
  frequencyCount: z.number().int().min(0).optional(),
  roleCoverage: z.number().min(0).max(1).optional(),
  supportingQuotes: z.array(z.string().max(2000)).max(20).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  isVerified: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Workshop shares
// ─────────────────────────────────────────────────────────────────────────────

export const CreateShareSchema = z.object({
  email: email,
});

export const DeleteShareSchema = z.object({
  shareId: cuid,
});

// ─────────────────────────────────────────────────────────────────────────────
// Platform admin impersonation
// ─────────────────────────────────────────────────────────────────────────────

export const EnterOrgSchema = z.object({
  organizationId: cuid,
});

// ─────────────────────────────────────────────────────────────────────────────
// Commercial password
// ─────────────────────────────────────────────────────────────────────────────

export const SetCommercialPasswordSchema = z.object({
  password: z.string().min(10, 'Password must be at least 10 characters').max(128),
});

// ─────────────────────────────────────────────────────────────────────────────
// MFA verify (second factor of login)
// ─────────────────────────────────────────────────────────────────────────────

export const MfaVerifySchema = z.object({
  mfaToken: z.string().min(1),
  totpCode: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility: standard Zod error response
// ─────────────────────────────────────────────────────────────────────────────

import type { ZodError } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Return a standardised 400 response from a Zod parse failure.
 */
export function zodError(error: ZodError): NextResponse {
  return NextResponse.json(
    { error: 'Invalid input', details: error.flatten().fieldErrors },
    { status: 400 }
  );
}
