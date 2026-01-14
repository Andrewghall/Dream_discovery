'use client';

import { use, useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/components/chat/chat-message';
import { ChatInput } from '@/components/chat/chat-input';
import { ProgressIndicator } from '@/components/chat/progress-indicator';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { WhisperVoiceInput } from '@/components/chat/whisper-voice-input';
import { LanguageSelector } from '@/components/chat/language-selector';
import { ConversationPhase, Message } from '@/lib/types/conversation';
import { speakWithOpenAI } from '@/lib/utils/openai-tts';
import { ConversationReport, PhaseInsight } from '@/components/report/conversation-report';

interface PageProps {
  params: Promise<{
    workshopId: string;
    token: string;
  }>;
}

export default function DiscoveryConversationPage({ params }: PageProps) {
  const { workshopId, token } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('intro');
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS');
  const [deployInfo, setDeployInfo] = useState<null | {
    sha: string | null;
    ref: string | null;
    env: string | null;
    deploymentUrl: string | null;
    serverTime: string;
  }>(null);
  const [pendingVoiceTranscript, setPendingVoiceTranscript] = useState<string | null>(null);
  const [language, setLanguage] = useState('en');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [includeRegulation, setIncludeRegulation] = useState(true);
  const [showLanguageSelector, setShowLanguageSelector] = useState(true);
  const [draftMessage, setDraftMessage] = useState('');
  const [report, setReport] = useState<null | {
    summary: string;
    phaseInsights: PhaseInsight[];
    ambitionWordCloud: Array<{ text: string; value: number }>;
    realityWordCloud: Array<{ text: string; value: number }>;
  }>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset all state when token changes (new user/session)
    setMessages([]);
    setSessionId(null);
    setCurrentPhase('intro');
    setPhaseProgress(0);
    setSessionStatus('IN_PROGRESS');
    setDeployInfo(null);
    setPendingVoiceTranscript(null);
    setLanguage('en');
    setVoiceEnabled(true);
    setIncludeRegulation(true);
    setShowLanguageSelector(true);
    setIsLoading(false);
    setReport(null);
    
    // Initialize conversation session
    initializeSession();
  }, [workshopId, token]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/version?bust=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        setDeployInfo(data);
      } catch {
        setDeployInfo(null);
      }
    })();
  }, [workshopId, token]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!pendingVoiceTranscript) return;
    if (!sessionId) return;
    if (isLoading) return;

    const text = pendingVoiceTranscript;
    setPendingVoiceTranscript(null);
    setDraftMessage('');
    setShowLanguageSelector(false);
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
      setMessages(data.messages || []);
      setCurrentPhase(data.currentPhase || 'intro');
      setPhaseProgress(data.phaseProgress || 0);
      setSessionStatus(data.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS');
      setLanguage(data.language || 'en');
      setVoiceEnabled(data.voiceEnabled ?? true);
      setIncludeRegulation(data.includeRegulation ?? true);
      
      // Hide language selector after first message
      if (data.messages && data.messages.length > 0) {
        setShowLanguageSelector(false);
      }

      const last = data.messages?.[data.messages.length - 1];
      if (last && last.role === 'AI' && (data.voiceEnabled ?? true)) {
        lastSpokenMessageIdRef.current = last.id;
        void speakWithOpenAI(last.content).catch(() => {});
      }

      if (data.status === 'COMPLETED' && data.sessionId) {
        const r = await fetch(`/api/conversation/report?sessionId=${encodeURIComponent(data.sessionId)}`);
        if (r.ok) {
          const reportData = await r.json();
          setReport({
            summary: reportData.summary,
            phaseInsights: reportData.phaseInsights,
            ambitionWordCloud: reportData.ambitionWordCloud,
            realityWordCloud: reportData.realityWordCloud,
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
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
      
      setMessages((prev) => [...prev, data.message]);
      setCurrentPhase(data.currentPhase);
      setPhaseProgress(data.phaseProgress);

      if (data.status === 'COMPLETED') {
        setSessionStatus('COMPLETED');
        const r = await fetch(`/api/conversation/report?sessionId=${encodeURIComponent(sessionId)}`);
        if (r.ok) {
          const reportData = await r.json();
          setReport({
            summary: reportData.summary,
            phaseInsights: reportData.phaseInsights,
            ambitionWordCloud: reportData.ambitionWordCloud,
            realityWordCloud: reportData.realityWordCloud,
          });
        }
      }
      
      // Speak the AI response if voice is enabled
      if (voiceEnabled) {
        if (lastSpokenMessageIdRef.current !== data.message.id) {
          lastSpokenMessageIdRef.current = data.message.id;
          void speakWithOpenAI(data.message.content).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex flex-col flex-1 lg:mr-80">
        <div className="bg-muted/50 border-b px-4 py-1 text-xs text-muted-foreground">
          Build: Whisper+OpenAI-TTS | Voice: Nova (Female) | Speed: 1.15x
          {deployInfo?.sha ? ` | Deploy: ${deployInfo.env || 'unknown'} ${deployInfo.ref || ''} ${deployInfo.sha.slice(0, 7)}` : ''}
        </div>
        <ScrollArea className="flex-1 pb-32 sm:pb-40" ref={scrollRef}>
          {sessionStatus === 'COMPLETED' && report ? (
            <ConversationReport
              summary={report.summary}
              phaseInsights={report.phaseInsights}
              ambitionWordCloud={report.ambitionWordCloud}
              realityWordCloud={report.realityWordCloud}
            />
          ) : (
            <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
              {messages.map((message) => (
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
        </ScrollArea>

        {sessionStatus !== 'COMPLETED' && (
          <div className="fixed bottom-0 left-0 right-0 lg:right-80 border-t bg-background/95 backdrop-blur safe-area-bottom">
            <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
              {showLanguageSelector && (
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
              )}

              <div className="flex flex-col gap-2">
                <ChatInput
                  onSend={(content) => {
                    handleSendMessage(content);
                    setShowLanguageSelector(false);
                    setDraftMessage('');
                  }}
                  disabled={isLoading}
                  placeholder="Type your response, or use Start Recording…"
                  value={draftMessage}
                  onChange={setDraftMessage}
                  singleLine
                  showSendButton={false}
                />

                <div className="w-full flex items-center justify-end gap-2">
                  <WhisperVoiceInput
                    onTranscript={(text: string) => {
                      const cleaned = (text || '').trim();
                      if (!cleaned) return;
                      setPendingVoiceTranscript(cleaned);
                      setShowLanguageSelector(false);
                    }}
                    voiceEnabled={voiceEnabled}
                    onVoiceToggle={async (enabled: boolean) => {
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
