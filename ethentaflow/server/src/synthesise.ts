// Post-session synthesis. Reads a session directory, calls Claude Opus 4.7,
// writes session.json with the structured synthesis.
//
// Can be run programmatically after a session ends, or as a CLI tool:
//   npx tsx src/synthesise.ts <sessionDir>

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, '..', '..', 'prompts', 'session-synthesiser.md');

function loadSystemPrompt(): string {
  const md = readFileSync(PROMPT_PATH, 'utf-8');
  const match = md.match(/## System prompt\s*```([\s\S]*?)```/);
  if (!match) throw new Error('Could not parse system prompt from session-synthesiser.md');
  return match[1].trim();
}

export async function synthesiseSession(sessionDir: string): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');

  const metadataPath = join(sessionDir, 'metadata.json');
  const turnsPath = join(sessionDir, 'turns.jsonl');
  const probesPath = join(sessionDir, 'probes.jsonl');

  if (!existsSync(metadataPath)) throw new Error(`No metadata.json in ${sessionDir}`);

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
  const turns = readJsonl(turnsPath);
  const probes = readJsonl(probesPath);

  const startedAt = metadata.startedAt as number;
  const endedAt = turns.length > 0 ? (turns[turns.length - 1].endedAt as number) : startedAt;
  const durationSeconds = Math.round((endedAt - startedAt) / 1000);

  const turnLog = turns.map(t => {
    const signals = Array.isArray(t.signalsDetected) && t.signalsDetected.length > 0
      ? t.signalsDetected.map((s: any) => `${s.type}@${s.confidence.toFixed(2)}`).join(',')
      : 'none';
    return `[${t.turnId} | ${t.speaker} | ${t.lens} | ${signals} | depth ${t.depthScore}] ${t.finalTranscript}`;
  }).join('\n');

  const probeLog = probes.map(p => {
    return `[${p.strategy ?? 'unknown'}] ${p.text}`;
  }).join('\n');

  const userMessage = [
    `Session metadata:`,
    `- sessionId: ${metadata.sessionId}`,
    `- startedAt: ${startedAt}`,
    `- endedAt: ${endedAt}`,
    `- durationSeconds: ${durationSeconds}`,
    `- participantName: ${metadata.participantName ?? 'unknown'}`,
    '',
    'Turn log (each turn includes speaker, text, lens, signals detected, and depth score):',
    '',
    turnLog || '(none)',
    '',
    'Probe log (probes asked by the system, for context on what was drilled):',
    '',
    probeLog || '(none)',
    '',
    'Produce the synthesis JSON.',
  ].join('\n');

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4000,
    system: loadSystemPrompt(),
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  let synthesis: unknown;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON in response');
    synthesis = JSON.parse(match[0]);
  } catch (err) {
    console.error('synthesis parse failed, saving raw output');
    writeFileSync(join(sessionDir, 'synthesis-failed.txt'), raw);
    throw err;
  }

  writeFileSync(join(sessionDir, 'session.json'), JSON.stringify(synthesis, null, 2));
  return synthesis;
}

function readJsonl(path: string): any[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  return lines.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// CLI entry point
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const sessionDir = process.argv[2];
  if (!sessionDir) {
    console.error('Usage: tsx src/synthesise.ts <sessionDir>');
    process.exit(1);
  }
  synthesiseSession(sessionDir)
    .then(s => {
      console.log('Synthesis written to', join(sessionDir, 'session.json'));
      console.log(JSON.stringify(s, null, 2));
    })
    .catch(err => {
      console.error('Synthesis failed:', err);
      process.exit(1);
    });
}
