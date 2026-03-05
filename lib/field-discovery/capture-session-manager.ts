/**
 * Capture Session Manager
 *
 * CRUD helpers and progress aggregation for field discovery
 * capture sessions. All database access via Prisma Client.
 */

import { prisma } from '@/lib/prisma';
import type { CaptureType, CaptureSessionStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateSessionParams {
  workshopId: string;
  captureType: CaptureType;
  actorRole?: string;
  area?: string;
  department?: string;
  participantName?: string;
  consentFlag?: boolean;
  deviceType?: string;
}

export interface UpdateSessionParams {
  status?: CaptureSessionStatus;
  actorRole?: string;
  area?: string;
  department?: string;
  participantName?: string;
  consentFlag?: boolean;
}

export interface CreateSegmentParams {
  captureSessionId: string;
  segmentIndex: number;
  startTimeMs?: bigint;
  endTimeMs?: bigint;
  audioReference?: string;
  transcriptReference?: string;
  transcript?: string;
  status?: string;
}

export interface SessionProgress {
  totalSessions: number;
  byStatus: Record<string, number>;
  byCaptureType: Record<string, number>;
  byActorRole: Record<string, number>;
  totalSegments: number;
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

export async function createCaptureSession(params: CreateSessionParams) {
  return prisma.captureSession.create({
    data: {
      workshopId: params.workshopId,
      captureType: params.captureType,
      actorRole: params.actorRole ?? null,
      area: params.area ?? null,
      department: params.department ?? null,
      participantName: params.participantName ?? null,
      consentFlag: params.consentFlag ?? false,
      deviceType: params.deviceType ?? null,
    },
    include: { segments: true },
  });
}

export async function getCaptureSession(sessionId: string) {
  return prisma.captureSession.findUnique({
    where: { id: sessionId },
    include: {
      segments: { orderBy: { segmentIndex: 'asc' } },
      findings: true,
    },
  });
}

export async function listCaptureSessions(workshopId: string, filters?: {
  captureType?: CaptureType;
  status?: CaptureSessionStatus;
  actorRole?: string;
}) {
  const where: Record<string, unknown> = { workshopId };
  if (filters?.captureType) where.captureType = filters.captureType;
  if (filters?.status) where.status = filters.status;
  if (filters?.actorRole) where.actorRole = filters.actorRole;

  return prisma.captureSession.findMany({
    where,
    include: {
      segments: { orderBy: { segmentIndex: 'asc' } },
      _count: { select: { findings: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateCaptureSession(sessionId: string, params: UpdateSessionParams) {
  const data: Record<string, unknown> = {};
  if (params.status !== undefined) data.status = params.status;
  if (params.actorRole !== undefined) data.actorRole = params.actorRole;
  if (params.area !== undefined) data.area = params.area;
  if (params.department !== undefined) data.department = params.department;
  if (params.participantName !== undefined) data.participantName = params.participantName;
  if (params.consentFlag !== undefined) data.consentFlag = params.consentFlag;

  return prisma.captureSession.update({
    where: { id: sessionId },
    data,
    include: { segments: { orderBy: { segmentIndex: 'asc' } } },
  });
}

export async function deleteCaptureSession(sessionId: string) {
  return prisma.captureSession.delete({ where: { id: sessionId } });
}

// ---------------------------------------------------------------------------
// Segment CRUD
// ---------------------------------------------------------------------------

export async function createSegment(params: CreateSegmentParams) {
  return prisma.captureSegment.create({
    data: {
      captureSessionId: params.captureSessionId,
      segmentIndex: params.segmentIndex,
      startTimeMs: params.startTimeMs ?? null,
      endTimeMs: params.endTimeMs ?? null,
      audioReference: params.audioReference ?? null,
      transcriptReference: params.transcriptReference ?? null,
      transcript: params.transcript ?? null,
      status: params.status ?? 'pending',
    },
  });
}

export async function updateSegment(segmentId: string, data: {
  endTimeMs?: bigint;
  audioReference?: string;
  transcriptReference?: string;
  transcript?: string;
  status?: string;
}) {
  return prisma.captureSegment.update({
    where: { id: segmentId },
    data,
  });
}

// ---------------------------------------------------------------------------
// Progress Aggregation
// ---------------------------------------------------------------------------

export async function getSessionProgress(workshopId: string): Promise<SessionProgress> {
  const sessions = await prisma.captureSession.findMany({
    where: { workshopId },
    select: {
      status: true,
      captureType: true,
      actorRole: true,
      _count: { select: { segments: true } },
    },
  });

  const byStatus: Record<string, number> = {};
  const byCaptureType: Record<string, number> = {};
  const byActorRole: Record<string, number> = {};
  let totalSegments = 0;

  for (const session of sessions) {
    byStatus[session.status] = (byStatus[session.status] || 0) + 1;
    byCaptureType[session.captureType] = (byCaptureType[session.captureType] || 0) + 1;
    if (session.actorRole) {
      byActorRole[session.actorRole] = (byActorRole[session.actorRole] || 0) + 1;
    }
    totalSegments += session._count.segments;
  }

  return {
    totalSessions: sessions.length,
    byStatus,
    byCaptureType,
    byActorRole,
    totalSegments,
  };
}
