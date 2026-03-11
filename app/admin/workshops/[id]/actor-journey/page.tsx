'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, CheckCircle2, Loader2, Route } from 'lucide-react';
import LiveJourneyMap from '@/components/cognitive-guidance/live-journey-map';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { StoredOutputJourney } from '@/app/api/admin/workshops/[id]/journey/output/route';
import { ReportSectionToggle } from '@/components/report-builder/ReportSectionToggle';

// ── Types ──────────────────────────────────────────────────────────────────────

type SynthesisChoice = 'replace' | 'augment';
type SaveState = 'idle' | 'saving' | 'saved';

// ── Merge helper — keeps user edits, appends new AI interactions ───────────────

function augmentJourney(existing: LiveJourneyData, incoming: LiveJourneyData): LiveJourneyData {
  const existingIds = new Set(existing.interactions.map((i) => i.id));
  const newInteractions = incoming.interactions.filter((i) => !existingIds.has(i.id));

  // Union of stages (preserve existing order, append new)
  const existingStageSet = new Set(existing.stages);
  const mergedStages = [
    ...existing.stages,
    ...incoming.stages.filter((s) => !existingStageSet.has(s)),
  ];

  // Union of actors (by name)
  const existingActorNames = new Set(existing.actors.map((a) => a.name));
  const mergedActors = [
    ...existing.actors,
    ...incoming.actors.filter((a) => !existingActorNames.has(a.name)),
  ];

  return {
    stages: mergedStages,
    actors: mergedActors,
    interactions: [...existing.interactions, ...newInteractions],
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ActorJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: workshopId } = use(params);

  // ── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<LiveJourneyData | null>(null);
  const [stored, setStored] = useState<StoredOutputJourney | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [resynthesising, setResynthesising] = useState(false);
  const [resynthError, setResynthError] = useState<string | null>(null);

  // Pending synthesis result — held while waiting for user's replace/augment choice
  const [pendingSynthesis, setPendingSynthesis] = useState<LiveJourneyData | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSynthesisedAtRef = useRef<string | null>(null);

  // ── Load journey on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/journey/output`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (json.ok && json.journey) {
          const s = json.journey as StoredOutputJourney;
          setStored(s);
          setJourney(s.data);
          lastSynthesisedAtRef.current = s.lastSynthesisedAt;
        }
      } catch {
        // Leave journey null — empty state shows
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [workshopId]);

  // ── Debounced auto-save ───────────────────────────────────────────────────
  const save = useCallback(
    (data: LiveJourneyData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveState('saving');
      saveTimerRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/journey/output`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data, lastSynthesisedAt: lastSynthesisedAtRef.current }),
          });
          setStored((prev) =>
            prev
              ? { ...prev, data, userEdited: true, lastEditedAt: new Date().toISOString() }
              : { data, userEdited: true, lastSynthesisedAt: lastSynthesisedAtRef.current, lastEditedAt: new Date().toISOString() },
          );
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2500);
        } catch {
          setSaveState('idle');
        }
      }, 800);
    },
    [workshopId],
  );

  const handleChange = useCallback(
    (data: LiveJourneyData) => {
      setJourney(data);
      save(data);
    },
    [save],
  );

  // ── Resynthesize ──────────────────────────────────────────────────────────
  const handleResynthesize = useCallback(async () => {
    setResynthesising(true);
    setResynthError(null);
    try {
      const res = await fetch(
        `/api/admin/workshops/${encodeURIComponent(workshopId)}/journey/regenerate`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error('Synthesis failed');
      const json = await res.json();
      const newJourney: LiveJourneyData = json.liveJourney;
      lastSynthesisedAtRef.current = new Date().toISOString();

      if (stored?.userEdited && journey) {
        // User has manual edits — ask what to do
        setPendingSynthesis(newJourney);
      } else {
        // No edits — replace directly
        applyReplacement(newJourney);
      }
    } catch {
      setResynthError('Synthesis failed. Please try again.');
    } finally {
      setResynthesising(false);
    }
  }, [workshopId, stored, journey]);

  const applyReplacement = useCallback(
    (newJourney: LiveJourneyData) => {
      setJourney(newJourney);
      setStored((prev) =>
        prev
          ? { ...prev, data: newJourney, userEdited: false, lastSynthesisedAt: lastSynthesisedAtRef.current }
          : { data: newJourney, userEdited: false, lastSynthesisedAt: lastSynthesisedAtRef.current, lastEditedAt: null },
      );
      // Save immediately (not user-edited)
      void fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/journey/output`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: newJourney, lastSynthesisedAt: lastSynthesisedAtRef.current }),
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
      setPendingSynthesis(null);
    },
    [workshopId],
  );

  const handleSynthesisChoice = useCallback(
    (choice: SynthesisChoice) => {
      if (!pendingSynthesis) return;
      if (choice === 'replace') {
        applyReplacement(pendingSynthesis);
      } else {
        // Augment — keep user edits, add new interactions
        const merged = augmentJourney(journey!, pendingSynthesis);
        setJourney(merged);
        save(merged);
        setPendingSynthesis(null);
      }
    },
    [pendingSynthesis, journey, applyReplacement, save],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const lastSynth = stored?.lastSynthesisedAt
    ? new Date(stored.lastSynthesisedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f1a] text-slate-200">

      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-white/10 bg-[#060a14] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Route className="h-5 w-5 text-indigo-400" />
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Actor Journey Flow</h1>
              {lastSynth && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Last synthesised {lastSynth}
                  {stored?.userEdited && (
                    <span className="ml-2 text-indigo-400">· edited</span>
                  )}
                </p>
              )}
            </div>
            {journey && (
              <ReportSectionToggle
                workshopId={workshopId}
                sectionId="journey_map"
                title="Customer Journey"
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Save indicator */}
            {saveState === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </span>
            )}
            {saveState === 'saved' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            )}

            {/* Resynthesize */}
            <button
              onClick={handleResynthesize}
              disabled={resynthesising || loading}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {resynthesising ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {resynthesising ? 'Synthesising…' : '✦ Resynthesize'}
            </button>
          </div>
        </div>

        {resynthError && (
          <p className="mt-2 text-xs text-red-400">{resynthError}</p>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading journey…</span>
            </div>
          </div>
        ) : journey ? (
          <LiveJourneyMap
            data={journey}
            onChange={handleChange}
            expanded={true}
            onRegenerate={handleResynthesize}
          />
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <div className="rounded-full bg-indigo-500/10 p-5">
              <Route className="h-10 w-10 text-indigo-400" />
            </div>
            <div className="text-center">
              <h2 className="text-base font-medium text-slate-200">No journey data yet</h2>
              <p className="mt-1 text-sm text-slate-500 max-w-sm">
                Click <strong className="text-slate-300">✦ Resynthesize</strong> to generate the Actor Journey Map from your workshop output.
              </p>
            </div>
            <button
              onClick={handleResynthesize}
              disabled={resynthesising}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {resynthesising ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {resynthesising ? 'Synthesising…' : '✦ Resynthesize'}
            </button>
          </div>
        )}
      </div>

      {/* ── Replace / Augment Dialog ── */}
      {pendingSynthesis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1729] p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-slate-100 mb-1">
              Your journey has manual edits
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              New synthesis data is ready. How would you like to apply it?
            </p>

            <div className="space-y-3 mb-6">
              {/* Replace option */}
              <button
                onClick={() => handleSynthesisChoice('replace')}
                className="w-full text-left rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3.5 hover:bg-red-500/10 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-red-300 group-hover:text-red-200">Replace</span>
                  <span className="text-[10px] text-red-500/60 bg-red-500/10 px-1.5 py-0.5 rounded">Destructive</span>
                </div>
                <p className="text-xs text-slate-500">
                  Discard your edits and use the AI-generated journey entirely.
                </p>
              </button>

              {/* Augment option */}
              <button
                onClick={() => handleSynthesisChoice('augment')}
                className="w-full text-left rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-3.5 hover:bg-indigo-500/10 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-indigo-300 group-hover:text-indigo-200">Augment</span>
                  <span className="text-[10px] text-indigo-500/60 bg-indigo-500/10 px-1.5 py-0.5 rounded">Recommended</span>
                </div>
                <p className="text-xs text-slate-500">
                  Keep your edits and add new interactions from the synthesis that don't already exist.
                </p>
              </button>
            </div>

            <button
              onClick={() => setPendingSynthesis(null)}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              Cancel — keep current journey
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
