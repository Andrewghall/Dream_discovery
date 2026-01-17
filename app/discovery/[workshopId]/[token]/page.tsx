'use client';

import { use, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/components/chat/chat-message';
import { ChatInput } from '@/components/chat/chat-input';
import { ProgressIndicator } from '@/components/chat/progress-indicator';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { WhisperVoiceInput } from '@/components/chat/whisper-voice-input';
import { LanguageSelector } from '@/components/chat/language-selector';
import { TripleRatingInput } from '@/components/chat/triple-rating-input';
import { ConversationPhase, Message } from '@/lib/types/conversation';
import { getOverallQuestionNumber, getTotalQuestionCount } from '@/lib/conversation/fixed-questions';
import { setTtsEnabled, speakWithOpenAI } from '@/lib/utils/openai-tts';
import { ConversationReport, PhaseInsight } from '@/components/report/conversation-report';
import { Button } from '@/components/ui/button';

type QuestionMeta = {
  kind: 'question';
  phase: ConversationPhase;
  index: number;
  tag?: string;
  maturityScale?: string[];
};

const ALL_PHASES: readonly ConversationPhase[] = [
  'intro',
  'people',
  'corporate',
  'customer',
  'technology',
  'regulation',
  'prioritization',
  'summary',
];

function isConversationPhase(phase: unknown): phase is ConversationPhase {
  return typeof phase === 'string' && (ALL_PHASES as readonly string[]).includes(phase);
}

function isQuestionMeta(meta: unknown): meta is QuestionMeta {
  if (!meta || typeof meta !== 'object') return false;
  const rec = meta as Record<string, unknown>;
  if (rec.kind !== 'question') return false;
  if (!isConversationPhase(rec.phase)) return false;
  if (typeof rec.index !== 'number') return false;
  if (rec.tag !== undefined && typeof rec.tag !== 'string') return false;
  if (rec.maturityScale !== undefined && !Array.isArray(rec.maturityScale)) return false;
  return true;
}

interface PageProps {
  params: Promise<{
    workshopId: string;
    token: string;
  }>;
}

export default function DiscoveryConversationPage({ params }: PageProps) {
  const { workshopId, token } = use(params);
  const [hasStarted, setHasStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('intro');
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS');
  const [isPreparingReport, setIsPreparingReport] = useState(false);
  const [pendingVoiceTranscript, setPendingVoiceTranscript] = useState<string | null>(null);
  const [language, setLanguage] = useState('en');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [includeRegulation, setIncludeRegulation] = useState(true);
  const [draftMessage, setDraftMessage] = useState('');
  const [isPdfMode, setIsPdfMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('pdf') === '1';
  });
  const [report, setReport] = useState<null | {
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
    workshopName?: string | null;
    participantName?: string | null;
  }>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  const lastAiQuestionMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'AI' && isQuestionMeta(m.metadata));
  const lastQuestionMeta = isQuestionMeta(lastAiQuestionMessage?.metadata) ? lastAiQuestionMessage?.metadata : null;
  const questionNumber =
    lastQuestionMeta
      ? getOverallQuestionNumber(lastQuestionMeta.phase, lastQuestionMeta.index, includeRegulation)
      : null;
  const totalQuestions = getTotalQuestionCount(includeRegulation);
  const isTripleRatingQuestion = !!lastQuestionMeta && lastQuestionMeta.tag === 'triple_rating';
  const ratingQuestionText = isTripleRatingQuestion ? (lastAiQuestionMessage?.content || '') : '';
  const maturityScale =
    lastQuestionMeta && Array.isArray(lastQuestionMeta.maturityScale)
      ? lastQuestionMeta.maturityScale
      : undefined;

  const displayMessages =
    isTripleRatingQuestion && lastAiQuestionMessage?.id
      ? messages.filter((m) => m.id !== lastAiQuestionMessage.id)
      : messages;

  useEffect(() => {
    // Reset all state when token changes (new user/session)
    setHasStarted(false);
    setMessages([]);
    setSessionId(null);
    setCurrentPhase('intro');
    setPhaseProgress(0);
    setSessionStatus('IN_PROGRESS');
    setIsPreparingReport(false);
    setPendingVoiceTranscript(null);
    setLanguage('en');
    setVoiceEnabled(true);
    setIncludeRegulation(true);
    setIsLoading(false);
    setReport(null);
    setIsPdfMode(false);
  }, [workshopId, token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsPdfMode(params.get('pdf') === '1');
  }, []);

  useEffect(() => {
    if (!isPdfMode || hasStarted) return;
    setHasStarted(true);
    void initializeSession();
  }, [isPdfMode, hasStarted]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!pendingVoiceTranscript) return;
    if (!sessionId) return;
    if (isLoading) return;

    const text = pendingVoiceTranscript;
    setPendingVoiceTranscript(null);
    setDraftMessage('');
    void handleSendMessage(text);
  }, [pendingVoiceTranscript, sessionId, isLoading]);

  const initializeSession = async () => {
    try {
      const response = await fetch(`/api/conversation/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId, token }),
      });

      if (!response.ok) throw new Error('Failed to initialize session');

      const data = await response.json();
      setSessionId(data.sessionId);
      const incomingMessages = (data.messages || []) as Message[];
      const shouldPrependIntroHeader =
        incomingMessages.length > 0 &&
        incomingMessages[0]?.role === 'AI' &&
        isQuestionMeta(incomingMessages[0]?.metadata) &&
        incomingMessages[0].metadata.phase === 'intro' &&
        incomingMessages[0].metadata.index === 0;

      const hasIntroHeaderAlready =
        incomingMessages.length > 0 && incomingMessages[0]?.role === 'AI' && incomingMessages[0]?.content === 'About You';

      setMessages(
        shouldPrependIntroHeader && !hasIntroHeaderAlready
          ? ([
              {
                id: `section-intro-${Date.now()}`,
                role: 'AI',
                content: 'About You',
                phase: 'intro',
                createdAt: new Date(),
              } as Message,
              ...incomingMessages,
            ] as Message[])
          : incomingMessages
      );
      setCurrentPhase(data.currentPhase || 'intro');
      setPhaseProgress(data.phaseProgress || 0);
      setSessionStatus(data.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS');
      setLanguage(data.language || 'en');
      setVoiceEnabled(data.voiceEnabled ?? true);
      setIncludeRegulation(data.includeRegulation ?? true);

      const last = data.messages?.[data.messages.length - 1];
      if (last && last.role === 'AI' && (data.voiceEnabled ?? true)) {
        lastSpokenMessageIdRef.current = last.id;
        void speakWithOpenAI(last.content).catch(() => {});
      }

      if (data.status === 'COMPLETED' && data.sessionId) {
        setIsPreparingReport(true);
        const r = await fetch(`/api/conversation/report?sessionId=${encodeURIComponent(data.sessionId)}`);
        if (r.ok) {
          const reportData = await r.json();
          setReport({
            executiveSummary: reportData.executiveSummary,
            tone: reportData.tone,
            feedback: reportData.feedback,
            inputQuality: reportData.inputQuality,
            keyInsights: reportData.keyInsights,
            phaseInsights: reportData.phaseInsights,
            wordCloudThemes: reportData.wordCloudThemes,
            workshopName: reportData.workshopName,
            participantName: reportData.participantName,
          });
        }
        setIsPreparingReport(false);
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
      setIsPreparingReport(false);
    }
  };

  const restartDiscovery = async () => {
    if (!confirm('Start over? This will delete your current discovery session and restart from the beginning.')) {
      return;
    }

    setMessages([]);
    setSessionId(null);
    setCurrentPhase('intro');
    setPhaseProgress(0);
    setSessionStatus('IN_PROGRESS');
    setIsPreparingReport(false);
    setReport(null);
    setPendingVoiceTranscript(null);
    setDraftMessage('');
    setIsLoading(false);

    try {
      const response = await fetch(`/api/conversation/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId, token, restart: true }),
      });

      if (!response.ok) throw new Error('Failed to restart session');

      const data = await response.json();
      setSessionId(data.sessionId);
      const incomingMessages = (data.messages || []) as Message[];
      const shouldPrependIntroHeader =
        incomingMessages.length > 0 &&
        incomingMessages[0]?.role === 'AI' &&
        isQuestionMeta(incomingMessages[0]?.metadata) &&
        incomingMessages[0].metadata.phase === 'intro' &&
        incomingMessages[0].metadata.index === 0;

      const hasIntroHeaderAlready =
        incomingMessages.length > 0 && incomingMessages[0]?.role === 'AI' && incomingMessages[0]?.content === 'About You';

      setMessages(
        shouldPrependIntroHeader && !hasIntroHeaderAlready
          ? ([
              {
                id: `section-intro-${Date.now()}`,
                role: 'AI',
                content: 'About You',
                phase: 'intro',
                createdAt: new Date(),
              } as Message,
              ...incomingMessages,
            ] as Message[])
          : incomingMessages
      );

      setCurrentPhase(data.currentPhase || 'intro');
      setPhaseProgress(data.phaseProgress || 0);
      setSessionStatus(data.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS');
      setLanguage(data.language || 'en');
      setVoiceEnabled(data.voiceEnabled ?? true);
      setIncludeRegulation(data.includeRegulation ?? true);

      const last = incomingMessages?.[incomingMessages.length - 1];
      if (last && last.role === 'AI' && (data.voiceEnabled ?? true)) {
        lastSpokenMessageIdRef.current = last.id;
        void speakWithOpenAI(last.content).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to restart session:', e);
      alert('Failed to restart discovery');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'PARTICIPANT',
      content,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const phaseBefore = currentPhase;
      // Send user message and get AI response in one call
      const response = await fetch(`/api/conversation/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userMessage: content,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const data = await response.json();

      const transitions: Record<string, string> = {
        intro: "Thanks for that context. Let's dig into some specific areas, starting with people and skills.",
        people: "That's really helpful. Now let's talk about how things get done around here - decisions, processes, approvals.",
        corporate: "I appreciate your honesty. Let's shift to thinking about customers and their experience.",
        customer: "Great insights. Now let's talk about the tools and systems you work with every day.",
        technology: "Nearly there. A few questions about regulation and compliance - feel free to skip if these don't apply to your role.",
        regulation: 'Just a few final questions to wrap up.',
      };

      const sectionLabels: Record<string, string> = {
        intro: 'About You',
        people: 'People & Skills',
        corporate: 'How Things Work',
        customer: 'Customer Experience',
        technology: 'Technology & Tools',
        regulation: 'Regulation & Compliance',
        prioritization: 'Overall Perspective',
      };

      const phaseAfter = data.currentPhase as string;
      const phaseChanged = !!phaseAfter && phaseAfter !== phaseBefore;

      setCurrentPhase(data.currentPhase);
      setPhaseProgress(data.phaseProgress);
      if (typeof data.includeRegulation === 'boolean') setIncludeRegulation(data.includeRegulation);

      const now = Date.now();
      if (phaseChanged) {
        const transitionText =
          phaseBefore === 'technology' && phaseAfter === 'prioritization'
            ? 'Just a few final questions to wrap up.'
            : transitions[phaseBefore];
        const sectionHeader = sectionLabels[phaseAfter];

        const preMessages: Message[] = [];
        if (transitionText) {
          preMessages.push({
            id: `transition-${now}`,
            role: 'AI',
            content: transitionText,
            phase: phaseBefore,
            createdAt: new Date(),
          } as Message);
        }
        if (sectionHeader) {
          preMessages.push({
            id: `section-${now}`,
            role: 'AI',
            content: sectionHeader,
            phase: phaseAfter,
            createdAt: new Date(),
          } as Message);
        }

        window.setTimeout(() => {
          if (preMessages.length) {
            setMessages((prev) => [...prev, ...preMessages, data.message]);
          } else {
            setMessages((prev) => [...prev, data.message]);
          }

          setIsLoading(false);

          if (voiceEnabled) {
            if (lastSpokenMessageIdRef.current !== data.message.id) {
              lastSpokenMessageIdRef.current = data.message.id;
              void speakWithOpenAI(data.message.content).catch(() => {});
            }
          }
        }, 500);
      } else {
        setMessages((prev) => [...prev, data.message]);
        setIsLoading(false);

        if (voiceEnabled) {
          if (lastSpokenMessageIdRef.current !== data.message.id) {
            lastSpokenMessageIdRef.current = data.message.id;
            void speakWithOpenAI(data.message.content).catch(() => {});
          }
        }
      }

      if (data.status === 'COMPLETED') {
        setSessionStatus('COMPLETED');
        setIsPreparingReport(true);
        const r = await fetch(`/api/conversation/report?sessionId=${encodeURIComponent(sessionId)}`);
        if (r.ok) {
          const reportData = await r.json();
          setReport({
            executiveSummary: reportData.executiveSummary,
            tone: reportData.tone,
            feedback: reportData.feedback,
            inputQuality: reportData.inputQuality,
            keyInsights: reportData.keyInsights,
            phaseInsights: reportData.phaseInsights,
            wordCloudThemes: reportData.wordCloudThemes,
            workshopName: reportData.workshopName,
            participantName: reportData.participantName,
          });
        }
        setIsPreparingReport(false);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
      setIsPreparingReport(false);
    } finally {
      // Loading state is handled above so we can support delayed transitions.
    }
  };

  if (!hasStarted) {
    if (isPdfMode) {
      return (
        <div className="min-h-screen bg-white">
          <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-10">
            <div className="text-center text-lg font-semibold animate-pulse">
              Preparing your summary report from the dialogue session.
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b bg-background">
          <div className="px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Image src="/ethenta-logo.png" alt="Ethenta" width={120} height={32} className="h-8 w-auto" priority />
            </div>
          </div>
          <Image
            src="/Dream.PNG"
            alt="DREAM"
            width={1412}
            height={510}
            className="w-full h-auto max-h-40 object-contain"
            priority
            sizes="100vw"
          />
        </div>

        <div className="container max-w-2xl mx-auto px-4 py-10">
          <h1 className="text-3xl font-semibold text-[#1a1a2e]">DREAM Discovery</h1>
          <h2 className="text-lg font-medium text-[#4a90a4] mt-1">Diagnostic Questionnaire</h2>

          <div className="mt-6 whitespace-pre-wrap text-base text-foreground">
            {"Welcome to the DREAM Discovery questionnaire.\n\nI'm going to ask you about your experience working here - what's going well, what's frustrating, and where you see opportunities for improvement.\n\nThis takes about 15-20 minutes. Your responses are confidential and will help shape the upcoming DREAM session.\n\nReady to begin?"}
          </div>

          <div className="mt-8">
            <button
              type="button"
              className="bg-[#4a90a4] text-white px-8 py-3 rounded-lg shadow-sm"
              onClick={async () => {
                setHasStarted(true);
                await initializeSession();
              }}
            >
              Begin
            </button>
          </div>

          <div className="mt-10 text-xs text-muted-foreground">© Ethenta Ltd</div>
        </div>
      </div>
    );
  }

  if (isPdfMode) {
    return (
      <div className="min-h-screen bg-white">
        {(sessionStatus === 'COMPLETED' && (isPreparingReport || !report)) ? (
          <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-10">
            <div className="text-center text-lg font-semibold animate-pulse">
              Preparing your summary report from the dialogue session.
            </div>
          </div>
        ) : (sessionStatus === 'COMPLETED' && report) ? (
          <ConversationReport
            executiveSummary={report.executiveSummary}
            tone={report.tone}
            feedback={report.feedback}
            inputQuality={report.inputQuality}
            keyInsights={report.keyInsights}
            phaseInsights={report.phaseInsights}
            wordCloudThemes={report.wordCloudThemes}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="flex flex-col flex-1 lg:mr-80">
        <div className="border-b bg-background">
          <div className="px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Image src="/ethenta-logo.png" alt="Ethenta" width={120} height={32} className="h-8 w-auto" priority />
            </div>
            <div className="no-print flex shrink-0 items-center gap-2 whitespace-nowrap">
              {typeof questionNumber === 'number' && (
                <div className="text-xs text-muted-foreground">
                  Question <span className="font-medium text-foreground">{questionNumber}</span> of{' '}
                  <span className="font-medium text-foreground">{totalQuestions}</span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={restartDiscovery}>
                Start Over
              </Button>
            </div>
          </div>
          <Image
            src="/Dream.PNG"
            alt="DREAM"
            width={1412}
            height={510}
            className="w-full h-auto max-h-28 object-contain"
            priority
            sizes="100vw"
          />
        </div>
        <ScrollArea className="flex-1 pb-32 sm:pb-40" ref={scrollRef}>
          <>
            {(sessionStatus === 'COMPLETED' && (isPreparingReport || !report)) ? (
              <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-10">
                <div className="text-center text-lg font-semibold animate-pulse">
                  Preparing your summary report from the dialogue session.
                </div>
              </div>
            ) : (sessionStatus === 'COMPLETED' && report) ? (
              <ConversationReport
                executiveSummary={report.executiveSummary}
                tone={report.tone}
                feedback={report.feedback}
                inputQuality={report.inputQuality}
                keyInsights={report.keyInsights}
                phaseInsights={report.phaseInsights}
                wordCloudThemes={report.wordCloudThemes}
                pdfMode={isPdfMode}
                onDownloadPdf={async () => {
                  try {
                    const response = await fetch(`/api/conversation/report/pdf?ts=${Date.now()}` , {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        participantName: report.participantName || 'Participant',
                        workshopName: report.workshopName,
                        discoveryUrl: window.location.href,
                        executiveSummary: report.executiveSummary,
                        tone: report.tone,
                        feedback: report.feedback,
                        inputQuality: report.inputQuality,
                        keyInsights: report.keyInsights,
                        phaseInsights: report.phaseInsights.map((p) => ({
                          phase: p.phase,
                          currentScore: p.currentScore,
                          targetScore: p.targetScore,
                          projectedScore: p.projectedScore,
                        })),
                      }),
                    });

                    if (!response.ok) throw new Error('Failed to generate PDF');
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'DREAM-Discovery-Summary-Report.pdf';
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error(error);
                    alert('Failed to generate PDF. Please try again.');
                  }
                }}
              />
            ) : (
              <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                {displayMessages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    timestamp={message.createdAt}
                  />
                ))}
                {isLoading && <TypingIndicator />}
              </div>
            )}
            <div aria-hidden className="h-40 sm:h-44" />
            <div ref={bottomRef} className="h-px w-full" />
          </>
        </ScrollArea>

        {sessionStatus !== 'COMPLETED' && (
          <div className="fixed bottom-0 left-0 right-0 lg:right-80 border-t bg-background/95 backdrop-blur safe-area-bottom">
            <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
              <div className="mb-3 pb-3 border-b">
                <LanguageSelector
                  value={language}
                  onChange={async (newLang) => {
                    setLanguage(newLang);
                    if (sessionId) {
                      await fetch(`/api/conversation/update-preferences`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId, language: newLang }),
                      });
                    }
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                {isTripleRatingQuestion && (
                  <TripleRatingInput
                    disabled={isLoading}
                    maturityScale={maturityScale}
                    questionText={ratingQuestionText}
                    onSubmit={(value) => {
                      handleSendMessage(value);
                      setDraftMessage('');
                    }}
                  />
                )}
                <ChatInput
                  onSend={(content) => {
                    handleSendMessage(content);
                    setDraftMessage('');
                  }}
                  disabled={isLoading}
                  placeholder={isTripleRatingQuestion ? 'Use the ratings above, or type your response…' : 'Type your response, or use Start Recording…'}
                  value={draftMessage}
                  onChange={setDraftMessage}
                  singleLine
                  showSendButton={false}
                />

                <div className="w-full flex items-center justify-end gap-2">
                  <WhisperVoiceInput
                    language={language}
                    onTranscript={(text: string) => {
                      const cleaned = (text || '').trim();
                      if (!cleaned) return;
                      setPendingVoiceTranscript(cleaned);
                    }}
                    voiceEnabled={voiceEnabled}
                    onVoiceToggle={async (enabled: boolean) => {
                      setTtsEnabled(enabled);
                      setVoiceEnabled(enabled);
                      if (sessionId) {
                        await fetch(`/api/conversation/update-preferences`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ sessionId, voiceEnabled: enabled }),
                        });
                      }

                      if (enabled) {
                        const lastAi = [...messages].reverse().find((m) => m.role === 'AI');
                        if (lastAi && lastSpokenMessageIdRef.current !== lastAi.id) {
                          lastSpokenMessageIdRef.current = lastAi.id;
                          void speakWithOpenAI(lastAi.content).catch(() => {});
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
                Use Start Recording / Stop Recording to dictate. Your transcription will be sent automatically.
              </p>
            </div>
          </div>
        )}
      </div>

      <ProgressIndicator currentPhase={currentPhase} phaseProgress={phaseProgress} includeRegulation={includeRegulation} />
    </div>
  );
}
