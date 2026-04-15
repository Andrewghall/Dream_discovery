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

// ── Quick company research via Tavily ────────────────────────

interface TavilyResult { title: string; content: string; url: string }
interface TavilyResponse { results?: TavilyResult[] }

const BANNED_RESEARCH_DOMAINS = [
  'glassdoor.com', 'indeed.com', 'reddit.com', 'quora.com',
  'comparably.com', 'simplywall.st', 'businessmodelcanvastemplate.com',
];

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'basic',
      max_results: 3,
      include_raw_content: false,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json() as TavilyResponse;
  return (data.results ?? []).filter(r =>
    !BANNED_RESEARCH_DOMAINS.some(d => r.url?.includes(d))
  );
}

async function quickCompanyResearch(company: string): Promise<string> {
  try {
    const [overviewResults, challengeResults] = await Promise.all([
      tavilySearch(`${company} company strategy business overview 2024 2025`),
      tavilySearch(`${company} business challenges transformation priorities`),
    ]);

    const all = [...overviewResults, ...challengeResults].slice(0, 5);
    if (all.length === 0) return '';

    const snippets = all
      .map(r => `• ${r.title}: ${r.content?.slice(0, 250).replace(/\n/g, ' ')}`)
      .join('\n');

    return `\n\n## LIVE RESEARCH — ${company}\nThe following was retrieved via real-time web search. Use it to ground your response in what is actually known about this company. Reference it naturally ("based on what I can see about ${company}…"). Do NOT fabricate details beyond what is shown here.\n\n${snippets}`;
  } catch {
    return '';
  }
}

/** Extract the most prominent company/client name from the question */
function detectCompanyName(question: string): string | null {
  const STOP_WORDS = new Set([
    'DREAM', 'Ethenta', 'EthentaFlow', 'Discovery', 'Reimagine', 'Apply', 'Mobilise',
    'What', 'How', 'Why', 'Who', 'Can', 'Could', 'Would', 'Should', 'Does', 'Is',
    'The', 'This', 'That', 'These', 'Those', 'When', 'Where', 'Which',
    'COM-B', 'TLM', 'AI', 'Contact', 'Centre', 'Center',
  ]);

  // Normalise — strip possessives so "Marks and Spencer's" → "Marks and Spencer"
  const q = question.replace(/'\s*s\b/gi, '').replace(/\u2019s\b/g, '');

  // Pattern 1: well-known multi-word company names with connectors (Marks and Spencer, Boots and Co, etc.)
  const connectorPattern = /\b([A-Z][a-zA-Z]{1,}(?:\s+(?:and|&|of|the)\s+[A-Z][a-zA-Z]{1,}){1,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = connectorPattern.exec(q)) !== null) {
    const name = m[1].trim();
    if (!STOP_WORDS.has(name.split(/\s+/)[0])) return name;
  }

  // Pattern 2: explicit sales context phrases — capture whatever follows
  const contextPatterns: RegExp[] = [
    /\bfor\s+([A-Z][a-zA-Z0-9&.\s]{2,40}?)(?:\s+(?:contact|specifically|in\s+particular)|\s*[,?.]|$)/,
    /\bwith\s+([A-Z][a-zA-Z0-9&.\s]{2,30}?)(?:'s)?\s+(?:contact\s+cent(?:er|re)|work|bid|tender|team|contract)/i,
    /\b(?:client|company|organisation|organization|firm|prospect)\s+(?:called\s+|like\s+)?([A-Z][a-zA-Z0-9&.\s]{2,30}?)(?:\s*[,?]|$)/i,
    /\bworking\s+with\s+([A-Z][a-zA-Z0-9&.\s]{2,30}?)(?:\s+and\b|\s*[,?]|$)/i,
    /\bpitch(?:ing)?\s+(?:to\s+)?([A-Z][a-zA-Z0-9&.\s]{2,30}?)(?:\s+as\b|\s+a\b|\s*[,?]|$)/i,
    /\bhelp\s+([A-Z][a-zA-Z0-9&.\s]{2,30}?)\s+(?:reimagin|transform|understand|think)/i,
    /\b([A-Z][a-zA-Z0-9&]{2,}(?:\s+[A-Z][a-zA-Z0-9&]{2,}){0,3})\s+(?:could|can|would|might|should)\s+(?:use|benefit|leverage|deploy)/,
  ];

  for (const pattern of contextPatterns) {
    const match = q.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim().replace(/\s+/g, ' ');
      const first = name.split(/\s+/)[0];
      if (name.length >= 3 && !STOP_WORDS.has(first) && !STOP_WORDS.has(name)) return name;
    }
  }

  // Pattern 3: single well-capitalised word that looks like a brand/company name
  // (e.g. "Capita", "Endava", "Concentrix") — only if it appears near sales keywords
  const singleWordPattern = /\b([A-Z][a-z]{3,})\b/g;
  const salesKeywords = /\b(?:bid|tender|pitch|sell|client|contact\s*cent(?:er|re)|contract|opportunity|proposal)\b/i;
  if (salesKeywords.test(q)) {
    while ((m = singleWordPattern.exec(q)) !== null) {
      const name = m[1];
      if (!STOP_WORDS.has(name)) return name;
    }
  }

  return null;
}

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

    // Quick company research — run before GPT if a company name is detected
    const detectedCompany = detectCompanyName(question);
    const researchContext = detectedCompany
      ? await quickCompanyResearch(detectedCompany)
      : '';

    // Build messages
    const basePrompt = buildDreamChatSystemPrompt() + researchContext;
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
