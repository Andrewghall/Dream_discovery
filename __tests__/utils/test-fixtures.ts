/**
 * Test Fixtures
 * Sample data for testing
 */

export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  password: '$2a$10$test.hashed.password', // bcrypt hash
  role: 'PLATFORM_ADMIN' as const,
  organizationId: 'test-org-id',
  isActive: true,
  failedLoginCount: 0,
  lockedUntil: null,
  lastLoginAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockTenantUser = {
  ...mockUser,
  id: 'tenant-user-id',
  email: 'tenant@example.com',
  name: 'Tenant User',
  role: 'TENANT_ADMIN' as const,
};

export const mockOrganization = {
  id: 'test-org-id',
  name: 'Test Organization',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockWorkshop = {
  id: 'test-workshop-id',
  organizationId: 'test-org-id',
  name: 'Test Workshop',
  description: 'Test workshop description',
  businessContext: 'Test business context',
  workshopType: 'STRATEGY' as const,
  status: 'IN_PROGRESS' as const,
  zoomMeetingId: null,
  createdById: 'test-user-id',
  scheduledDate: new Date('2024-02-01'),
  responseDeadline: new Date('2024-02-15'),
  includeRegulation: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockParticipant = {
  id: 'test-participant-id',
  workshopId: 'test-workshop-id',
  email: 'participant@example.com',
  name: 'Test Participant',
  role: 'Developer',
  department: 'Engineering',
  discoveryToken: 'test-discovery-token',
  attributionPreference: 'NAMED' as const,
  emailSentAt: new Date('2024-01-02'),
  doNotSendAgain: false,
  responseStartedAt: new Date('2024-01-03'),
  responseCompletedAt: new Date('2024-01-04'),
  reminderSentAt: null,
  createdAt: new Date('2024-01-01'),
};

export const mockSession = {
  id: 'test-session-id',
  userId: 'test-user-id',
  token: 'test-session-token',
  userAgent: 'Mozilla/5.0...',
  ipAddress: '127.0.0.1',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  lastActivityAt: new Date(),
  createdAt: new Date(),
  revokedAt: null,
};

export const mockConversationSession = {
  id: 'test-conversation-session-id',
  workshopId: 'test-workshop-id',
  participantId: 'test-participant-id',
  status: 'COMPLETED' as const,
  runType: 'BASELINE' as const,
  questionSetVersion: 'v1',
  currentPhase: 'summary',
  phaseProgress: 100,
  startedAt: new Date('2024-01-03'),
  completedAt: new Date('2024-01-04'),
  totalDurationMs: 900000, // 15 minutes
  language: 'en',
  voiceEnabled: false,
  includeRegulation: true,
  createdAt: new Date('2024-01-03'),
  updatedAt: new Date('2024-01-04'),
};

export const mockDataPoint = {
  id: 'test-datapoint-id',
  workshopId: 'test-workshop-id',
  rawText: 'This is a test utterance from the workshop',
  source: 'SPEECH' as const,
  speakerId: '0',
  sessionId: 'test-conversation-session-id',
  participantId: 'test-participant-id',
  questionKey: null,
  createdAt: new Date('2024-01-03'),
};

export const mockAuditLog = {
  id: 'test-audit-log-id',
  organizationId: 'test-org-id',
  userId: 'test-user-id',
  userEmail: 'test@example.com',
  action: 'CREATE_WORKSHOP',
  resourceType: 'Workshop',
  resourceId: 'test-workshop-id',
  method: 'POST',
  path: '/api/admin/workshops',
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0...',
  metadata: { workshopName: 'Test Workshop' },
  timestamp: new Date('2024-01-01'),
  success: true,
  errorMessage: null,
};

export const mockSessionPayload = {
  sessionId: 'test-session-id',
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'PLATFORM_ADMIN',
  organizationId: 'test-org-id',
  createdAt: Date.now(),
};
