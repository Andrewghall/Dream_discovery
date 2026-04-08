import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { env } from '@/lib/env'

// Simple keyword fallback when no API key
function keywordScore(transcript: string): number {
  const t = transcript.toLowerCase()
  if (/leading|innovative|industry.leading|benchmark|ahead|transformative|best.in.class/.test(t)) return 5
  if (/measured|data.driven|optimis|tracking|kpi|systematically|continuously|evidence.based/.test(t)) return 4
  if (/defined|documented|structured|consistent|established|framework|formal|process|clear/.test(t)) return 3
  if (/some|beginning|starting|emerging|trying|sometimes|occasional|exploring|working.on|improving/.test(t)) return 2
  return 1
}

const SYSTEM = `You are assessing an organisation's capability maturity from what someone has said.

Maturity scale:
1 - Ad Hoc: reactive, no formal approach
2 - Emerging: some awareness, fragmented
3 - Defined: documented, consistent
4 - Managed: measured, data-driven
5 - Leading: innovative, adaptive, industry-leading

From what they said, determine the maturity level AND write a SHORT (1-2 sentence) warm reflection.

The reflection must:
- Validate what they said — make them feel genuinely heard
- Show a sharp insight about what their answer reveals
- NEVER mention level numbers or maturity labels
- NEVER be condescending or judgmental
- Sound like a brilliant consultant who has seen this pattern many times and genuinely gets it
- Be warm, human, and specific — not generic

Respond ONLY with valid JSON: { "level": number, "reflection": string }`

export async function POST(req: NextRequest) {
  try {
    const { question, dimension, transcript } = await req.json() as { question: string; dimension: string; transcript: string }

    if (!transcript?.trim()) {
      return NextResponse.json({ level: 2, reflection: "Thank you for sharing that." })
    }

    if (!env.OPENAI_API_KEY) {
      // Keyword fallback — still returns a meaningful response
      const level = keywordScore(transcript)
      const fallbacks: Record<number, string> = {
        1: "There's a real opportunity here — and being honest about where you are is the first step to changing it.",
        2: "You're not alone in this. Many organisations are exactly at this point — some foundations in place, but not yet joined up.",
        3: "That's a solid base. The question now is what it would take to move from consistent to genuinely optimised.",
        4: "That's strong. The organisations that reach the next level are usually the ones who find the one constraint they haven't yet named.",
        5: "That's genuinely impressive. The work at this level is about sustaining it and finding the edges where the next breakthrough lives.",
      }
      return NextResponse.json({ level, reflection: fallbacks[level] })
    }

    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Dimension: ${dimension}\nQuestion: ${question}\nWhat they said: "${transcript}"` },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 200,
    })

    const parsed = JSON.parse(response.choices[0].message.content || '{}') as { level?: number; reflection?: string }
    const level = Math.min(5, Math.max(1, Math.round(parsed.level || 2)))
    const reflection = parsed.reflection || "That gives us a clear picture — thank you."

    return NextResponse.json({ level, reflection })
  } catch (err) {
    console.error('[assess/interpret]', err)
    return NextResponse.json({ level: 2, reflection: "That gives us a clear picture of where things stand." })
  }
}
