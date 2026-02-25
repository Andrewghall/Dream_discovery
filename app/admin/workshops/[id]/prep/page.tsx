'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Building2,
  Globe,
  Target,
  Search,
  FileQuestion,
  Brain,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  AgentOrchestrationPanel,
  type AgentConversationEntry,
} from '@/components/cognitive-guidance/agent-orchestration-panel';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

type PageProps = { params: Promise<{ id: string }> };

type WorkshopPrep = {
  id: string;
  name: string;
  clientName: string | null;
  industry: string | null;
  companyWebsite: string | null;
  dreamTrack: 'ENTERPRISE' | 'DOMAIN' | null;
  targetDomain: string | null;
  prepResearch: Record<string, unknown> | null;
  customQuestions: Record<string, unknown> | null;
  discoveryBriefing: Record<string, unknown> | null;
};

// ══════════════════════════════════════════════════════════
// INDUSTRY OPTIONS
// ══════════════════════════════════════════════════════════

const INDUSTRY_OPTIONS = [
  'Retail',
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Technology',
  'Energy & Utilities',
  'Public Sector',
  'Telecommunications',
  'Education',
  'Professional Services',
  'Transport & Logistics',
  'Media & Entertainment',
  'Other',
];

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════

export default function PrepPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [workshop, setWorkshop] = useState<WorkshopPrep | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [clientName, setClientName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [dreamTrack, setDreamTrack] = useState<'ENTERPRISE' | 'DOMAIN'>('ENTERPRISE');
  const [targetDomain, setTargetDomain] = useState('');

  // Agent panels
  const [researchRunning, setResearchRunning] = useState(false);
  const [researchComplete, setResearchComplete] = useState(false);
  const [questionsRunning, setQuestionsRunning] = useState(false);
  const [questionsComplete, setQuestionsComplete] = useState(false);
  const [briefingRunning, setBriefingRunning] = useState(false);
  const [briefingComplete, setBriefingComplete] = useState(false);

  // Agent conversation
  const [agentConversation, setAgentConversation] = useState<AgentConversationEntry[]>([]);
  const [conversationCollapsed, setConversationCollapsed] = useState(false);

  // Auto-run research on first load when client details exist but research hasn't been done
  const autoRunTriggered = useRef(false);

  // ── Fetch workshop data ───────────────────────────
  useEffect(() => {
    async function fetchWorkshop() {
      try {
        const res = await fetch(`/api/admin/workshops/${workshopId}`);
        if (res.ok) {
          const data = await res.json();
          const w = data.workshop as WorkshopPrep;
          setWorkshop(w);
          setClientName(w.clientName || '');
          setIndustry(w.industry || '');
          setCompanyWebsite(w.companyWebsite || '');
          setDreamTrack(w.dreamTrack || 'ENTERPRISE');
          setTargetDomain(w.targetDomain || '');
          setResearchComplete(!!w.prepResearch);
          setQuestionsComplete(!!w.customQuestions);
          setBriefingComplete(!!w.discoveryBriefing);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchWorkshop();
  }, [workshopId]);

  // ── Save client context ───────────────────────────
  const saveContext = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/workshops/${workshopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          industry,
          companyWebsite,
          dreamTrack,
          targetDomain: dreamTrack === 'DOMAIN' ? targetDomain : null,
        }),
      });
    } catch {
      // fail silently
    } finally {
      setSaving(false);
    }
  }, [workshopId, clientName, industry, companyWebsite, dreamTrack, targetDomain]);

  // ── Trigger Research Agent via SSE ────────────────
  const runResearch = useCallback(async () => {
    setResearchRunning(true);
    // Save context first so the API has the latest fields
    try {
      await fetch(`/api/admin/workshops/${workshopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          industry,
          companyWebsite,
          dreamTrack,
          targetDomain: dreamTrack === 'DOMAIN' ? targetDomain : null,
        }),
      });
    } catch {
      // continue even if save fails
    }

    try {
      const res = await fetch(`/api/workshops/${workshopId}/prep/research`, {
        method: 'POST',
      });

      if (!res.ok || !res.body) {
        setResearchRunning(false);
        setAgentConversation((prev) => [
          ...prev,
          {
            timestampMs: Date.now(),
            agent: 'prep-orchestrator',
            to: '',
            message: `Research request failed: ${res.statusText || 'Unknown error'}. Please try again.`,
            type: 'info',
          },
        ]);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'agent.conversation') {
                setAgentConversation((prev) => [...prev, data as AgentConversationEntry]);
              } else if (eventType === 'research.complete') {
                setResearchComplete(true);
              }
            } catch {
              // Ignore parse errors
            }
            eventType = '';
          } else if (line === '') {
            eventType = '';
          }
        }
      }
    } catch (error) {
      setAgentConversation((prev) => [
        ...prev,
        {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Research failed: ${error instanceof Error ? error.message : 'Network error'}. Please try again.`,
          type: 'info',
        },
      ]);
    } finally {
      setResearchRunning(false);
    }
  }, [workshopId, clientName, industry, companyWebsite, dreamTrack, targetDomain]);

  // ── Auto-start Research Agent if client details exist but research hasn't run ──
  useEffect(() => {
    if (
      !autoRunTriggered.current &&
      !loading &&
      workshop &&
      workshop.clientName &&
      !workshop.prepResearch &&
      !researchRunning &&
      !researchComplete
    ) {
      autoRunTriggered.current = true;
      runResearch();
    }
  }, [loading, workshop, researchRunning, researchComplete, runResearch]);

  // ── Trigger Question Set Agent via SSE ────────────
  const runQuestions = useCallback(async () => {
    setQuestionsRunning(true);

    try {
      const res = await fetch(`/api/workshops/${workshopId}/prep/questions`, {
        method: 'POST',
      });

      if (!res.ok || !res.body) {
        setQuestionsRunning(false);
        setAgentConversation((prev) => [
          ...prev,
          {
            timestampMs: Date.now(),
            agent: 'prep-orchestrator',
            to: '',
            message: `Question generation failed: ${res.statusText || 'Unknown error'}. Please try again.`,
            type: 'info',
          },
        ]);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'agent.conversation') {
                setAgentConversation((prev) => [...prev, data as AgentConversationEntry]);
              } else if (eventType === 'questions.generated') {
                setQuestionsComplete(true);
              }
            } catch { /* ignore parse errors */ }
            eventType = '';
          } else if (line === '') {
            eventType = '';
          }
        }
      }
    } catch (error) {
      setAgentConversation((prev) => [
        ...prev,
        {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Question generation failed: ${error instanceof Error ? error.message : 'Network error'}. Please try again.`,
          type: 'info',
        },
      ]);
    } finally {
      setQuestionsRunning(false);
    }
  }, [workshopId]);

  const runBriefing = useCallback(async () => {
    setBriefingRunning(true);

    try {
      const res = await fetch(`/api/workshops/${workshopId}/prep/discovery-briefing`, {
        method: 'POST',
      });

      if (!res.ok || !res.body) {
        setBriefingRunning(false);
        setAgentConversation((prev) => [
          ...prev,
          {
            timestampMs: Date.now(),
            agent: 'prep-orchestrator',
            to: '',
            message: `Discovery synthesis failed: ${res.statusText || 'Unknown error'}. Please try again.`,
            type: 'info',
          },
        ]);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'agent.conversation') {
                setAgentConversation((prev) => [...prev, data as AgentConversationEntry]);
              } else if (eventType === 'briefing.complete') {
                setBriefingComplete(true);
              }
            } catch { /* ignore parse errors */ }
            eventType = '';
          } else if (line === '') {
            eventType = '';
          }
        }
      }
    } catch (error) {
      setAgentConversation((prev) => [
        ...prev,
        {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Discovery synthesis failed: ${error instanceof Error ? error.message : 'Network error'}. Please try again.`,
          type: 'info',
        },
      ]);
    } finally {
      setBriefingRunning(false);
    }
  }, [workshopId]);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/admin/workshops/${workshopId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workshop Preparation</h1>
            <p className="text-sm text-muted-foreground">
              {workshop?.name || 'Workshop'} — Configure client intelligence and tailor Discovery questions
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* ── Client Context Card ──────────────────────── */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold">Client Context</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  placeholder="e.g., Tesco"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((ind) => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="companyWebsite">
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Company Website
                </span>
              </Label>
              <Input
                id="companyWebsite"
                type="url"
                placeholder="https://www.example.com"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
              />
            </div>

            {/* DREAM Track */}
            <div className="space-y-3 mb-4">
              <Label>
                <span className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  DREAM Track
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDreamTrack('ENTERPRISE')}
                  className={`text-left rounded-lg border-2 p-3 transition-all ${
                    dreamTrack === 'ENTERPRISE'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <div className="text-sm font-semibold">Enterprise</div>
                  <p className="text-xs text-muted-foreground mt-0.5">Full end-to-end assessment</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDreamTrack('DOMAIN')}
                  className={`text-left rounded-lg border-2 p-3 transition-all ${
                    dreamTrack === 'DOMAIN'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <div className="text-sm font-semibold">Domain</div>
                  <p className="text-xs text-muted-foreground mt-0.5">Focused business unit</p>
                </button>
              </div>
            </div>

            {dreamTrack === 'DOMAIN' && (
              <div className="space-y-2 mb-4">
                <Label htmlFor="targetDomain">Target Domain</Label>
                <Input
                  id="targetDomain"
                  placeholder="e.g., Customer Operations"
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                />
              </div>
            )}

            <Button onClick={saveContext} disabled={saving} variant="outline" size="sm">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
              Save Context
            </Button>
          </div>

          {/* ── Agent Action Cards ────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Research */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold">Research Agent</h3>
                {researchComplete && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Fetches public data about the company, industry context, and competitive landscape.
              </p>
              <Button
                onClick={runResearch}
                disabled={researchRunning || !clientName}
                size="sm"
                className="w-full"
              >
                {researchRunning ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-2" />Researching...</>
                ) : researchComplete ? (
                  'Re-run Research'
                ) : (
                  'Run Research'
                )}
              </Button>
            </div>

            {/* Question Set */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileQuestion className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold">Question Set Agent</h3>
                {questionsComplete && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Tailors Discovery interview questions to the client context and DREAM track.
              </p>
              <Button
                onClick={runQuestions}
                disabled={questionsRunning || !researchComplete}
                size="sm"
                className="w-full"
                variant={researchComplete ? 'default' : 'secondary'}
              >
                {questionsRunning ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-2" />Generating...</>
                ) : questionsComplete ? (
                  'Regenerate Questions'
                ) : (
                  'Generate Questions'
                )}
              </Button>
            </div>

            {/* Discovery Intelligence */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold">Discovery Intelligence</h3>
                {briefingComplete && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Synthesizes participant interview responses into a workshop briefing.
              </p>
              <Button
                onClick={runBriefing}
                disabled={briefingRunning}
                size="sm"
                className="w-full"
                variant="secondary"
              >
                {briefingRunning ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-2" />Synthesizing...</>
                ) : briefingComplete ? (
                  'Re-synthesize'
                ) : (
                  'Synthesize Discovery'
                )}
              </Button>
            </div>
          </div>

          {/* ── Agent Orchestration Panel ─────────────────── */}
          <AgentOrchestrationPanel
            entries={agentConversation}
            collapsed={conversationCollapsed}
            onToggleCollapse={() => setConversationCollapsed(!conversationCollapsed)}
            title="PREP AGENT ORCHESTRATION"
          />
        </div>
      </div>
    </div>
  );
}
