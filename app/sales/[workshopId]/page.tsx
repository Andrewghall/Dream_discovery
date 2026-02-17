import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Mic, ClipboardList, Target, Calendar } from 'lucide-react';
import { getSession } from '@/lib/auth/session';

export default async function SalesOverviewPage({ params }: { params: Promise<{ workshopId: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { workshopId } = await params;

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      name: true,
      status: true,
      workshopType: true,
      meetingPlan: true,
      salesReport: true,
      salesActions: true,
      organizationId: true,
      createdAt: true,
      _count: { select: { transcriptChunks: true } },
    },
  });

  if (!workshop) redirect('/admin');
  if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
    redirect('/admin');
  }

  const plan = (workshop.meetingPlan as Record<string, unknown>) || {};
  const report = workshop.salesReport as Record<string, unknown> | null;
  const actions = (workshop.salesActions as Array<Record<string, unknown>>) || [];
  const hasPlan = Object.keys(plan).length > 0;
  const hasReport = !!report;
  const hasTranscript = workshop._count.transcriptChunks > 0;

  const meetingSummary = report?.meetingSummary as Record<string, string> | undefined;

  // Determine back link based on role
  const backLink = session.role === 'PLATFORM_ADMIN' ? '/admin' : '/tenant/dashboard';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href={backLink}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{workshop.name}</h1>
                <Badge variant="outline">Sales Call</Badge>
                <Badge variant={workshop.status === 'COMPLETED' ? 'default' : 'secondary'}>
                  {workshop.status.toLowerCase().replace('_', ' ')}
                </Badge>
              </div>
              {meetingSummary?.customerName && (
                <p className="text-sm text-muted-foreground mt-1">
                  {meetingSummary.customerName} — {meetingSummary.opportunityName || ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <Calendar className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">
                {workshop.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <p className="text-xs text-muted-foreground">Date</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Mic className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">{workshop._count.transcriptChunks} segments</div>
              <p className="text-xs text-muted-foreground">Transcript</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <ClipboardList className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">{actions.length} actions</div>
              <p className="text-xs text-muted-foreground">Follow-Ups</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Target className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">
                {(report as Record<string, unknown>)?.opportunityAssessment
                  ? ((report as Record<string, unknown>).opportunityAssessment as Record<string, string>).dealHealth
                  : 'Pending'}
              </div>
              <p className="text-xs text-muted-foreground">Deal Health</p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Meeting Plan */}
          <Link href={`/sales/${workshopId}/plan`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  Meeting Plan
                </CardTitle>
                <CardDescription>
                  {hasPlan
                    ? `Plan for ${(plan.customerName as string) || 'this meeting'} — ${(plan.dealStage as string) || 'stage not set'}`
                    : 'No plan created yet — click to create one'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant={hasPlan ? 'outline' : 'default'} size="sm">
                  {hasPlan ? 'View Plan' : 'Create Plan'}
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Live Session */}
          <Link href={`/sales/${workshopId}/live`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-red-500" />
                  Live Call
                </CardTitle>
                <CardDescription>
                  {hasTranscript
                    ? `${workshop._count.transcriptChunks} transcript segments captured`
                    : 'Start or resume a live call recording'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant={hasTranscript ? 'outline' : 'default'} size="sm">
                  {workshop.status === 'COMPLETED' ? 'View Session' : hasTranscript ? 'Resume Call' : 'Start Call'}
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Report */}
          <Link href={`/sales/${workshopId}/report`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-500" />
                  Call Report
                </CardTitle>
                <CardDescription>
                  {hasReport
                    ? 'Full analysis with deal assessment and insights'
                    : 'Generate a report from the call transcript'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant={hasReport ? 'outline' : 'default'} size="sm">
                  {hasReport ? 'View Report' : 'Generate Report'}
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Actions */}
          <Link href={`/sales/${workshopId}/actions`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-green-500" />
                  Actions & Follow-Up
                </CardTitle>
                <CardDescription>
                  {actions.length > 0
                    ? `${actions.length} actions with owners and deadlines`
                    : 'Actions will be generated with the report'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant={actions.length > 0 ? 'outline' : 'secondary'} size="sm" disabled={actions.length === 0}>
                  {actions.length > 0 ? 'View Actions' : 'Pending Report'}
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
