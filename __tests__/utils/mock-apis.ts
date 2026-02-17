/**
 * Mock External APIs
 * Mock functions for OpenAI, Resend, Deepgram, etc.
 */

import { vi } from 'vitest';

// Mock OpenAI
export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Mock AI response',
            role: 'assistant',
          },
        }],
      }),
    },
  },
};

// Mock Anthropic
export const mockAnthropic = {
  messages: {
    create: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mock Claude response' }],
    }),
  },
};

// Mock Resend (email)
export const mockResend = {
  emails: {
    send: vi.fn().mockResolvedValue({
      id: 'mock-email-id',
      from: 'noreply@example.com',
      to: 'test@example.com',
    }),
  },
};

// Mock Deepgram (transcription)
export const mockDeepgram = {
  transcription: {
    preRecorded: vi.fn().mockResolvedValue({
      results: {
        channels: [{
          alternatives: [{
            transcript: 'Mock transcription text',
            confidence: 0.95,
          }],
        }],
      },
    }),
  },
};

// Mock CaptureAPI
export const mockCaptureAPI = {
  transcribeAudio: vi.fn().mockResolvedValue({
    success: true,
    transcription: {
      rawText: 'Raw transcript text',
      cleanText: 'Clean transcript text',
      source: 'deepgram',
      confidence: 0.95,
      speaker: 0,
    },
    analysis: {
      entities: [],
      emotionalTone: 'neutral',
      confidence: 0.9,
    },
    metadata: {
      processingTimeMs: 100,
      wasOnline: true,
      slmUsed: true,
      slmModel: 'test-model',
    },
  }),
};

// Reset all mocks
export const resetMockAPIs = () => {
  mockOpenAI.chat.completions.create.mockClear();
  mockAnthropic.messages.create.mockClear();
  mockResend.emails.send.mockClear();
  mockDeepgram.transcription.preRecorded.mockClear();
  mockCaptureAPI.transcribeAudio.mockClear();
};
