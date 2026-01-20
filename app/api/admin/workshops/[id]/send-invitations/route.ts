import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDiscoveryInvitation } from '@/lib/email/send-invitation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const resend = request.nextUrl.searchParams.get('resend') === 'true';

    const diagnostics = {
      nodeEnv: process.env.NODE_ENV ?? null,
      hasResendApiKey: !!process.env.RESEND_API_KEY,
      fromEmail: process.env.FROM_EMAIL ?? null,
      nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
      vercelUrl: process.env.VERCEL_URL ?? null,
      requestHost: request.headers.get('host') ?? null,
    };

    // Get workshop and participants
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      include: {
        participants: true,
      },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (workshop.participants.length === 0) {
      return NextResponse.json({
        success: true,
        emailsSent: 0,
        message: 'No participants found',
      });
    }

    const eligibleParticipants = workshop.participants.filter(
      (p) => !(p as { doNotSendAgain?: boolean | null }).doNotSendAgain
    );

    const participantsToSend = resend
      ? eligibleParticipants
      : eligibleParticipants.filter((p: { emailSentAt: Date | null }) => !p.emailSentAt);

    if (participantsToSend.length === 0) {
      return NextResponse.json({
        success: true,
        emailsSent: 0,
        message: 'All participants have already been sent an invitation. Use Clear Email Status if you need to resend.',
        diagnostics: {
          ...diagnostics,
          participantsConsidered: workshop.participants.length,
          participantsEligible: eligibleParticipants.length,
          participantsToSend: 0,
          resend,
        },
        results: [],
      });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    let emailsSent = 0;
    const results: Array<{ email: string; ok: boolean; resendId?: string | null; error?: string }> = [];

    console.log(`📧 Sending emails to ${participantsToSend.length} participant(s)...`);
    console.log(`📧 Workshop: ${workshop.name} (${workshopId})`);
    console.log('📧 Diagnostics:', diagnostics);

    // Send emails to each participant
    for (const participant of participantsToSend) {
      console.log(`\n📧 Processing participant: ${participant.name} (${participant.email})`);
      console.log(`   - Email sent before: ${participant.emailSentAt ? 'YES' : 'NO'}`);

      const discoveryUrl = `${appUrl}/discovery/${workshopId}/${participant.discoveryToken}`;
      console.log(`   - Discovery URL: ${discoveryUrl}`);

      console.log(`   - Calling Resend API...`);
      try {
        const emailResult = await sendDiscoveryInvitation({
          to: participant.email,
          participantName: participant.name,
          workshopName: workshop.name,
          workshopDescription: workshop.description || undefined,
          discoveryUrl,
          responseDeadline: workshop.responseDeadline || undefined,
        });

        console.log(`   - ✅ Email sent! Result:`, emailResult);

        const maybeResult: unknown = emailResult;
        const obj =
          maybeResult && typeof maybeResult === 'object' && !Array.isArray(maybeResult)
            ? (maybeResult as Record<string, unknown>)
            : null;
        const data = obj && obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data) ? (obj.data as Record<string, unknown>) : null;
        const resendId =
          (data && typeof data.id === 'string' ? data.id : null) ??
          (obj && typeof obj.id === 'string' ? obj.id : null) ??
          (data && typeof data.messageId === 'string' ? data.messageId : null) ??
          (obj && typeof obj.messageId === 'string' ? obj.messageId : null);

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
        results.push({ email: participant.email, ok: false, error: message });
        throw new Error(`Failed to send email to ${participant.email}: ${message}`);
      }
    }
    
    console.log(`\n📧 Summary: ${emailsSent} emails sent, 0 errors`);

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
      success: true,
      emailsSent,
      diagnostics: {
        ...diagnostics,
        appUrl,
        participantsConsidered: workshop.participants.length,
        participantsEligible: eligibleParticipants.length,
        participantsToSend: participantsToSend.length,
        resend,
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
