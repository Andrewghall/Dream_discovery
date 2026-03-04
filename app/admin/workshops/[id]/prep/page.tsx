'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Globe,
  Target,
  Search,
  FileQuestion,
  Brain,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  X,
  MessageSquare,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  AgentOrchestrationPanel,
  type AgentConversationEntry,
} from '@/components/cognitive-guidance/agent-orchestration-panel';
import BlueprintPreviewPanel from '@/components/prep/blueprint-preview-panel';
import HistoricalMetricsPanel from '@/components/prep/historical-metrics-panel';
import { readBlueprintFromJson, type WorkshopBlueprint } from '@/lib/workshop/blueprint';
import { readHistoricalMetricsFromJson, type HistoricalMetricsData } from '@/lib/historical-metrics/types';
import { getDomainPack } from '@/lib/domain-packs/registry';
import { toast } from 'sonner';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

type PageProps = { params: Promise<{ id: string }> };

type WorkshopPrep = {
  id: string;
  name: string;
  description: string | null;
  businessContext: string | null;
  clientName: string | null;
  industry: string | null;
  companyWebsite: string | null;
  dreamTrack: 'ENTERPRISE' | 'DOMAIN' | null;
  targetDomain: string | null;
  prepResearch: Record<string, unknown> | null;
  customQuestions: Record<string, unknown> | null;
  discoveryBriefing: Record<string, unknown> | null;
  domainPack: string | null;
  blueprint: Record<string, unknown> | null;
  historicalMetrics: Record<string, unknown> | null;
};

type FacilitationQuestion = {
  id: string;
  phase: string;
  lens: string | null;
  text: string;
  purpose: string;
  grounding: string;
  order: number;
  isEdited: boolean;
};

type PhaseData = {
  label: string;
  description: string;
  lensOrder: string[];
  questions: FacilitationQuestion[];
};

type WorkshopQuestionSetData = {
  phases: Record<string, PhaseData>;
  designRationale: string;
  generatedAtMs: number;
};

const PHASE_ICONS: Record<string, string> = {
  REIMAGINE: '\u2728',
  CONSTRAINTS: '\u26a0\ufe0f',
  DEFINE_APPROACH: '\ud83d\udee0\ufe0f',
};

const PHASE_COLORS: Record<string, string> = {
  REIMAGINE: 'text-purple-500',
  CONSTRAINTS: 'text-amber-500',
  DEFINE_APPROACH: 'text-blue-500',
};

const LENS_COLORS: Record<string, string> = {
  People: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  Organisation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Customer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  Technology: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  Regulation: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  General: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
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

  // Workshop purpose fields
  const [description, setDescription] = useState('');
  const [businessContext, setBusinessContext] = useState('');
  const [savingPurpose, setSavingPurpose] = useState(false);
  const [purposeSaved, setPurposeSaved] = useState(false);

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

  // Question editing state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');

  // Stored output data
  type ResearchOutput = {
    companyOverview?: string;
    industryContext?: string;
    keyPublicChallenges?: string[];
    recentDevelopments?: string[];
    competitorLandscape?: string;
    domainInsights?: string | null;
    sourceUrls?: string[];
  };
  const [researchData, setResearchData] = useState<ResearchOutput | null>(null);
  const [questionsData, setQuestionsData] = useState<Record<string, unknown> | null>(null);
  type BriefingOutput = {
    briefingSummary?: string;
    discoveryThemes?: Array<{ title: string; domain?: string; frequency?: number; sentiment?: string; keyQuotes?: string[] }>;
    consensusAreas?: string[];
    divergenceAreas?: Array<{ topic: string; perspectives?: string[] }>;
    painPoints?: Array<{ description: string; domain?: string; frequency?: number; severity?: string }>;
    aspirations?: string[];
    watchPoints?: string[];
  };
  const [briefingData, setBriefingData] = useState<BriefingOutput | null>(null);

  // Discovery interview questions
  const [discoveryQuestionsData, setDiscoveryQuestionsData] = useState<any>(null);
  const [discoveryQuestionsLoading, setDiscoveryQuestionsLoading] = useState(false);
  const [editingDiscoveryQId, setEditingDiscoveryQId] = useState<string | null>(null);
  const [editingDiscoveryQText, setEditingDiscoveryQText] = useState('');

  // Blueprint and historical metrics
  const [blueprintData, setBlueprintData] = useState<WorkshopBlueprint | null>(null);
  const [metricsData, setMetricsData] = useState<HistoricalMetricsData | null>(null);
  const [hasMetricReferences, setHasMetricReferences] = useState(false);

  // Collapsible output cards
  const [researchCollapsed, setResearchCollapsed] = useState(false);
  const [discoveryQuestionsCollapsed, setDiscoveryQuestionsCollapsed] = useState(false);
  const [questionsCollapsed, setQuestionsCollapsed] = useState(false);
  const [briefingCollapsed, setBriefingCollapsed] = useState(false);

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
          setDescription(w.description || '');
          setBusinessContext(w.businessContext || '');
          setClientName(w.clientName || '');
          setIndustry(w.industry || '');
          setCompanyWebsite(w.companyWebsite || '');
          setDreamTrack(w.dreamTrack || 'ENTERPRISE');
          setTargetDomain(w.targetDomain || '');
          setResearchComplete(!!w.prepResearch);
          setResearchData(w.prepResearch as ResearchOutput | null);
          setQuestionsComplete(!!w.customQuestions);
          setQuestionsData(w.customQuestions as Record<string, unknown> | null);
          setBriefingComplete(!!w.discoveryBriefing);
          setBriefingData(w.discoveryBriefing as BriefingOutput | null);

          // Parse blueprint and metrics from workshop response
          const bp = readBlueprintFromJson(data.workshop.blueprint);
          if (bp) setBlueprintData(bp);
          const hm = readHistoricalMetricsFromJson(data.workshop.historicalMetrics);
          if (hm) setMetricsData(hm);

          // Check if domain pack has metric references
          if (w.domainPack) {
            const pack = getDomainPack(w.domainPack);
            if (pack && pack.metricReferences.length > 0) {
              setHasMetricReferences(true);
            }
          }

          // Fetch Discovery interview questions
          if (w.domainPack) {
            try {
              const dqRes = await fetch(`/api/workshops/${workshopId}/prep/discovery-questions`);
              if (dqRes.ok) {
                const dqData = await dqRes.json();
                if (dqData.discoveryQuestions) {
                  setDiscoveryQuestionsData(dqData.discoveryQuestions);
                }
              }
            } catch {
              // fail silently
            }
          }
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchWorkshop();
  }, [workshopId]);

  // Gate: both purpose fields must be filled before agents can run
  const purposeComplete = description.trim().length > 0 && businessContext.trim().length > 0;

  // ── Save workshop purpose ──────────────────────────
  const savePurpose = useCallback(async () => {
    setSavingPurpose(true);
    setPurposeSaved(false);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, businessContext }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save purpose');
        return;
      }
      setPurposeSaved(true);
      setTimeout(() => setPurposeSaved(false), 3000);
    } catch (err) {
      console.error('Save purpose failed:', err);
      toast.error('Network error -- could not save');
    } finally {
      setSavingPurpose(false);
    }
  }, [workshopId, description, businessContext]);

  // ── Save client context ───────────────────────────
  const saveContext = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/workshops/${workshopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          businessContext,
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
  }, [workshopId, description, businessContext, clientName, industry, companyWebsite, dreamTrack, targetDomain]);

  // ── Trigger Research Agent via SSE ────────────────
  const runResearch = useCallback(async () => {
    setResearchRunning(true);
    // Save context first so the API has the latest fields
    try {
      await fetch(`/api/admin/workshops/${workshopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          businessContext,
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
                if (data && typeof data === 'object' && 'research' in data) {
                  setResearchData(data.research as ResearchOutput);
                }
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
                if (data && typeof data === 'object' && 'questions' in data) {
                  setQuestionsData(data.questions as Record<string, unknown>);
                }
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
                if (data && typeof data === 'object' && 'intelligence' in data) {
                  setBriefingData(data.intelligence as BriefingOutput);
                }
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

  // ── Question editing helpers ─────────────────────────────
  const startEditQuestion = useCallback((questionId: string, currentText: string) => {
    setEditingQuestionId(questionId);
    setEditingQuestionText(currentText);
  }, []);

  const cancelEditQuestion = useCallback(() => {
    setEditingQuestionId(null);
    setEditingQuestionText('');
  }, []);

  const saveEditQuestion = useCallback(async () => {
    if (!editingQuestionId || !questionsData) return;

    // Deep clone and update the question text
    const updated = JSON.parse(JSON.stringify(questionsData)) as WorkshopQuestionSetData;

    for (const phase of Object.values(updated.phases)) {
      for (const q of phase.questions) {
        if (q.id === editingQuestionId) {
          q.text = editingQuestionText;
          q.isEdited = true;
          break;
        }
      }
    }

    setQuestionsData(updated as unknown as Record<string, unknown>);
    setEditingQuestionId(null);
    setEditingQuestionText('');

    // Save to server
    try {
      await fetch(`/api/workshops/${workshopId}/prep/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customQuestions: updated }),
      });
    } catch {
      // fail silently
    }
  }, [editingQuestionId, editingQuestionText, questionsData, workshopId]);

  // ── Generate Discovery Interview Questions via SSE ──────
  const generateDiscoveryQuestions = useCallback(async () => {
    setDiscoveryQuestionsLoading(true);
    try {
      const response = await fetch(`/api/workshops/${workshopId}/prep/discovery-questions`, {
        method: 'POST',
      });

      if (!response.ok || !response.body) {
        setDiscoveryQuestionsLoading(false);
        setAgentConversation((prev) => [
          ...prev,
          {
            timestampMs: Date.now(),
            agent: 'prep-orchestrator',
            to: '',
            message: `Discovery question generation failed: ${response.statusText || 'Unknown error'}. Please try again.`,
            type: 'info',
          },
        ]);
        return;
      }

      // Read SSE stream (same pattern as research/briefing/questions)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
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
              } else if (eventType === 'discovery-questions.generated') {
                if (data && typeof data === 'object' && 'discoveryQuestions' in data) {
                  setDiscoveryQuestionsData(data.discoveryQuestions);
                }
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

      // Reload from server to be sure
      const dqRes = await fetch(`/api/workshops/${workshopId}/prep/discovery-questions`);
      if (dqRes.ok) {
        const dqData = await dqRes.json();
        if (dqData.discoveryQuestions) {
          setDiscoveryQuestionsData(dqData.discoveryQuestions);
        }
      }
    } catch (err) {
      console.error('Failed to generate Discovery questions:', err);
      setAgentConversation((prev) => [
        ...prev,
        {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Discovery question generation failed: ${err instanceof Error ? err.message : 'Network error'}. Please try again.`,
          type: 'info',
        },
      ]);
    } finally {
      setDiscoveryQuestionsLoading(false);
    }
  }, [workshopId]);

  // ── Save Discovery question edit ──────────────────────
  const saveDiscoveryQuestionEdit = useCallback(async () => {
    if (!editingDiscoveryQId || !discoveryQuestionsData) return;

    const updated = JSON.parse(JSON.stringify(discoveryQuestionsData));
    for (const lens of updated.lenses) {
      for (const q of lens.questions) {
        if (q.id === editingDiscoveryQId) {
          q.text = editingDiscoveryQText;
          q.isEdited = true;
          break;
        }
      }
    }

    try {
      const res = await fetch(`/api/workshops/${workshopId}/prep/discovery-questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveryQuestions: updated }),
      });

      if (res.ok) {
        setDiscoveryQuestionsData(updated);
        setEditingDiscoveryQId(null);
        setEditingDiscoveryQText('');
      }
    } catch (err) {
      console.error('Failed to save Discovery question edit:', err);
    }
  }, [editingDiscoveryQId, editingDiscoveryQText, discoveryQuestionsData, workshopId]);

  // Parse questions data into typed structure
  const parsedQuestions: WorkshopQuestionSetData | null = (() => {
    if (!questionsData) return null;
    // Check if it's the new format (has .phases)
    const d = questionsData as Record<string, unknown>;
    if (d.phases && typeof d.phases === 'object') {
      return d as unknown as WorkshopQuestionSetData;
    }
    return null;
  })();

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
        {/* Workflow breadcrumb */}
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Link href={`/admin/workshops/${workshopId}`} className="hover:text-foreground transition-colors">
            Workshop
          </Link>
          <ArrowRight className="h-3 w-3" />
          <span className="font-semibold text-foreground">Prep</span>
          <ArrowRight className="h-3 w-3" />
          <Link href={`/admin/workshops/${workshopId}/cognitive-guidance`} className="hover:text-foreground transition-colors">
            Live Workshop
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Workshop Preparation</h1>
              <p className="text-sm text-muted-foreground">
                {workshop?.name || 'Workshop'} — Research context, design workshop facilitation questions, and synthesize Discovery intelligence
              </p>
            </div>
          </div>
          <Link href={`/admin/workshops/${workshopId}/cognitive-guidance`}>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              Enter Live Workshop
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          {/* ── Workshop Purpose Card ────────────────────── */}
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-600/50 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-5 w-5 text-amber-600" />
              <h2 className="text-base font-bold text-amber-900 dark:text-amber-200">Workshop Purpose</h2>
            </div>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/60 mb-4">
              This is the foundation for everything the agents will produce. Be specific.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workshopWhy" className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Why are we running this workshop?
                </Label>
                <Textarea
                  id="workshopWhy"
                  rows={3}
                  placeholder="What is the strategic reason for this session? What problem or opportunity has brought everyone together?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="border-amber-200 dark:border-amber-700/50 focus-visible:ring-amber-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workshopOutcomes" className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  What outcomes do you need to walk away with?
                </Label>
                <Textarea
                  id="workshopOutcomes"
                  rows={3}
                  placeholder="What specific decisions, directions, or outputs must this workshop produce?"
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  className="border-amber-200 dark:border-amber-700/50 focus-visible:ring-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Button onClick={savePurpose} disabled={savingPurpose || purposeSaved} variant="outline" size="sm" className={purposeSaved ? 'border-green-400 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/30 dark:text-green-400' : 'border-amber-300 hover:bg-amber-100 dark:border-amber-600 dark:hover:bg-amber-900/30'}>
                {savingPurpose ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : purposeSaved ? <CheckCircle2 className="h-3 w-3 mr-2" /> : <Save className="h-3 w-3 mr-2" />}
                {savingPurpose ? 'Saving...' : purposeSaved ? 'Saved' : 'Save Purpose'}
              </Button>
              {!purposeComplete && (
                <span className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Both fields are required before agents can run
                </span>
              )}
            </div>
          </div>

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

          {/* ── Agent Workflow Pipeline ────────────────────── */}
          {!purposeComplete && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-700/50">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Complete the <span className="font-semibold">Workshop Purpose</span> above before running agents.
              </p>
            </div>
          )}
          <div className={`flex flex-col md:flex-row items-stretch gap-0 transition-opacity ${!purposeComplete ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Step 1: Research */}
            <div className="flex-1 rounded-xl border bg-card p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">1</span>
                <Search className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold">Research Agent</h3>
                {researchComplete && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Fetches public data about the company, industry context, and competitive landscape.
              </p>
              <Button
                onClick={runResearch}
                disabled={researchRunning || !clientName || !purposeComplete}
                size="sm"
                className="w-full mt-auto"
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

            {/* Arrow 1->2 */}
            <div className="hidden md:flex items-center justify-center px-1">
              <ArrowRight className={`h-5 w-5 ${researchComplete ? 'text-green-500' : 'text-muted-foreground/30'}`} />
            </div>
            <div className="flex md:hidden items-center justify-center py-1">
              <ChevronDown className={`h-5 w-5 ${researchComplete ? 'text-green-500' : 'text-muted-foreground/30'}`} />
            </div>

            {/* Step 2: Discovery Interview Questions */}
            {workshop?.domainPack ? (
              <div className={`flex-1 rounded-xl border bg-card p-5 flex flex-col transition-opacity ${!researchComplete ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">2</span>
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold">Discovery Questions</h3>
                  {discoveryQuestionsData && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Generates interview questions for participant Discovery sessions, organised by lens.
                </p>
                <Button
                  onClick={generateDiscoveryQuestions}
                  disabled={discoveryQuestionsLoading || !researchData}
                  size="sm"
                  className="w-full mt-auto"
                  variant={researchComplete ? 'default' : 'secondary'}
                >
                  {discoveryQuestionsLoading ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-2" />Generating...</>
                  ) : discoveryQuestionsData ? (
                    'Regenerate'
                  ) : (
                    'Generate Questions'
                  )}
                </Button>
              </div>
            ) : (
              /* No domain pack -- skip step 2, show synthesis as step 2 */
              null
            )}

            {/* Arrow 2->3 (or 1->2 if no domainPack) */}
            <div className="hidden md:flex items-center justify-center px-1">
              <ArrowRight className={`h-5 w-5 ${researchComplete ? 'text-green-500' : 'text-muted-foreground/30'}`} />
            </div>
            <div className="flex md:hidden items-center justify-center py-1">
              <ChevronDown className={`h-5 w-5 ${researchComplete ? 'text-green-500' : 'text-muted-foreground/30'}`} />
            </div>

            {/* Step 3: Discovery Synthesis (or step 2 if no domainPack) */}
            <div className={`flex-1 rounded-xl border bg-card p-5 flex flex-col transition-opacity ${!researchComplete ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-[10px] font-bold text-amber-700 dark:text-amber-300">{workshop?.domainPack ? '3' : '2'}</span>
                <Brain className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold">Discovery Synthesis</h3>
                {briefingComplete && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Synthesizes participant interview responses into themes, pain points, and aspirations.
              </p>
              <Button
                onClick={runBriefing}
                disabled={briefingRunning || !researchComplete || !purposeComplete}
                size="sm"
                className="w-full mt-auto"
                variant={researchComplete ? 'default' : 'secondary'}
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

            {/* Arrow 3->4 (or 2->3 if no domainPack) */}
            <div className="hidden md:flex items-center justify-center px-1">
              <ArrowRight className={`h-5 w-5 ${briefingComplete ? 'text-green-500' : 'text-muted-foreground/30'}`} />
            </div>
            <div className="flex md:hidden items-center justify-center py-1">
              <ChevronDown className={`h-5 w-5 ${briefingComplete ? 'text-green-500' : 'text-muted-foreground/30'}`} />
            </div>

            {/* Step 4: Workshop Questions (or step 3 if no domainPack) */}
            <div className={`flex-1 rounded-xl border bg-card p-5 flex flex-col transition-opacity ${!(researchComplete && briefingComplete) ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">{workshop?.domainPack ? '4' : '3'}</span>
                <FileQuestion className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold">Workshop Questions</h3>
                {questionsComplete && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Designs facilitation questions for Reimagine, Constraints, and Define Approach using research + Discovery insights.
              </p>
              <Button
                onClick={runQuestions}
                disabled={questionsRunning || !(researchComplete && briefingComplete) || !purposeComplete}
                size="sm"
                className="w-full mt-auto"
                variant={researchComplete && briefingComplete ? 'default' : 'secondary'}
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
          </div>

          {/* ── Blueprint Preview ─────────────────────────── */}
          {blueprintData && (
            <BlueprintPreviewPanel blueprint={blueprintData} />
          )}

          {/* ── Historical Metrics Upload ─────────────────── */}
          {hasMetricReferences && workshop?.domainPack && (
            <HistoricalMetricsPanel
              workshopId={workshopId}
              domainPack={workshop.domainPack}
              existingMetrics={metricsData}
              onMetricsUpdated={(updated) => setMetricsData(updated)}
            />
          )}

          {/* ── Research Output ─────────────────────────── */}
          {researchData && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <button
                onClick={() => setResearchCollapsed(!researchCollapsed)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-cyan-600" />
                  <h2 className="text-sm font-semibold">Research Output</h2>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
                {researchCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
              </button>
              {!researchCollapsed && <div className="px-6 pb-6 space-y-4">

              {researchData.companyOverview ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Company Overview</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{researchData.companyOverview}</p>
                </div>
              ) : null}

              {researchData.industryContext ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Industry Context</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{researchData.industryContext}</p>
                </div>
              ) : null}

              {researchData.keyPublicChallenges && researchData.keyPublicChallenges.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Key Public Challenges</h3>
                  <ul className="space-y-1">
                    {researchData.keyPublicChallenges.map((c, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-amber-500 flex-shrink-0">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {researchData.recentDevelopments && researchData.recentDevelopments.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recent Developments</h3>
                  <ul className="space-y-1">
                    {researchData.recentDevelopments.map((d, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-blue-500 flex-shrink-0">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {researchData.competitorLandscape ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Competitive Landscape</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{researchData.competitorLandscape}</p>
                </div>
              ) : null}

              {researchData.domainInsights ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Domain Insights</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{researchData.domainInsights}</p>
                </div>
              ) : null}
              </div>}
            </div>
          )}

          {/* ── Discovery Interview Questions Output ─────────────── */}
          {workshop?.domainPack && discoveryQuestionsData && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <button
                onClick={() => setDiscoveryQuestionsCollapsed(!discoveryQuestionsCollapsed)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-sm font-semibold">Discovery Interview Questions</h2>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
                {discoveryQuestionsCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
              </button>

              {!discoveryQuestionsCollapsed && discoveryQuestionsData?.lenses && (
                <div className="px-4 pb-4 space-y-4">
                  {discoveryQuestionsData.lenses.map((lens: any, lensIdx: number) => (
                    <div key={lens.key} className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 flex items-center gap-2">
                        <span className="text-sm font-semibold">{lens.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {lens.questions.length} questions
                        </span>
                      </div>
                      <div className="divide-y">
                        {lens.questions.map((q: any, qIdx: number) => (
                          <div
                            key={q.id}
                            className="px-4 py-3 group hover:bg-slate-50 dark:hover:bg-slate-900/30 relative"
                          >
                            {editingDiscoveryQId === q.id ? (
                              <div className="space-y-2">
                                <textarea
                                  className="w-full min-h-[80px] p-2 text-sm border rounded-md bg-white dark:bg-slate-900"
                                  value={editingDiscoveryQText}
                                  onChange={(e) => setEditingDiscoveryQText(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={saveDiscoveryQuestionEdit}>Save</Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingDiscoveryQId(null); setEditingDiscoveryQText(''); }}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-3">
                                <span className="text-xs text-muted-foreground mt-0.5 shrink-0">
                                  {qIdx + 1}.
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm whitespace-pre-wrap">{q.text}</p>
                                  {q.purpose && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">
                                      {q.purpose}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    {q.tag === 'triple_rating' && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        Maturity Rating
                                      </span>
                                    )}
                                    {q.isEdited && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        edited
                                      </span>
                                    )}
                                  </div>
                                  {q.tag === 'triple_rating' && q.maturityScale && Array.isArray(q.maturityScale) && q.maturityScale.length >= 2 && (
                                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 px-3 py-2 space-y-1">
                                      <div className="flex items-start gap-2">
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mt-px shrink-0 w-4 text-center">1</span>
                                        <span className="text-xs text-muted-foreground">{q.maturityScale[0]}</span>
                                      </div>
                                      {q.maturityScale.length >= 5 && (
                                        <div className="flex items-start gap-2">
                                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mt-px shrink-0 w-4 text-center">3</span>
                                          <span className="text-xs text-muted-foreground">{q.maturityScale[2]}</span>
                                        </div>
                                      )}
                                      <div className="flex items-start gap-2">
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mt-px shrink-0 w-4 text-center">5</span>
                                        <span className="text-xs text-muted-foreground">{q.maturityScale[q.maturityScale.length - 1]}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => { setEditingDiscoveryQId(q.id); setEditingDiscoveryQText(q.text); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded shrink-0"
                                  title="Edit question"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {discoveryQuestionsData.agentRationale && (
                    <p className="text-xs text-muted-foreground italic mt-2">
                      {discoveryQuestionsData.agentRationale}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Briefing Output (Step 3) ─────────────────── */}
          {briefingData && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <button
                onClick={() => setBriefingCollapsed(!briefingCollapsed)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-semibold">Discovery Briefing</h2>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
                {briefingCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
              </button>
              {!briefingCollapsed && <div className="px-6 pb-6 space-y-4">

              {briefingData.briefingSummary ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Summary</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{briefingData.briefingSummary}</p>
                </div>
              ) : null}

              {briefingData.discoveryThemes && briefingData.discoveryThemes.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Key Themes ({briefingData.discoveryThemes.length})</h3>
                  <ul className="space-y-2">
                    {briefingData.discoveryThemes.map((t, i) => (
                      <li key={i} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-500 flex-shrink-0">•</span>
                          <span className="font-medium">{t.title}</span>
                          {t.domain ? <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.domain}</span> : null}
                          {t.sentiment ? <span className={`text-xs ${t.sentiment === 'positive' ? 'text-green-600' : t.sentiment === 'negative' ? 'text-red-600' : 'text-amber-600'}`}>{t.sentiment}</span> : null}
                          {t.frequency ? <span className="text-xs text-muted-foreground">({t.frequency} mentions)</span> : null}
                        </div>
                        {t.keyQuotes && t.keyQuotes.length > 0 ? (
                          <div className="ml-5 mt-1 space-y-0.5">
                            {t.keyQuotes.map((q, qi) => (
                              <p key={qi} className="text-xs text-muted-foreground italic">&ldquo;{q}&rdquo;</p>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {briefingData.painPoints && briefingData.painPoints.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pain Points ({briefingData.painPoints.length})</h3>
                  <ul className="space-y-1">
                    {briefingData.painPoints.map((p, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-red-500 flex-shrink-0">•</span>
                        <span>
                          {p.description}
                          {p.domain ? <span className="text-xs bg-muted px-1.5 py-0.5 rounded ml-1">{p.domain}</span> : null}
                          {p.severity ? <span className={`text-xs ml-1 ${p.severity === 'critical' ? 'text-red-600 font-medium' : p.severity === 'significant' ? 'text-amber-600' : 'text-muted-foreground'}`}>{p.severity}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {briefingData.consensusAreas && briefingData.consensusAreas.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Consensus Areas</h3>
                  <ul className="space-y-1">
                    {briefingData.consensusAreas.map((c, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-green-500 flex-shrink-0">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {briefingData.divergenceAreas && briefingData.divergenceAreas.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Divergence Areas</h3>
                  <ul className="space-y-2">
                    {briefingData.divergenceAreas.map((d, i) => (
                      <li key={i} className="text-sm">
                        <div className="flex gap-2">
                          <span className="text-amber-500 flex-shrink-0">•</span>
                          <span className="font-medium">{d.topic}</span>
                        </div>
                        {d.perspectives && d.perspectives.length > 0 ? (
                          <div className="ml-5 mt-1 space-y-0.5">
                            {d.perspectives.map((p, pi) => (
                              <p key={pi} className="text-xs text-muted-foreground">– {p}</p>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {briefingData.aspirations && briefingData.aspirations.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Aspirations</h3>
                  <ul className="space-y-1">
                    {briefingData.aspirations.map((a, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-blue-500 flex-shrink-0">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {briefingData.watchPoints && briefingData.watchPoints.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Watch Points</h3>
                  <ul className="space-y-1">
                    {briefingData.watchPoints.map((w, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-orange-500 flex-shrink-0">⚠</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              </div>}
            </div>
          )}

          {/* ── Workshop Facilitation Questions Output (Step 3) ──── */}
          {questionsData && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <button
                onClick={() => setQuestionsCollapsed(!questionsCollapsed)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileQuestion className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-sm font-semibold">Workshop Facilitation Questions</h2>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
                {questionsCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
              </button>
              {!questionsCollapsed && <div className="px-6 pb-6 space-y-6">

              {/* Design rationale */}
              {parsedQuestions?.designRationale ? (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg p-4 border border-indigo-200/50 dark:border-indigo-800/30">
                  <h3 className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1">Design Rationale</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{parsedQuestions.designRationale}</p>
                </div>
              ) : null}

              {/* Phase-based question display */}
              {parsedQuestions ? (
                (['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as const).map((phaseKey) => {
                  const phase = parsedQuestions.phases[phaseKey];
                  if (!phase || !phase.questions || phase.questions.length === 0) return null;

                  return (
                    <div key={phaseKey} className="space-y-3">
                      {/* Phase header */}
                      <div className="flex items-center gap-2 border-b pb-2 border-muted">
                        <span className="text-lg">{PHASE_ICONS[phaseKey] || ''}</span>
                        <h3 className={`text-sm font-bold ${PHASE_COLORS[phaseKey] || 'text-foreground'}`}>
                          {phase.label || phaseKey}
                        </h3>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {phase.questions.length} questions &middot; {phase.lensOrder?.join(' \u2192 ')}
                        </span>
                      </div>

                      {/* Phase description */}
                      <p className="text-xs text-muted-foreground italic">{phase.description?.substring(0, 200)}</p>

                      {/* Questions list */}
                      <ol className="space-y-3">
                        {phase.questions.map((q: FacilitationQuestion, qi: number) => {
                          const isEditing = editingQuestionId === q.id;
                          const lensColor = LENS_COLORS[q.lens || 'General'] || LENS_COLORS.General;

                          return (
                            <li key={q.id || qi} className="group rounded-lg border border-muted/50 hover:border-muted p-3 transition-colors">
                              <div className="flex items-start gap-3">
                                <span className="text-indigo-400 flex-shrink-0 font-mono text-xs mt-1 w-5 text-right">{qi + 1}.</span>
                                <div className="flex-1 min-w-0">
                                  {/* Lens badge + edit button */}
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${lensColor}`}>
                                      {q.lens || 'General'}
                                    </span>
                                    {q.isEdited && (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400">edited</span>
                                    )}
                                    {!isEditing && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); startEditQuestion(q.id, q.text); }}
                                        className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                                        title="Edit question"
                                      >
                                        <Pencil className="h-3 w-3 text-muted-foreground" />
                                      </button>
                                    )}
                                  </div>

                                  {/* Question text or edit field */}
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <textarea
                                        value={editingQuestionText}
                                        onChange={(e) => setEditingQuestionText(e.target.value)}
                                        className="w-full text-sm p-2 rounded border bg-background resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        rows={3}
                                        autoFocus
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={saveEditQuestion}
                                          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                                        >
                                          <Save className="h-3 w-3" /> Save
                                        </button>
                                        <button
                                          onClick={cancelEditQuestion}
                                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted"
                                        >
                                          <X className="h-3 w-3" /> Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm leading-relaxed">{q.text}</p>
                                  )}

                                  {/* Purpose and grounding */}
                                  {!isEditing && (q.purpose || q.grounding) ? (
                                    <div className="mt-1.5 space-y-0.5">
                                      {q.purpose ? (
                                        <p className="text-xs text-muted-foreground"><span className="font-medium">Purpose:</span> {q.purpose}</p>
                                      ) : null}
                                      {q.grounding ? (
                                        <p className="text-xs text-muted-foreground"><span className="font-medium">Grounding:</span> {q.grounding}</p>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  );
                })
              ) : (
                /* Legacy format fallback — render raw data */
                <div className="space-y-2">
                  {Object.entries(questionsData).map(([key, val]) => {
                    if (key === 'generatedAtMs' || key === 'designRationale') return null;
                    return (
                      <div key={key}>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{key}</h3>
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{typeof val === 'string' ? val : JSON.stringify(val, null, 2)}</pre>
                      </div>
                    );
                  })}
                </div>
              )}

              </div>}
            </div>
          )}

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
