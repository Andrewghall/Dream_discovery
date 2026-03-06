import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { sendPasswordReset } from '@/lib/email/send';
import crypto from 'crypto';
import { authLimiter } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Rate limit: 3 requests per 15 minutes per email
    const rl = await authLimiter.check(3, `reset:${email.toLowerCase().trim()}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success (don't reveal if user exists)
    // This prevents email enumeration attacks
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If that email exists, a password reset link has been sent.',
      });
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in database
    await prisma.passwordResetToken.create({
      data: {
        id: nanoid(),
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send reset email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`}/reset-password?token=${token}`;

    try {
      await sendPasswordReset({
        to: user.email,
        userName: user.name,
        resetUrl,
        expiresIn: '1 hour',
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't reveal email failure to user
    }

    return NextResponse.json({
      success: true,
      message: 'If that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
