# DREAM Discovery Platform - API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Responses](#error-responses)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Workshop Management](#workshop-management)
  - [GDPR Compliance](#gdpr-compliance-endpoints)
  - [Conversation API](#conversation-api)
  - [Live Workshop](#live-workshop)
- [Security Best Practices](#security-best-practices)
- [Testing](#testing)

---

## Overview

The DREAM Discovery Platform provides a RESTful API for managing AI-driven conversational discovery workshops. The API supports:

- **Multi-tenant Architecture**: Organization-scoped data access with role-based permissions
- **GDPR Compliance**: Full implementation of Articles 15 (Right to Access) and 17 (Right to Erasure)
- **Real-time Features**: WebSocket support for live workshop monitoring
- **Comprehensive Security**: JWT authentication, rate limiting, audit logging, account lockout protection

**Base URL**: `https://your-domain.com/api`
**API Version**: v1
**Environment**: Node.js 20+ with Next.js 16

---

## Authentication

### Admin Authentication

All admin endpoints require JWT authentication via HTTP-only cookies.

#### Login Process

1. **POST** `/api/auth/login` with email/password
2. Receive JWT in `admin_session` HTTP-only cookie
3. JWT automatically included in subsequent requests

**JWT Claims**:
```json
{
  "sessionId": "string",
  "userId": "string",
  "email": "string",
  "role": "PLATFORM_ADMIN | TENANT_ADMIN",
  "organizationId": "string",
  "createdAt": number
}
```

**Token Expiry**: 24 hours
**Signature Algorithm**: HMAC-SHA256

#### User Roles

- **PLATFORM_ADMIN**: Full access across all organizations
- **TENANT_ADMIN**: Access limited to own organization's data

### Participant Authentication

Workshop participants authenticate using their `discoveryToken` (unique per participant).

**GDPR endpoints** (`/api/gdpr/*`) require:
- Participant email
- Workshop ID
- Discovery token (`authToken` parameter)

---

## Rate Limiting

Rate limits are enforced per IP address using a token bucket algorithm.

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Admin API | 60 requests | 1 minute |
| Auth API | 10 requests | 1 minute |
| GDPR Export | 5 requests | 15 minutes |
| GDPR Delete | 3 requests | 15 minutes |
| Conversation API | 30 requests | 1 minute |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
```

**Rate Limit Exceeded Response** (429):
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| 200 | Success | Request completed successfully |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Missing required fields, invalid input |
| 401 | Unauthorized | Invalid/missing authentication |
| 403 | Forbidden | Insufficient permissions, account locked |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

---

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/login

Authenticates an admin user and creates a session.

**Request**:
```json
{
  "email": "admin@example.com",
  "password": "securePassword123"
}
```

**Response** (200):
```json
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "PLATFORM_ADMIN",
    "organization": {
      "id": "org-123",
      "name": "Acme Corp"
    }
  }
}
```

**Security Features**:
- Account lockout after 5 failed attempts (15 minute duration)
- All login attempts logged
- Password hashing with bcrypt (10 rounds)
- HTTP-only, SameSite=Strict JWT cookies

**Error Responses**:
- 400: Missing email or password
- 401: Invalid credentials
- 403: Account locked or inactive
- 429: Rate limit exceeded

---

#### POST /api/auth/logout

Logs out the current user and invalidates their session.

**Request**: No body required (uses session cookie)

**Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### POST /api/auth/tenant-login

Similar to `/api/auth/login` but for tenant-specific login pages.

---

### Workshop Management

#### GET /api/admin/workshops

Lists all workshops for the authenticated user's organization.

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)
- `status` (optional): Filter by status (DRAFT, IN_PROGRESS, COMPLETED)

**Response** (200):
```json
{
  "workshops": [
    {
      "id": "workshop-123",
      "name": "Product Strategy Discovery",
      "description": "Strategic planning workshop",
      "businessContext": "Launching new product line",
      "workshopType": "STRATEGY",
      "status": "IN_PROGRESS",
      "organizationId": "org-123",
      "createdById": "user-123",
      "scheduledDate": "2024-02-01T10:00:00.000Z",
      "responseDeadline": "2024-02-15T17:00:00.000Z",
      "includeRegulation": true,
      "participantCount": 15,
      "completedResponses": 8,
      "createdAt": "2024-01-15T09:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasMore": true
  }
}
```

**Security**: TENANT_ADMIN sees only their organization's workshops

---

#### GET /api/admin/workshops/[id]

Retrieves complete workshop details including all participants.

**Response** (200):
```json
{
  "workshop": {
    "id": "workshop-123",
    "name": "Product Strategy Discovery",
    "description": "...",
    "businessContext": "...",
    "workshopType": "STRATEGY",
    "status": "IN_PROGRESS",
    "organizationId": "org-123",
    "participants": [
      {
        "id": "participant-1",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "role": "Product Manager",
        "department": "Product",
        "attributionPreference": "NAMED",
        "emailSentAt": "2024-01-16T10:00:00.000Z",
        "responseStartedAt": "2024-01-17T14:30:00.000Z",
        "responseCompletedAt": "2024-01-17T15:15:00.000Z",
        "createdAt": "2024-01-15T09:30:00.000Z"
      }
    ],
    "createdAt": "2024-01-15T09:00:00.000Z",
    "updatedAt": "2024-01-20T11:00:00.000Z"
  }
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Access denied (workshop belongs to different organization)
- 404: Workshop not found

---

#### POST /api/admin/workshops

Creates a new workshop.

**Request**:
```json
{
  "name": "Product Strategy Discovery",
  "description": "Strategic planning workshop for Q2",
  "businessContext": "Launching new product line in competitive market",
  "workshopType": "STRATEGY",
  "scheduledDate": "2024-02-01T10:00:00.000Z",
  "responseDeadline": "2024-02-15T17:00:00.000Z",
  "includeRegulation": true
}
```

**Response** (201):
```json
{
  "success": true,
  "workshop": {
    "id": "workshop-456",
    "name": "Product Strategy Discovery",
    "status": "DRAFT",
    "organizationId": "org-123",
    "createdById": "user-123",
    "createdAt": "2024-01-25T10:00:00.000Z"
  }
}
```

---

#### PATCH /api/admin/workshops/[id]

Updates workshop settings.

**Request**:
```json
{
  "includeRegulation": false,
  "status": "COMPLETED"
}
```

**Response** (200):
```json
{
  "success": true,
  "workshop": {
    "id": "workshop-123",
    "includeRegulation": false,
    "updatedAt": "2024-01-25T11:00:00.000Z"
  }
}
```

---

#### DELETE /api/admin/workshops/[id]

Permanently deletes a workshop and all associated data.

**WARNING**: This operation is irreversible. All participant data, conversations, insights, and reports will be permanently deleted.

**Response** (200):
```json
{
  "success": true,
  "message": "Workshop deleted successfully"
}
```

---

### GDPR Compliance Endpoints

#### POST /api/gdpr/export

Exports all personal data for a participant (GDPR Article 15 - Right to Access).

**Request**:
```json
{
  "email": "participant@example.com",
  "workshopId": "workshop-123",
  "authToken": "abc123discovery-token"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "participant": {
      "id": "participant-1",
      "email": "participant@example.com",
      "name": "Jane Smith",
      "role": "Engineer",
      "department": "Engineering",
      "attributionPreference": "NAMED",
      "createdAt": "2024-01-15T09:30:00.000Z"
    },
    "workshop": {
      "id": "workshop-123",
      "name": "Product Strategy Discovery",
      "description": "..."
    },
    "sessions": [...],
    "messages": [...],
    "dataPoints": [...],
    "insights": [...],
    "reports": [...],
    "consentRecords": [
      {
        "id": "consent-1",
        "consentTypes": ["DATA_COLLECTION", "AI_PROCESSING"],
        "consentVersion": "v1.0",
        "consentedAt": "2024-01-15T09:30:00.000Z",
        "withdrawnAt": null
      }
    ]
  },
  "metadata": {
    "exportedAt": "2024-01-25T12:00:00.000Z",
    "format": "GDPR_EXPORT_V1",
    "article": "Article 15 - Right to Access"
  }
}
```

**Rate Limit**: 5 requests per 15 minutes per participant

**Security**:
- Requires participant's discoveryToken
- All export attempts logged
- Sensitive fields (tokens, passwords) excluded

---

#### POST /api/gdpr/delete

Permanently deletes all personal data for a participant (GDPR Article 17 - Right to Erasure).

**Two-Step Process**:

**Step 1: Request Deletion** (no confirmationToken)

Request:
```json
{
  "email": "participant@example.com",
  "workshopId": "workshop-123",
  "authToken": "abc123discovery-token"
}
```

Response (200):
```json
{
  "success": true,
  "message": "Deletion request received. Use the confirmation token to complete deletion within 30 minutes.",
  "confirmationToken": "xyz789confirmation-token"
}
```

**Step 2: Confirm Deletion** (with confirmationToken)

Request:
```json
{
  "email": "participant@example.com",
  "workshopId": "workshop-123",
  "authToken": "abc123discovery-token",
  "confirmationToken": "xyz789confirmation-token"
}
```

Response (200):
```json
{
  "success": true,
  "message": "All personal data has been permanently deleted.",
  "deletedRecords": {
    "messages": 45,
    "insights": 12,
    "reports": 1,
    "dataPoints": 67,
    "classifications": 50,
    "annotations": 23,
    "sessions": 1,
    "consentRecords": 1,
    "participant": 1
  }
}
```

**Rate Limit**: 3 requests per 15 minutes per participant

**Security**:
- Two-step confirmation prevents accidental deletion
- Confirmation token expires after 30 minutes
- Audit trail preserved for legal compliance
- Cannot delete twice (idempotent)

**Data Deleted**:
1. All conversation messages
2. All AI-generated insights
3. All reports
4. All captured data points
5. All classifications and annotations
6. All session metadata
7. All consent records
8. Participant record

**Note**: Audit logs are preserved for legal compliance per GDPR Article 17(3).

---

### Conversation API

#### POST /api/conversation/init

Initializes a new conversation session for a participant.

**Request**:
```json
{
  "participantId": "participant-1",
  "workshopId": "workshop-123",
  "language": "en",
  "voiceEnabled": false
}
```

**Response** (200):
```json
{
  "success": true,
  "sessionId": "session-456",
  "currentPhase": "introduction",
  "firstMessage": "Welcome to the discovery session. Let's begin by discussing..."
}
```

---

#### POST /api/conversation/message

Sends a message in an active conversation session.

**Request**:
```json
{
  "sessionId": "session-456",
  "message": "Our main challenge is coordinating across distributed teams",
  "metadata": {
    "source": "text"
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "response": "I understand. Can you tell me more about the specific coordination challenges?",
  "phaseProgress": 45,
  "insights": [
    {
      "type": "CHALLENGE",
      "content": "Distributed team coordination",
      "confidence": 0.89
    }
  ]
}
```

---

### Live Workshop

#### GET /api/live/hemisphere/[workshopId]

Retrieves real-time hemisphere visualization data for a live workshop.

**Response** (200):
```json
{
  "nodes": [
    {
      "id": "node-1",
      "label": "Distributed coordination",
      "type": "CHALLENGE",
      "x": 150,
      "y": 200,
      "createdAt": "2024-01-25T14:30:00.000Z"
    }
  ],
  "links": [
    {
      "source": "node-1",
      "target": "node-2",
      "type": "RELATES_TO",
      "strength": 0.75
    }
  ],
  "stats": {
    "totalNodes": 45,
    "totalLinks": 78,
    "activeParticipants": 8
  }
}
```

---

## Security Best Practices

### For API Consumers

1. **Store JWTs Securely**: Never store JWTs in localStorage. Use HTTP-only cookies (handled automatically by the API).

2. **Validate Input**: Always validate and sanitize user input before sending to the API.

3. **Handle Rate Limits**: Implement exponential backoff when receiving 429 responses.

4. **Protect Discovery Tokens**: Participant discovery tokens are sensitive. Only transmit over HTTPS.

5. **GDPR Compliance**:
   - Always obtain explicit consent before collecting data
   - Honor deletion requests within 30 days
   - Provide data exports within 30 days

6. **Monitor Audit Logs**: Regularly review audit logs for suspicious activity.

### For Platform Administrators

1. **SESSION_SECRET**: Store in environment variable, never commit to version control. Rotate regularly (every 90 days).

2. **Database Backups**: Ensure daily backups with 30-day retention for GDPR compliance.

3. **SSL/TLS**: Always use HTTPS in production. HTTP is only acceptable for local development.

4. **Rate Limiting**: Monitor rate limit violations. Adjust limits if legitimate users are being blocked.

5. **Account Lockout**: Review locked accounts regularly. Provide self-service unlock mechanism.

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- __tests__/unit/encryption.test.ts

# Run in watch mode
npm test -- --watch
```

### Test Coverage Goals

- **Unit Tests**: 100% coverage on security-critical functions (encryption, consent, audit)
- **Integration Tests**: 80% coverage on API routes
- **E2E Tests**: Coverage of critical user journeys

### Test Environment

Tests use a separate test database to avoid affecting production/development data:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/dream_test"
```

---

## Additional Resources

- **Quickstart Guide**: See `/QUICKSTART.md` for local development setup
- **Security Implementation**: See `/docs/SECURITY.md` for detailed security architecture
- **GDPR Compliance**: See `/docs/GDPR_COMPLIANCE.md` for legal requirements
- **Contributing Guide**: See `/CONTRIBUTING.md` for development workflows

---

## API Versioning

The API currently uses implicit versioning (v1). Future versions will use URL-based versioning:

- Current: `/api/auth/login`
- Future v2: `/api/v2/auth/login`

Breaking changes will be announced 90 days in advance with a deprecation schedule.

---

## Support

For API support:
- **Documentation Issues**: Open a GitHub issue
- **Security Vulnerabilities**: Email security@your-domain.com (do not open public issues)
- **Feature Requests**: Open a GitHub discussion

---

**Last Updated**: 2024-01-25
**API Version**: v1.0
**Document Version**: 1.0
