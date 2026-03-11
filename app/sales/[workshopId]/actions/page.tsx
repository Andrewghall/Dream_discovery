'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Mail, Copy, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Action {
  action: string;
  owner: string;
  deadline: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  source: string;
  status?: string;
  notes?: string;
}

interface SalesReport {
  meetingSummary: { customerName: string; opportunityName: string; date: string };
  actions: Action[];
  decisionTimeline: string;
}

export default function ActionsPage() {
  const params = useParams();
  const workshopId = params.workshopId as string;

  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailDraft, setEmailDraft] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateEmailDraft = (report: SalesReport) => {
    const actions = report.actions || [];
    const actionLines = actions
      .map((a, i) => `${i + 1}. ${a.action} (Owner: ${a.owner}, By: ${a.deadline})`)
      .join('\n');

    setEmailDraft(
      `Hi,\n\nThank you for taking the time to meet today. Here's a summary of what we discussed and the agreed next steps:\n\n` +
      `Actions & Next Steps:\n${actionLines}\n\n` +
      `Decision Timeline: ${report.decisionTimeline}\n\n` +
      `Please let me know if I've missed anything or if you have any questions.\n\nBest regards`
    );
  };

  useEffect(() => {
    fetch(`/api/sales/${workshopId}/report`)
      .then((r) => r.json())
      .then((data) => {
        if (data.report) {
          setReport(data.report);
          generateEmailDraft(data.report);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-500 text-white';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-yellow-500 text-black';
      case 'Low': return 'bg-gray-400 text-white';
      default: return 'bg-gray-300';
    }
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full" /></div>;
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No report generated yet. Generate the report first.</p>
      </div>
    );
  }

  const actions = report.actions || [];
  const ourActions = actions.filter((a) => a.owner.toLowerCase().startsWith('us'));
  const theirActions = actions.filter((a) => !a.owner.toLowerCase().startsWith('us'));

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
              <h1 className="text-2xl font-bold">Actions & Follow-Up</h1>
              <p className="text-sm text-muted-foreground">
                {report.meetingSummary.customerName} — {report.meetingSummary.opportunityName}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEmail(!showEmail)}>
              <Mail className="h-4 w-4 mr-2" />
              Follow-Up Email
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold">{actions.length}</div>
              <p className="text-sm text-muted-foreground">Total Actions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-blue-600">{ourActions.length}</div>
              <p className="text-sm text-muted-foreground">Our Actions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-purple-600">{theirActions.length}</div>
              <p className="text-sm text-muted-foreground">Their Actions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-red-600">
                {actions.filter((a) => a.priority === 'Critical').length}
              </div>
              <p className="text-sm text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
        </div>

        {/* Decision Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Decision Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{report.decisionTimeline}</p>
          </CardContent>
        </Card>

        {/* Actions Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>All Actions</CardTitle>
            <CardDescription>Sorted by priority</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium w-8">#</th>
                    <th className="pb-3 font-medium">Action</th>
                    <th className="pb-3 font-medium">Owner</th>
                    <th className="pb-3 font-medium">Deadline</th>
                    <th className="pb-3 font-medium">Priority</th>
                    <th className="pb-3 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {actions
                    .sort((a, b) => {
                      const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
                      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
                    })
                    .map((action, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-3 font-medium">{action.action}</td>
                        <td className="py-3">
                          <Badge variant="outline" className="text-xs">
                            {action.owner}
                          </Badge>
                        </td>
                        <td className="py-3">{action.deadline}</td>
                        <td className="py-3">
                          <Badge className={`text-xs ${getPriorityColor(action.priority)}`}>
                            {action.priority}
                          </Badge>
                        </td>
                        <td className="py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                          {action.source}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Follow-Up Email Draft */}
        {showEmail && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Follow-Up Email Draft
              </CardTitle>
              <CardDescription>Review and copy to your email client</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                rows={15}
                className="w-full p-4 border rounded-lg text-sm font-mono bg-white resize-y"
              />
              <div className="flex gap-2 mt-3">
                <Button onClick={copyEmail} variant="outline" size="sm">
                  {copied ? <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Risk Flags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Risk Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {actions.filter((a) => a.priority === 'Critical').length === 0 && (
                <li className="text-sm text-green-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> No critical actions identified
                </li>
              )}
              {theirActions.length === 0 && (
                <li className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> No customer actions agreed — consider following up to confirm next steps
                </li>
              )}
              {actions.some((a) => !a.deadline || a.deadline.toLowerCase().includes('tbd')) && (
                <li className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Some actions have no clear deadline
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
