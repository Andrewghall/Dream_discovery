'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, MessageSquare, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ConversationReport, PhaseInsight } from '@/components/report/conversation-report';

interface Workshop {
  id: string;
  name: string;
  workshopType: string;
  status: string;
  scheduledDate: string | null;
  participantCount: number;
  completedResponses: number;
}

export default function AdminDashboard() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoReport, setDemoReport] = useState<null | {
    executiveSummary: string;
    tone: string | null;
    feedback: string;
    inputQuality?: {
      score: number;
      label: 'high' | 'medium' | 'low';
      rationale: string;
      missingInfoSuggestions: string[];
    };
    keyInsights?: Array<{
      title: string;
      insight: string;
      confidence: 'high' | 'medium' | 'low';
      evidence: string[];
    }>;
    phaseInsights: PhaseInsight[];
    wordCloudThemes: Array<{ text: string; value: number }>;
  }>(null);
  const [demoReportLoading, setDemoReportLoading] = useState(false);

  useEffect(() => {
    fetchWorkshops();
  }, []);

  const fetchWorkshops = async () => {
    try {
      const response = await fetch(`/api/admin/workshops?bust=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setWorkshops(data.workshops || []);
      }
    } catch (error) {
      console.error('Failed to fetch workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDemoReport = async () => {
    setDemoReportLoading(true);
    try {
      const r = await fetch('/api/conversation/report?demo=1&includeRegulation=1', { cache: 'no-store' });
      if (!r.ok) return;
      const reportData = await r.json();
      setDemoReport({
        executiveSummary: reportData.executiveSummary,
        tone: reportData.tone,
        feedback: reportData.feedback,
        inputQuality: reportData.inputQuality,
        keyInsights: reportData.keyInsights,
        phaseInsights: reportData.phaseInsights,
        wordCloudThemes: reportData.wordCloudThemes,
      });
    } catch {
      // ignore
    } finally {
      setDemoReportLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500';
      case 'IN_PROGRESS':
        return 'bg-blue-500';
      case 'DISCOVERY_SENT':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not scheduled';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="no-print flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/ethenta-logo.png" alt="Ethenta" width={128} height={37} priority />
              <h1 className="text-3xl font-bold tracking-tight">DREAM Discovery</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Manage workshops and discovery conversations
            </p>
          </div>
          <Link href="/admin/workshops/new">
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              New Workshop
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="no-print grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Workshops</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workshops.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {workshops.filter((w) => w.status === 'IN_PROGRESS').length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workshops.reduce((sum, w) => sum + w.participantCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {workshops.reduce((sum, w) => sum + w.completedResponses, 0)} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workshops.reduce((sum, w) => sum + w.participantCount, 0) > 0
                  ? Math.round(
                      (workshops.reduce((sum, w) => sum + w.completedResponses, 0) /
                        workshops.reduce((sum, w) => sum + w.participantCount, 0)) *
                        100
                    )
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground mt-1">Across all workshops</p>
            </CardContent>
          </Card>
        </div>

        {/* Workshops List */}
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Workshops</CardTitle>
            <CardDescription>View and manage your discovery workshops</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading workshops...</div>
            ) : workshops.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No workshops yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first workshop to start gathering insights
                </p>
                <Link href="/admin/workshops/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workshop
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {workshops.map((workshop) => (
                  <Link
                    key={workshop.id}
                    href={`/admin/workshops/${workshop.id}`}
                    className="block"
                  >
                    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{workshop.name}</h3>
                            <Badge variant="outline" className="capitalize">
                              {workshop.workshopType.toLowerCase()}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${getStatusColor(
                                  workshop.status
                                )}`}
                              />
                              <span className="text-sm text-muted-foreground capitalize">
                                {workshop.status.toLowerCase().replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <span>📅 {formatDate(workshop.scheduledDate)}</span>
                            <span>
                              👥 {workshop.completedResponses}/{workshop.participantCount}{' '}
                              completed
                            </span>
                            <span>
                              {workshop.participantCount > 0
                                ? Math.round(
                                    (workshop.completedResponses / workshop.participantCount) *
                                      100
                                  )
                                : 0}
                              % completion
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View →
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Example Report</CardTitle>
                <CardDescription>Preview a sample report (demo data) from the report generator</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {!demoReport && (
                  <Button variant="outline" onClick={fetchDemoReport} disabled={demoReportLoading}>
                    {demoReportLoading ? 'Loading…' : 'Preview Example Report'}
                  </Button>
                )}
                {demoReport && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDemoReport(null);
                    }}
                  >
                    Hide Example Report
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {demoReport ? (
              <ConversationReport
                executiveSummary={demoReport.executiveSummary}
                tone={demoReport.tone}
                feedback={demoReport.feedback}
                inputQuality={demoReport.inputQuality}
                keyInsights={demoReport.keyInsights}
                phaseInsights={demoReport.phaseInsights}
                wordCloudThemes={demoReport.wordCloudThemes}
              />
            ) : (
              <div className="text-sm text-muted-foreground">Click “Preview Example Report” to load a demo report.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
