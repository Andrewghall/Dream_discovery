import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: ['delivered@resend.dev'], // Resend test email that always works
      subject: 'DREAM Discovery - Email System Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">✅ Email System Working!</h1>
          <p>This is a test email from DREAM Discovery Platform.</p>
          <p>If you're seeing this, your Resend integration is configured correctly.</p>
          <hr style="border: 1px solid #E5E7EB; margin: 20px 0;" />
          <p style="color: #6B7280; font-size: 14px;">
            Sent from DREAM Discovery Platform<br />
            Powered by ${process.env.PLATFORM_NAME || 'DREAM Discovery'}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      emailId: data?.id,
    });
  } catch (error: any) {
    console.error('Email test error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
