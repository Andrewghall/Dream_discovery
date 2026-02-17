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

/**
 * Check if CaptureAPI is available and responding.
 *
 * @returns Promise<boolean> - true if available, false otherwise
 */
export async function checkCaptureAPIHealth(): Promise<boolean> {
  try {
    const baseURL = getCaptureAPIURL()
    const response = await fetch(`${baseURL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) return false

    const data = await response.json()
    return data.status === 'healthy'

  } catch (error) {
    console.warn('[CaptureAPI] Health check failed:', error)
    return false
  }
}
