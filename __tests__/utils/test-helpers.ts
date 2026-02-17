/**
 * Test Helper Functions
 * Utility functions for common test operations
 */

import { mockUser, mockOrganization, mockWorkshop, mockSessionPayload } from './test-fixtures';
import * as bcrypt from 'bcryptjs';

/**
 * Create a valid bcrypt hash for testing
 */
export async function createPasswordHash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Create a mock authenticated user context
 */
export function createMockAuthContext(overrides?: Partial<typeof mockUser>) {
  return {
    ...mockUser,
    ...overrides,
  };
}

/**
 * Create a mock JWT session payload
 */
export function createMockSessionPayload(overrides?: Partial<typeof mockSessionPayload>) {
  return {
    ...mockSessionPayload,
    ...overrides,
  };
}

/**
 * Create a mock workshop with organization
 */
export function createMockWorkshopContext(
  workshopOverrides?: Partial<typeof mockWorkshop>,
  orgOverrides?: Partial<typeof mockOrganization>
) {
  return {
    workshop: {
      ...mockWorkshop,
      ...workshopOverrides,
    },
    organization: {
      ...mockOrganization,
      ...orgOverrides,
    },
  };
}

/**
 * Wait for async operations to complete
 */
export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create mock NextRequest
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  body?: any;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  searchParams?: Record<string, string>;
}) {
  const url = new URL(options.url || 'http://localhost:3001/api/test');

  // Add search params if provided
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const mockRequest = {
    method: options.method || 'GET',
    url: url.toString(),
    nextUrl: url,
    json: async () => options.body || {},
    headers: new Map(Object.entries(options.headers || {})),
    cookies: {
      get: (name: string) => {
        const value = options.cookies?.[name];
        return value ? { name, value } : undefined;
      },
    },
    ip: '127.0.0.1',
  };

  return mockRequest as any;
}

/**
 * Extract JSON from NextResponse
 */
export async function getResponseJSON(response: any) {
  if (!response || !response.json) {
    throw new Error('Invalid response object');
  }
  return response.json();
}

/**
 * Get response status
 */
export function getResponseStatus(response: any): number {
  return response.status || 200;
}
