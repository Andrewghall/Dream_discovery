/**
 * DREAM Landing Page — Public Chat API
 *
 * Streaming SSE endpoint for the GPT-powered Q&A bar.
 * No authentication required. Rate-limited by IP.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildDreamChatSystemPrompt } from '@/lib/dream-landing/knowledge-base';

export const maxDuration = 60;

const MODEL = 'gpt-4o-mini';
const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY = 6;

// ── Simple in-memory rate limiter ────────────────────────────

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 20;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// ── Types ────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── POST handler ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Please wait a moment before asking another question.' },
        { status: 429 },
      );
    }

    // Parse body
    const body = await request.json();
    const question = String(body.question || '').trim().slice(0, MAX_QUESTION_LENGTH);
    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history.slice(-MAX_HISTORY)
      : [];
    const isVoice = Boolean(body.voice);

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    // Build messages
    const basePrompt = buildDreamChatSystemPrompt();
    const systemPrompt = isVoice
      ? basePrompt + `\n\n## VOICE MODE — CRITICAL\nThis response will be spoken aloud immediately. You MUST write in plain conversational prose only. Absolutely no markdown of any kind: no headers (#), no bold (**), no italic (*), no bullet points (-), no numbered lists (1. 2. 3.), no backticks, no horizontal rules. Write flowing sentences and paragraphs as if speaking naturally in conversation.`
      : basePrompt;
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: 'user', content: question });

    // Stream response
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const stream = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages,
      stream: true,
      max_tokens: 1500,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
              );
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (error) {
          console.error('[DreamChat] Stream error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[DreamChat POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 },
    );
  }
}
