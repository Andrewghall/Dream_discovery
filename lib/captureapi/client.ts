/**
 * CaptureAPI Client for DREAM
 *
 * Provides TypeScript client for calling CaptureAPI transcription endpoints
 * with SLM processing for transcript cleanup and entity extraction.
 */

// ============================================================================
// Types
// ============================================================================

export interface CaptureAPIEntity {
  type: 'noun_phrase' | 'verb_phrase' | 'time_reference' | 'measurement' | 'location'
  value: string
}

export interface CaptureAPITranscription {
  rawText: string
  cleanText: string
  source: 'deepgram' | 'whisper'
  confidence: number | null
  speaker: number | null  // Speaker ID from diarization (0, 1, 2, etc.)
}

export interface CaptureAPIAnalysis {
  entities: CaptureAPIEntity[]
  emotionalTone: 'positive' | 'neutral' | 'concerned' | 'critical'
  confidence: number
}

export interface CaptureAPIMetadata {
  processingTimeMs: number
  wasOnline: boolean
  slmUsed: boolean
  slmModel: string | null
}

export interface CaptureAPIResponse {
  success: boolean
  transcription: CaptureAPITranscription
  analysis: CaptureAPIAnalysis
  metadata: CaptureAPIMetadata
}

export interface TranscribeOptions {
  mode?: 'workshop' | 'field_asset' | 'general'
  enableSLM?: boolean
}

// ============================================================================
// Client
// ============================================================================

/**
 * Get CaptureAPI base URL from environment
 */
function getCaptureAPIURL(): string {
  const url = process.env.NEXT_PUBLIC_CAPTUREAPI_URL || process.env.CAPTUREAPI_URL

  if (!url) {
    throw new Error(
      'CaptureAPI URL not configured. Set NEXT_PUBLIC_CAPTUREAPI_URL or CAPTUREAPI_URL environment variable.'
    )
  }

  return url
}

/**
 * Transcribe audio blob using CaptureAPI with SLM processing.
 *
 * @param audioBlob - Audio data as Blob
 * @param options - Transcription options
 * @returns Promise with transcription, analysis, and metadata
 *
 * @throws Error if transcription fails or CaptureAPI is unavailable
 *
 * @example
 * ```typescript
 * const result = await transcribeAudio(audioBlob, {
 *   mode: 'workshop',
 *   enableSLM: true
 * })
 *
 * console.log('Clean:', result.transcription.cleanText)
 * console.log('Entities:', result.analysis.entities)
 * console.log('Tone:', result.analysis.emotionalTone)
 * ```
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options: TranscribeOptions = {}
): Promise<CaptureAPIResponse> {
  const {
    mode = 'workshop',
    enableSLM = true,
  } = options

  const baseURL = getCaptureAPIURL()
  const endpoint = `${baseURL}/api/v1/transcribe`

  try {
    // Build FormData
    const formData = new FormData()
    formData.append('audio', audioBlob, 'audio.webm')
    formData.append('mode', mode)
    formData.append('enable_slm', String(enableSLM))

    // Call CaptureAPI
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `CaptureAPI request failed with status ${response.status}: ${errorText}`
      )
    }

    const result: any = await response.json()

    if (!result.success) {
      throw new Error('CaptureAPI returned success=false')
    }

    // Handle new response format with utterances array
    if (result.utterances && Array.isArray(result.utterances)) {
      // Combine all utterances into a single transcription
      const allRawText = result.utterances.map((u: any) => u.rawText).join(' ')
      const allCleanText = result.utterances.map((u: any) => u.cleanText).join(' ')

      // Aggregate entities from all utterances
      const allEntities: CaptureAPIEntity[] = []
      for (const utterance of result.utterances) {
        if (utterance.entities && Array.isArray(utterance.entities)) {
          allEntities.push(...utterance.entities)
        }
      }

      // Use first utterance for base properties
      const firstUtterance = result.utterances[0]

      // Convert to expected format
      const convertedResult: CaptureAPIResponse = {
        success: true,
        transcription: {
          rawText: allRawText.trim(),
          cleanText: allCleanText.trim(),
          source: firstUtterance.source,
          confidence: firstUtterance.confidence,
          speaker: firstUtterance.speaker,
        },
        analysis: {
          entities: allEntities,
          emotionalTone: firstUtterance.emotionalTone || 'neutral',
          confidence: firstUtterance.slmConfidence || 0.5,
        },
        metadata: {
          processingTimeMs: result.metadata.processingTimeMs,
          wasOnline: result.metadata.wasOnline,
          slmUsed: result.metadata.slmUsed,
          slmModel: result.metadata.slmModel,
        },
      }

      return convertedResult
    }

    return result as CaptureAPIResponse

  } catch (error) {
    // Log error for debugging
    console.error('[CaptureAPI] Transcription failed:', error)

    // Re-throw with context
    if (error instanceof Error) {
      throw new Error(`CaptureAPI transcription failed: ${error.message}`)
    }
    throw new Error('CaptureAPI transcription failed: Unknown error')
  }
}

// ============================================================================
// WebSocket Streaming Client
// ============================================================================

export interface StreamTranscript {
  type: 'transcript'
  speaker: number | null
  rawText: string
  cleanText: string
  entities: CaptureAPIEntity[]
  emotionalTone: string
  confidence: number
  slmConfidence: number
  slmUsed: boolean
  chunk: number
}

export type StreamMessage =
  | { type: 'ready'; message: string; slmAvailable: boolean }
  | StreamTranscript
  | { type: 'error'; message: string }

/**
 * WebSocket streaming client for real-time audio transcription via CaptureAPI.
 *
 * Opens a persistent WebSocket to CaptureAPI's /api/v1/stream endpoint.
 * Send audio blobs as binary frames, receive transcript JSON messages.
 */
export class CaptureAPIStream {
  private ws: WebSocket | null = null
  private url: string
  private onTranscript: (msg: StreamTranscript) => void
  private onError: (err: string) => void
  private onReady: (() => void) | null
  private _ready = false
  private _closed = false

  constructor(opts: {
    onTranscript: (msg: StreamTranscript) => void
    onError?: (err: string) => void
    onReady?: () => void
  }) {
    const base = getCaptureAPIURL()
    // Convert http(s) to ws(s)
    this.url = base.replace(/^http/, 'ws') + '/api/v1/stream'
    this.onTranscript = opts.onTranscript
    this.onError = opts.onError || ((e) => console.error('[CaptureAPIStream]', e))
    this.onReady = opts.onReady || null
  }

  /** Open the WebSocket connection. Resolves when the server sends 'ready'. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._closed) {
        reject(new Error('Stream already closed'))
        return
      }

      try {
        this.ws = new WebSocket(this.url)
        this.ws.binaryType = 'arraybuffer'
      } catch (err) {
        reject(new Error(`WebSocket connection failed: ${err}`))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timed out'))
        this.close()
      }, 10_000)

      this.ws.onopen = () => {
        console.log('[CaptureAPIStream] Connected to', this.url)
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: StreamMessage = JSON.parse(event.data)

          if (msg.type === 'ready') {
            this._ready = true
            clearTimeout(timeout)
            this.onReady?.()
            resolve()
          } else if (msg.type === 'transcript') {
            this.onTranscript(msg as StreamTranscript)
          } else if (msg.type === 'error') {
            this.onError(msg.message)
          }
        } catch (e) {
          console.warn('[CaptureAPIStream] Failed to parse message:', e)
        }
      }

      this.ws.onerror = (event) => {
        console.error('[CaptureAPIStream] WebSocket error:', event)
        clearTimeout(timeout)
        this.onError('WebSocket connection error')
        if (!this._ready) reject(new Error('WebSocket error before ready'))
      }

      this.ws.onclose = (event) => {
        console.log('[CaptureAPIStream] Closed:', event.code, event.reason)
        clearTimeout(timeout)
        this._ready = false
        if (!this._closed) {
          this.onError('WebSocket connection closed unexpectedly')
        }
      }
    })
  }

  /** Send an audio blob to CaptureAPI for transcription. */
  async sendAudio(blob: Blob): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }
    const buffer = await blob.arrayBuffer()
    this.ws.send(buffer)
  }

  /** Send raw PCM audio buffer directly (no Blob conversion). */
  sendBuffer(buffer: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }
    this.ws.send(buffer)
  }

  /** True if connected and ready to receive audio. */
  get isReady(): boolean {
    return this._ready && this.ws?.readyState === WebSocket.OPEN
  }

  /** Close the WebSocket connection. */
  close(): void {
    this._closed = true
    this._ready = false
    if (this.ws) {
      this.ws.close(1000, 'Client closing')
      this.ws = null
    }
  }
}

// ============================================================================
// Health Check
// ============================================================================

export interface CaptureAPIHealthResult {
  ok: boolean
  reason?: 'not_configured' | 'unreachable' | 'unhealthy'
  url?: string
}

/**
 * Check if CaptureAPI is available and responding.
 * Returns a structured result so callers can show specific error messages.
 */
export async function checkCaptureAPIHealth(): Promise<CaptureAPIHealthResult> {
  const url = process.env.NEXT_PUBLIC_CAPTUREAPI_URL || process.env.CAPTUREAPI_URL

  if (!url) {
    return { ok: false, reason: 'not_configured' }
  }

  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return { ok: false, reason: 'unhealthy', url }
    }

    const data = await response.json()
    return data.status === 'healthy'
      ? { ok: true, url }
      : { ok: false, reason: 'unhealthy', url }

  } catch (error) {
    console.warn('[CaptureAPI] Health check failed:', error)
    return { ok: false, reason: 'unreachable', url }
  }
}
