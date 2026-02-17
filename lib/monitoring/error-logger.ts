/**
 * Error logging utility for monitoring system errors
 */

import { sendSystemErrorAlert } from './alerts';

interface ErrorLog {
  path: string;
  method: string;
  statusCode: number;
  error: string;
  userId?: string;
  userEmail?: string;
}

/**
 * Log error to database and send alert for critical errors
 */
export async function logError(errorData: ErrorLog) {
  try {
    const { prisma } = await import('@/lib/prisma');

    // Log to audit_logs table
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: 'system',
        userId: errorData.userId || null,
        action: 'SYSTEM_ERROR',
        resourceType: 'error',
        resourceId: errorData.path,
        method: errorData.method,
        path: errorData.path,
        ipAddress: 'server',
        userAgent: 'system',
        metadata: {
          statusCode: errorData.statusCode,
          error: errorData.error,
          userEmail: errorData.userEmail,
        },
      },
    });

    // Send alert for 500 errors
    if (errorData.statusCode >= 500) {
      await sendSystemErrorAlert({
        path: errorData.path,
        method: errorData.method,
        statusCode: errorData.statusCode,
        error: errorData.error,
        userId: errorData.userId,
        timestamp: new Date(),
      });
    }
  } catch (logError) {
    // Don't throw - just log to console if error logging fails
    console.error('Failed to log error:', logError);
  }
}

/**
 * Wrapper to catch and log errors in API routes
 */
export function withErrorLogging<T>(
  handler: (req: Request, ...args: any[]) => Promise<Response>,
  routePath: string
) {
  return async (req: Request, ...args: any[]): Promise<Response> => {
    try {
      const response = await handler(req, ...args);

      // Log 500 errors
      if (response.status >= 500) {
        const errorBody = await response.clone().text();
        await logError({
          path: routePath,
          method: req.method,
          statusCode: response.status,
          error: errorBody || 'Internal Server Error',
        });
      }

      return response;
    } catch (error) {
      // Log uncaught errors
      await logError({
        path: routePath,
        method: req.method,
        statusCode: 500,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Re-throw the error
      throw error;
    }
  };
}
