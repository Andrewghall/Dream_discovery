export type TranscriptionSource = 'zoom' | 'deepgram' | 'whisper';

export type NormalizedTranscriptChunk = {
  speakerId: string | null;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number | null;
  source: TranscriptionSource;
};
