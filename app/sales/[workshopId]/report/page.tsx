'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, FileText, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface SalesReport {
  meetingSummary: {
    customerName: string;
    opportunityName: string;
    date: string;
    duration: string;
    speakers: string[];
    dealStage: string;
  };
  keyDiscussionPoints: Array<{ topic: string; summary: string; category: string }>;
  customerNeeds: Array<{ need: string; evidence: string; priority: string }>;
  solutionsDiscussed: Array<{ solution: string; customerReaction: string }>;
  objectionsAndConcerns: Array<{ objection: string; howHandled: string; resolved: boolean }>;
  opportunityAssessment: { dealHealth: string; reasoning: string; confidenceScore: number };
  actions: Array<{ action: string; owner: string; deadline: string; priority: string; source: string }>;
  decisionTimeline: string;
  competitiveIntelligence: Array<{ competitor: string; context: string }>;
  toneAnalysis: { overallTone: string; keyShifts: Array<{ moment: string; fromTone: string; toTone: string }> };
  coachingNotes: string[];
  planVsActual: {
    objectivesCovered: Array<{ objective: string; covered: boolean; evidence?: string }>;
    questionsCovered: Array<{ question: string; asked: boolean; answer?: string }>;
    unexpectedTopics: string[];
    missedItems: string[];
  };
}

export default function SalesReportPage() {
  const params = useParams();
  const router = useRouter();
  const workshopId = params.workshopId as string;

  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/sales/${workshopId}/report`)
      .then((r) => r.json())
      .then((data) => {
        if (data.report) {
          setReport(data.report);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [workshopId]);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/sales/${workshopId}/report`, { method: 'POST' });
      const data = await res.json();
      if (data.report) {
        setReport(data.report);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const getDealHealthColor = (health: string) => {
    switch (health) {
      case 'Hot': return 'bg-green-500 text-white';
      case 'Warm': return 'bg-yellow-500 text-black';
      case 'Cool': return 'bg-blue-500 text-white';
      case 'Cold': return 'bg-gray-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container max-w-3xl mx-auto px-4 py-16 text-center">
          <FileText className="h-16 w-16 mx-auto mb-6 text-gray-300" />
          <h1 className="text-2xl font-bold mb-4">Generate Sales Report</h1>
          <p className="text-gray-500 mb-8">Analyze the call transcript and generate your structured sales report</p>
          <Button onClick={generateReport} disabled={generating} size="lg">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href={`/sales/${workshopId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Overview
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Sales Call Report</h1>
              <p className="text-sm text-muted-foreground">
                {report.meetingSummary.customerName} — {report.meetingSummary.opportunityName}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={generateReport} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => router.push(`/sales/${workshopId}/actions`)}>
              Actions & Follow-Up
            </Button>
            <Button variant="outline" onClick={() => window.open(`/api/sales/${workshopId}/report/pdf`, '_blank')}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Meeting Summary + Deal Health */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Meeting Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Customer:</span> <strong>{report.meetingSummary.customerName}</strong></div>
              <div><span className="text-muted-foreground">Opportunity:</span> <strong>{report.meetingSummary.opportunityName}</strong></div>
              <div><span className="text-muted-foreground">Date:</span> {report.meetingSummary.date}</div>
              <div><span className="text-muted-foreground">Duration:</span> {report.meetingSummary.duration}</div>
              <div><span className="text-muted-foreground">Deal Stage:</span> {report.meetingSummary.dealStage}</div>
              <div><span className="text-muted-foreground">Speakers:</span> {report.meetingSummary.speakers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Deal Health</CardTitle></CardHeader>
            <CardContent className="text-center">
              <Badge className={`text-2xl px-6 py-2 ${getDealHealthColor(report.opportunityAssessment.dealHealth)}`}>
                {report.opportunityAssessment.dealHealth}
              </Badge>
              <p className="text-sm text-muted-foreground mt-3">{report.opportunityAssessment.reasoning}</p>
              <p className="text-xs text-muted-foreground mt-1">Confidence: {report.opportunityAssessment.confidenceScore}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Key Discussion Points */}
        <Card className="mb-6">
          <CardHeader><CardTitle>Key Discussion Points</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.keyDiscussionPoints.map((point, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <Badge variant="outline" className="text-xs flex-shrink-0">{point.category}</Badge>
                  <div>
                    <p className="font-medium text-sm">{point.topic}</p>
                    <p className="text-sm text-muted-foreground">{point.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Customer Needs */}
        <Card className="mb-6">
          <CardHeader><CardTitle>Customer Needs & Pain Points</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.customerNeeds.map((need, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={need.priority === 'high' ? 'destructive' : 'outline'} className="text-xs">
                      {need.priority}
                    </Badge>
                    <span className="font-medium text-sm">{need.need}</span>
                  </div>
                  <p className="text-sm text-muted-foreground italic">&quot;{need.evidence}&quot;</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Solutions + Objections side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><CardTitle>Solutions Discussed</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {report.solutionsDiscussed.map((sol, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <p className="font-medium text-sm">{sol.solution}</p>
                  <p className="text-sm text-muted-foreground">{sol.customerReaction}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Objections & Concerns</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {report.objectionsAndConcerns.map((obj, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    {obj.resolved ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium text-sm">{obj.objection}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{obj.howHandled}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Actions Preview */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Actions & Next Steps</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push(`/sales/${workshopId}/actions`)}>
              Full Actions View
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium">Owner</th>
                    <th className="pb-2 font-medium">Deadline</th>
                    <th className="pb-2 font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {report.actions.map((action, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{action.action}</td>
                      <td className="py-2">{action.owner}</td>
                      <td className="py-2">{action.deadline}</td>
                      <td className="py-2">
                        <Badge variant={action.priority === 'Critical' ? 'destructive' : 'outline'} className="text-xs">
                          {action.priority}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Decision Timeline */}
        <Card className="mb-6">
          <CardHeader><CardTitle>Decision Timeline</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{report.decisionTimeline}</p>
          </CardContent>
        </Card>

        {/* Competitive Intelligence */}
        {report.competitiveIntelligence.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Competitive Intelligence</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {report.competitiveIntelligence.map((ci, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <Badge variant="outline" className="text-xs flex-shrink-0">{ci.competitor}</Badge>
                  <p className="text-sm text-muted-foreground">{ci.context}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Plan vs Actual */}
        <Card className="mb-6">
          <CardHeader><CardTitle>Plan vs. Actual</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {report.planVsActual.objectivesCovered.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Objectives</h4>
                <div className="space-y-1">
                  {report.planVsActual.objectivesCovered.map((obj, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {obj.covered ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={obj.covered ? '' : 'text-red-600'}>{obj.objective}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {report.planVsActual.missedItems.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-red-600">Missed Items</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {report.planVsActual.missedItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.planVsActual.unexpectedTopics.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Unexpected Topics</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {report.planVsActual.unexpectedTopics.map((topic, i) => (
                    <li key={i}>{topic}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coaching Notes */}
        {report.coachingNotes.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Coaching Notes</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {report.coachingNotes.map((note, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-amber-500">*</span>
                    {note}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
