// Capture path - writes audio, transcripts, turns, and probes to disk.
// Runs in parallel with the live path. Never blocks it.

import { createWriteStream, mkdirSync, writeFileSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { Turn, ProbeCandidate, DeepgramTranscript } from './types.js';

// Read lazily so dotenv has a chance to override the env var before this is used
function getSessionsRoot(): string {
  return process.env.ETHENTAFLOW_SESSIONS_DIR ?? './sessions';
}

export interface CaptureHandle {
  writeUserAudio: (chunk: Buffer) => void;
  writeSystemAudio: (chunk: Buffer) => void;
  writeFinalTranscript: (msg: DeepgramTranscript) => void;
  writeTurn: (turn: Turn) => void;
  writeProbe: (probe: ProbeCandidate) => void;
  close: () => Promise<void>;
  sessionDir: string;
}

export function startCapture(sessionId: string, participantName?: string): CaptureHandle {
  const sessionDir = join(getSessionsRoot(), sessionId);
  mkdirSync(sessionDir, { recursive: true });

  const metadata = {
    sessionId,
    participantName: participantName ?? null,
    startedAt: Date.now(),
  };
  // Write metadata synchronously - small file, avoids races on quick close
  const metadataFile = join(sessionDir, 'metadata.json');
  writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

  const transcriptStream = createWriteStream(join(sessionDir, 'transcript.jsonl'), { flags: 'a' });
  const turnsStream = createWriteStream(join(sessionDir, 'turns.jsonl'), { flags: 'a' });
  const probesStream = createWriteStream(join(sessionDir, 'probes.jsonl'), { flags: 'a' });

  // Audio encoding: pipe raw PCM through ffmpeg to webm/opus
  const userAudioProc = startFfmpegEncoder(join(sessionDir, 'audio-user.webm'), 16000);
  const systemAudioProc = startFfmpegEncoder(join(sessionDir, 'audio-system.webm'), 24000);

  return {
    sessionDir,
    writeUserAudio: chunk => {
      try { userAudioProc.stdin?.write(chunk); } catch { /* ignore */ }
    },
    writeSystemAudio: chunk => {
      try { systemAudioProc.stdin?.write(chunk); } catch { /* ignore */ }
    },
    writeFinalTranscript: msg => {
      if (!msg.is_final) return;
      const alt = msg.channel.alternatives[0];
      if (!alt?.transcript) return;
      const record = {
        t: Date.now(),
        speaker: 'user',
        text: alt.transcript,
        words: alt.words?.map(w => ({ w: w.word, s: w.start, e: w.end, c: w.confidence })),
      };
      transcriptStream.write(JSON.stringify(record) + '\n');
    },
    writeTurn: turn => {
      turnsStream.write(JSON.stringify(turn) + '\n');
    },
    writeProbe: probe => {
      probesStream.write(JSON.stringify({ t: Date.now(), ...probe }) + '\n');
    },
    close: async () => {
      transcriptStream.end();
      turnsStream.end();
      probesStream.end();
      try { userAudioProc.stdin?.end(); } catch { /* ignore */ }
      try { systemAudioProc.stdin?.end(); } catch { /* ignore */ }
      await Promise.all([
        new Promise<void>(r => userAudioProc.on('exit', () => r())),
        new Promise<void>(r => systemAudioProc.on('exit', () => r())),
      ]);
    },
  };
}

function startFfmpegEncoder(outputPath: string, sampleRate: number): ChildProcess {
  // Expects raw linear16 PCM on stdin, writes opus in webm container.
  const proc = spawn('ffmpeg', [
    '-f', 's16le',
    '-ar', String(sampleRate),
    '-ac', '1',
    '-i', 'pipe:0',
    '-c:a', 'libopus',
    '-b:a', '32k',
    '-y',
    outputPath,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  proc.on('error', err => console.error(`[capture] ffmpeg spawn error (${outputPath}):`, err.message));
  proc.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) console.error(`[capture] ffmpeg exited code=${code} (${outputPath})`);
  });
  // Log ffmpeg stderr only on errors (normally very noisy)
  let stderrBuf = '';
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString();
    // Only print last line if it looks like an error
    const lines = stderrBuf.split('\n');
    stderrBuf = lines[lines.length - 1] ?? '';
  });

  return proc;
}
