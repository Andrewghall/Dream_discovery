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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let emailsSent = 0;
    const errors = [];

    console.log(`📧 Sending emails to ${workshop.participants.length} participant(s)...`);
    console.log(`📧 Workshop: ${workshop.name} (${workshopId})`);
    console.log(`📧 Resend mode: ${resendAll ? 'YES' : 'NO'}`);

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

        // Mark email as sent
        await prisma.workshopParticipant.update({
          where: { id: participant.id },
          data: { emailSentAt: new Date() },
        });

        emailsSent++;
      } catch (error) {
        console.error(`   - ❌ Failed to send email to ${participant.email}:`, error);
        errors.push({ email: participant.email, error: String(error) });
      }
    }
    
    console.log(`\n📧 Summary: ${emailsSent} emails sent, ${errors.length} errors`);

    // Update workshop status
    await prisma.workshop.update({
      where: { id: workshopId },
      data: {
        status: 'DISCOVERY_SENT',
      },
    });

    return NextResponse.json({
      success: true,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error sending invitations:', error);
    return NextResponse.json(
      { error: 'Failed to send invitations' },
      { status: 500 }
    );
  }
}
