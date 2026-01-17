import { NextRequest, NextResponse } from 'next/server';
import { generateDiscoveryReportPdf } from '@/lib/pdf/discovery-report';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      participantName: string;
      workshopName?: string | null;
      discoveryUrl: string;
      executiveSummary: string;
      tone?: string | null;
      feedback: string;
      inputQuality?: {
        score: number;
        label: 'high' | 'medium' | 'low';
        rationale: string;
      };
      keyInsights?: Array<{
        title: string;
        insight: string;
        confidence: 'high' | 'medium' | 'low';
        evidence: string[];
      }>;
      phaseInsights: Array<{
        phase: string;
        currentScore: number | null;
        targetScore: number | null;
        projectedScore: number | null;
      }>;
    };

    if (!body?.participantName || !body?.discoveryUrl || !body?.executiveSummary || !body?.feedback) {
      return NextResponse.json({ error: 'Missing required report fields.' }, { status: 400 });
    }

    const pdf = await generateDiscoveryReportPdf({
      participantName: body.participantName,
      workshopName: body.workshopName,
      discoveryUrl: body.discoveryUrl,
      executiveSummary: body.executiveSummary,
      tone: body.tone ?? null,
      feedback: body.feedback,
      inputQuality: body.inputQuality,
      keyInsights: body.keyInsights,
      phaseInsights: body.phaseInsights,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="DREAM-Discovery-Summary-Report.pdf"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('Failed to build report PDF:', error);
    return NextResponse.json({ error: 'Failed to generate report PDF' }, { status: 500 });
  }
}
