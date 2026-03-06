'use client';

/**
 * Discovery Invite Page
 *
 * Shown after Prep is complete. Facilitator:
 *   1. Reviews / edits the generated discovery interview questions (left panel)
 *   2. Adds participants and manages their status (right panel)
 *   3. Sends invitations — button is gated until both questions AND ≥1 participant exist
 */

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  MessageSquare,
  Pencil,
  Send,
  Trash2,
  UserPlus,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

interface DiscoveryQuestion {
  id: string;
  text: string;
  tag?: string;
  purpose?: string;
  isEdited?: boolean;
  maturityScale?: string[];
}

interface DiscoveryLens {
  key: string;
  label: string;
  questions: DiscoveryQuestion[];
}

interface DiscoveryQuestionSet {
  lenses: DiscoveryLens[];
  generatedAtMs: number;
  agentRationale?: string;
  facilitatorDirection?: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  role: string | null;
  department: string | null;
  discoveryToken: string;
  emailSentAt: Date | null;
  doNotSendAgain?: boolean;
  responseStartedAt: Date | null;
  responseCompletedAt: Date | null;
}

interface Workshop {
  id: string;
  name: string;
  responseDeadline: Date | null;
  participants: Participant[];
}

// ── Lens colours ─────────────────────────────────────────────────────────────

const LENS_HEADER_COLORS: Record<string, string> = {
  People: 'bg-blue-50 border-blue-200 text-blue-800',
  Organisation: 'bg-green-50 border-green-200 text-green-800',
  Customer: 'bg-purple-50 border-purple-200 text-purple-800',
  Technology: 'bg-orange-50 border-orange-200 text-orange-800',
  Regulation: 'bg-red-50 border-red-200 text-red-800',
  General: 'bg-slate-50 border-slate-200 text-slate-700',
};

const LENS_DOT_COLORS: Record<string, string> = {
  People: 'bg-blue-500',
  Organisation: 'bg-green-500',
  Customer: 'bg-purple-500',
  Technology: 'bg-orange-500',
  Regulation: 'bg-red-500',
  General: 'bg-slate-400',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function InvitePage({ params }: PageProps) {
  const { id } = use(params);

  // Questions state
  const [questionsData, setQuestionsData] = useState<DiscoveryQuestionSet | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editingQText, setEditingQText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [collapsedLenses, setCollapsedLenses] = useState<Record<string, boolean>>({});

  // Workshop / participants state
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [workshopLoading, setWorkshopLoading] = useState(true);

  // Add participant form
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '', role: '', department: '' });
  const [addingParticipant, setAddingParticipant] = useState(false);

  // Copy link feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Send state
  const [sending, setSending] = useState(false);
  const [clearingStatus, setClearingStatus] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/workshops/${id}/prep/discovery-questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestionsData(data.discoveryQuestions || null);
      }
    } catch (e) {
      console.error('Failed to fetch discovery questions:', e);
    } finally {
      setQuestionsLoading(false);
    }
  }, [id]);

  const fetchWorkshop = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/workshops/${id}?bust=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setWorkshop(data.workshop);
      }
    } catch (e) {
      console.error('Failed to fetch workshop:', e);
    } finally {
      setWorkshopLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchQuestions();
    void fetchWorkshop();
  }, [fetchQuestions, fetchWorkshop]);

  // ── Question editing ──────────────────────────────────────────────────────

  const startEditQuestion = (q: DiscoveryQuestion) => {
    setEditingQId(q.id);
    setEditingQText(q.text);
  };

  const cancelEdit = () => {
    setEditingQId(null);
    setEditingQText('');
  };

  const saveEdit = async () => {
    if (!editingQId || !questionsData) return;
    setSavingEdit(true);

    const updated: DiscoveryQuestionSet = JSON.parse(JSON.stringify(questionsData));
    for (const lens of updated.lenses) {
      for (const q of lens.questions) {
        if (q.id === editingQId) {
          q.text = editingQText.trim();
          q.isEdited = true;
        }
      }
    }

    try {
      const res = await fetch(`/api/workshops/${id}/prep/discovery-questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveryQuestions: updated }),
      });
      if (res.ok) {
        setQuestionsData(updated);
        setEditingQId(null);
        setEditingQText('');
      } else {
        alert('Failed to save edit. Please try again.');
      }
    } catch {
      alert('Failed to save edit. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Participants ──────────────────────────────────────────────────────────

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingParticipant(true);
    try {
      const res = await fetch(`/api/admin/workshops/${id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParticipant),
      });
      if (res.ok) {
        setNewParticipant({ name: '', email: '', role: '', department: '' });
        void fetchWorkshop();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Failed to add participant');
      }
    } catch {
      alert('Failed to add participant');
    } finally {
      setAddingParticipant(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string, email: string) => {
    if (!confirm(`Remove ${email} from this workshop?`)) return;
    try {
      const res = await fetch(`/api/admin/workshops/${id}/participants`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
      if (res.ok) void fetchWorkshop();
      else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Failed to remove participant');
      }
    } catch {
      alert('Failed to remove participant');
    }
  };

  const copyDiscoveryLink = (token: string) => {
    const link = `${window.location.origin}/discovery/${id}/${token}`;
    void navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // ── Send invitations ──────────────────────────────────────────────────────

  const handleSendInvitations = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/admin/workshops/${id}/send-invitations`, { method: 'POST' });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        if (data?.errors?.length) {
          const list: Array<{ email?: string; error?: string }> = data.errors;
          const errorText = list.map((e) => `${e.email}: ${e.error}`).join('\n');
          alert(`Some emails failed to send:\n\n${errorText}`);
        }
        if (data?.emailsSent === 0 && data?.message) {
          setSuccessMessage(data.message);
        } else {
          setSuccessMessage(`Invitations sent to ${data?.emailsSent ?? 0} participant(s)!`);
        }
        setShowSuccessDialog(true);
        void fetchWorkshop();
      } else {
        const message = data?.details?.message || data?.error || 'Failed to send invitations';
        alert(message);
      }
    } catch {
      alert('Failed to send invitations');
    } finally {
      setSending(false);
    }
  };

  const handleClearEmailStatus = async () => {
    if (!confirm('Clear email sent status for all participants? This allows invitations to be resent.')) return;
    setClearingStatus(true);
    try {
      const res = await fetch(`/api/admin/workshops/${id}/clear-email-status`, { method: 'POST' });
      if (res.ok) {
        void fetchWorkshop();
      } else {
        alert('Failed to clear email status');
      }
    } catch {
      alert('Failed to clear email status');
    } finally {
      setClearingStatus(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasQuestions =
    !!questionsData && questionsData.lenses.some((l) => l.questions.length > 0);
  const participants = workshop?.participants ?? [];
  const canSend = hasQuestions && participants.length > 0;
  const totalQuestions = questionsData?.lenses.reduce((sum, l) => sum + l.questions.length, 0) ?? 0;

  const toggleLens = (key: string) =>
    setCollapsedLenses((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Participant status helper ──────────────────────────────────────────────

  const participantStatus = (p: Participant) => {
    if (p.responseCompletedAt) return { label: 'Completed', cls: 'bg-green-100 text-green-700' };
    if (p.responseStartedAt) return { label: 'In Progress', cls: 'bg-blue-100 text-blue-700' };
    if (p.emailSentAt) return { label: 'Invited', cls: 'bg-amber-100 text-amber-700' };
    return { label: 'Not Sent', cls: 'bg-slate-100 text-slate-500' };
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (questionsLoading || workshopLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Discovery Invite</h1>
          <p className="text-sm text-muted-foreground">
            Review the interview questions, add participants, then send invitations.
          </p>
        </div>

        {/* Gate warning if no questions */}
        {!questionsLoading && !hasQuestions && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Discovery questions not generated yet</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Go to the{' '}
                <Link
                  href={`/admin/workshops/${id}/prep`}
                  className="underline font-medium hover:text-amber-900"
                >
                  Prep page
                </Link>{' '}
                and generate discovery questions before sending invitations.
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* ── LEFT: Questions panel (3/5) ─────────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-sm font-semibold">Discovery Interview Questions</h2>
                  {hasQuestions && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  )}
                </div>
                {hasQuestions && (
                  <span className="text-xs text-muted-foreground">
                    {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
                    {' across '}
                    {questionsData!.lenses.length} lens
                    {questionsData!.lenses.length !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>

              {!hasQuestions ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No questions generated yet.{' '}
                  <Link
                    href={`/admin/workshops/${id}/prep`}
                    className="underline hover:text-foreground"
                  >
                    Go to Prep
                  </Link>{' '}
                  to generate them.
                </div>
              ) : (
                <div className="divide-y">
                  {questionsData!.lenses.map((lens) => {
                    const headerColor = LENS_HEADER_COLORS[lens.label] ?? LENS_HEADER_COLORS.General;
                    const dotColor = LENS_DOT_COLORS[lens.label] ?? LENS_DOT_COLORS.General;
                    const isCollapsed = collapsedLenses[lens.key];

                    return (
                      <div key={lens.key}>
                        {/* Lens header — clickable to collapse */}
                        <button
                          onClick={() => toggleLens(lens.key)}
                          className={`w-full flex items-center justify-between px-5 py-3 hover:opacity-90 transition-opacity ${headerColor}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                            <span className="text-sm font-semibold">{lens.label}</span>
                            <span className="text-xs opacity-70">
                              {lens.questions.length} question{lens.questions.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {isCollapsed ? (
                            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                          ) : (
                            <ChevronUp className="h-3.5 w-3.5 opacity-60" />
                          )}
                        </button>

                        {/* Questions */}
                        {!isCollapsed && (
                          <div className="divide-y divide-slate-100">
                            {lens.questions.map((q, qIdx) => (
                              <div
                                key={q.id}
                                className="px-5 py-3.5 group hover:bg-slate-50 relative"
                              >
                                {editingQId === q.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      className="w-full min-h-[80px] p-2 text-sm border rounded-md bg-white"
                                      value={editingQText}
                                      onChange={(e) => setEditingQText(e.target.value)}
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => void saveEdit()}
                                        disabled={savingEdit}
                                      >
                                        {savingEdit ? 'Saving…' : 'Save'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={cancelEdit}
                                        disabled={savingEdit}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-3">
                                    <span className="text-xs text-muted-foreground mt-0.5 shrink-0 w-5 text-right">
                                      {qIdx + 1}.
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm whitespace-pre-wrap">{q.text}</p>
                                      {q.purpose && (
                                        <p className="text-xs text-muted-foreground mt-1 italic">
                                          {q.purpose}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        {q.tag === 'triple_rating' && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                            Maturity Rating
                                          </span>
                                        )}
                                        {q.isEdited && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                            edited
                                          </span>
                                        )}
                                      </div>
                                      {/* Maturity scale preview */}
                                      {q.tag === 'triple_rating' &&
                                        q.maturityScale &&
                                        q.maturityScale.length >= 2 && (
                                          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 space-y-1">
                                            <div className="flex items-start gap-2">
                                              <span className="text-[10px] font-bold text-amber-700 mt-px shrink-0 w-4 text-center">1</span>
                                              <span className="text-xs text-muted-foreground">{q.maturityScale[0]}</span>
                                            </div>
                                            {q.maturityScale.length >= 5 && (
                                              <div className="flex items-start gap-2">
                                                <span className="text-[10px] font-bold text-amber-700 mt-px shrink-0 w-4 text-center">3</span>
                                                <span className="text-xs text-muted-foreground">{q.maturityScale[2]}</span>
                                              </div>
                                            )}
                                            <div className="flex items-start gap-2">
                                              <span className="text-[10px] font-bold text-amber-700 mt-px shrink-0 w-4 text-center">5</span>
                                              <span className="text-xs text-muted-foreground">{q.maturityScale[q.maturityScale.length - 1]}</span>
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                    {/* Edit button */}
                                    <button
                                      onClick={() => startEditQuestion(q)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-200 rounded shrink-0"
                                      title="Edit question"
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Agent rationale */}
                  {questionsData?.agentRationale && (
                    <div className="px-5 py-3 bg-slate-50 border-t">
                      <p className="text-xs text-muted-foreground italic">
                        {questionsData.agentRationale}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Proceed to Live Session link */}
            <div className="flex justify-end">
              <Link href={`/admin/workshops/${id}/cognitive-guidance`}>
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  Proceed to Live Session
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* ── RIGHT: Participants panel (2/5) ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Response deadline */}
            {workshop?.responseDeadline && (
              <div className="rounded-lg border bg-blue-50 border-blue-200 px-4 py-3">
                <p className="text-xs font-medium text-blue-700">Response deadline</p>
                <p className="text-sm font-semibold text-blue-900 mt-0.5">
                  {new Date(workshop.responseDeadline).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}

            {/* Add participant form */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b bg-slate-50">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-slate-500" />
                  Add Participant
                </h2>
              </div>
              <form onSubmit={(e) => void handleAddParticipant(e)} className="px-5 py-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-name" className="text-xs">Name *</Label>
                  <Input
                    id="inv-name"
                    placeholder="Jane Smith"
                    value={newParticipant.name}
                    onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-email" className="text-xs">Email *</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    placeholder="jane@company.com"
                    value={newParticipant.email}
                    onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-role" className="text-xs">Role</Label>
                    <Input
                      id="inv-role"
                      placeholder="e.g. Manager"
                      value={newParticipant.role}
                      onChange={(e) => setNewParticipant({ ...newParticipant, role: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-dept" className="text-xs">Department</Label>
                    <Input
                      id="inv-dept"
                      placeholder="e.g. Ops"
                      value={newParticipant.department}
                      onChange={(e) => setNewParticipant({ ...newParticipant, department: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-8 text-xs"
                  disabled={addingParticipant}
                >
                  {addingParticipant ? 'Adding…' : (
                    <>
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      Add Participant
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Participant list */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-slate-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Participants
                  {participants.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({participants.length})
                    </span>
                  )}
                </h2>
                {participants.some((p) => p.emailSentAt) && (
                  <button
                    onClick={() => void handleClearEmailStatus()}
                    disabled={clearingStatus}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Clear email status to allow resending"
                  >
                    <RefreshCw className={`h-3 w-3 ${clearingStatus ? 'animate-spin' : ''}`} />
                    Reset status
                  </button>
                )}
              </div>

              {participants.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No participants yet. Add someone above to get started.
                </div>
              ) : (
                <div className="divide-y">
                  {participants.map((p) => {
                    const status = participantStatus(p);
                    return (
                      <div key={p.id} className="px-4 py-3 flex items-start gap-3 group hover:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{p.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.cls}`}
                            >
                              {status.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.email}</p>
                          {(p.role || p.department) && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              {[p.role, p.department].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Link
                            href={`/admin/workshops/${id}/participants/${p.id}`}
                            className="p-1.5 rounded hover:bg-slate-200 transition-colors"
                            title="Review responses"
                          >
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </Link>
                          <button
                            onClick={() => copyDiscoveryLink(p.discoveryToken)}
                            className="p-1.5 rounded hover:bg-slate-200 transition-colors"
                            title="Copy discovery link"
                          >
                            {copiedToken === p.discoveryToken ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            onClick={() => void handleRemoveParticipant(p.id, p.email)}
                            className="p-1.5 rounded hover:bg-red-100 transition-colors"
                            title="Remove participant"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Send button */}
              <div className="px-4 py-4 border-t bg-slate-50">
                {!canSend && (
                  <p className="text-xs text-muted-foreground mb-2 text-center">
                    {!hasQuestions
                      ? 'Generate discovery questions first'
                      : 'Add at least one participant to send'}
                  </p>
                )}
                <Button
                  className="w-full gap-2"
                  disabled={!canSend || sending}
                  onClick={() => void handleSendInvitations()}
                >
                  {sending ? (
                    'Sending…'
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Discovery Invitations
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Invitations Sent
            </DialogTitle>
            <DialogDescription>{successMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
