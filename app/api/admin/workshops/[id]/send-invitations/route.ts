import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDiscoveryInvitation } from '@/lib/email/send-invitation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const url = new URL(request.url);
    const resendAll = url.searchParams.get('resend') === 'true';

    const diagnostics = {
      nodeEnv: process.env.NODE_ENV ?? null,
      hasResendApiKey: !!process.env.RESEND_API_KEY,
      fromEmail: process.env.FROM_EMAIL ?? null,
      nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
      vercelUrl: process.env.VERCEL_URL ?? null,
      requestHost: request.headers.get('host') ?? null,
    };

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: 'Email sending is not configured',
          details: { message: 'Missing RESEND_API_KEY environment variable' },
          diagnostics,
        },
        { status: 500 }
      );
    }

    // Get workshop and participants
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      include: {
        participants: resendAll ? true : {
          where: {
            emailSentAt: null, // Only send to those who haven't received email yet
          },
        },
      },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (workshop.participants.length === 0) {
      return NextResponse.json({
        success: true,
        emailsSent: 0,
        message: resendAll ? 'No participants found' : 'All participants have already received invitations. Use ?resend=true to resend.',
      });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    let emailsSent = 0;
    const errors = [];
    const results: Array<{ email: string; ok: boolean; resendId?: string | null; error?: string }> = [];

    console.log(`📧 Sending emails to ${workshop.participants.length} participant(s)...`);
    console.log(`📧 Workshop: ${workshop.name} (${workshopId})`);
    console.log(`📧 Resend mode: ${resendAll ? 'YES' : 'NO'}`);
    console.log('📧 Diagnostics:', diagnostics);

    // Send emails to each participant
    for (const participant of workshop.participants) {
      try {
        console.log(`\n📧 Processing participant: ${participant.name} (${participant.email})`);
        console.log(`   - Email sent before: ${participant.emailSentAt ? 'YES' : 'NO'}`);
        
        const discoveryUrl = `${appUrl}/discovery/${workshopId}/${participant.discoveryToken}`;
        console.log(`   - Discovery URL: ${discoveryUrl}`);
        
        console.log(`   - Calling Resend API...`);
        const emailResult = await sendDiscoveryInvitation({
          to: participant.email,
          participantName: participant.name,
          workshopName: workshop.name,
          workshopDescription: workshop.description || undefined,
          discoveryUrl,
          responseDeadline: workshop.responseDeadline || undefined,
        });

        console.log(`   - ✅ Email sent! Result:`, emailResult);

        const maybeResult = emailResult as any;
        const resendId =
          maybeResult?.data?.id ??
          maybeResult?.id ??
          maybeResult?.data?.messageId ??
          maybeResult?.messageId ??
          null;

        // Mark email as sent
        await prisma.workshopParticipant.update({
          where: { id: participant.id },
          data: { emailSentAt: new Date() },
        });

        emailsSent++;
        results.push({ email: participant.email, ok: true, resendId });
      } catch (error: unknown) {
        console.error(`   - ❌ Failed to send email to ${participant.email}:`, error);
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : JSON.stringify(error);
        errors.push({ email: participant.email, error: message });
        results.push({ email: participant.email, ok: false, error: message });
      }
    }
    
    console.log(`\n📧 Summary: ${emailsSent} emails sent, ${errors.length} errors`);

    if (emailsSent > 0) {
      // Update workshop status
      await prisma.workshop.update({
        where: { id: workshopId },
        data: {
          status: 'DISCOVERY_SENT',
        },
      });
    }

    return NextResponse.json({
      success: errors.length === 0,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
      diagnostics: {
        ...diagnostics,
        appUrl,
        resendAll,
        participantsConsidered: workshop.participants.length,
      },
      results,
    });
  } catch (error) {
    console.error('Error sending invitations:', error);
    return NextResponse.json(
      {
        error: 'Failed to send invitations',
        details: {
          message: error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
