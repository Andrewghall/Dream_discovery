/**
 * @dream/slm-primitives — NER Primitive
 *
 * Token classification / Named Entity Recognition using local SLMs.
 * Extracts structured entities from text without any API calls.
 *
 * @example
 * ```ts
 * const entities = await extractEntities('Andrew works at DREAM in London')
 * // [
 * //   { text: 'Andrew', type: 'PER', score: 0.99, start: 0, end: 6 },
 * //   { text: 'DREAM', type: 'ORG', score: 0.97, start: 17, end: 22 },
 * //   { text: 'London', type: 'LOC', score: 0.98, start: 26, end: 32 },
 * // ]
 * ```
 *
 * @example With custom type mapping
 * ```ts
 * const entities = await extractEntities(text, {
 *   typeMap: { 'B-PER': 'person', 'I-PER': 'person', 'B-ORG': 'org' }
 * })
 * ```
 */

import { loadModel } from '../loader.js'
import { registry } from '../model-registry.js'
import type { Entity } from '../types.js'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface NerOptions {
  /** HuggingFace model ID. Defaults to registry 'ner' model. */
  modelId?: string
  /** Minimum confidence threshold (default: 0.5) */
  threshold?: number
  /** Map model labels to custom types (e.g. { 'B-PER': 'person' }) */
  typeMap?: Record<string, string>
  /** Use quantized model (default: true) */
  quantized?: boolean
}

// ---------------------------------------------------------------------------
// Default BIO tag cleanup
// ---------------------------------------------------------------------------

/** Strip B-/I- prefix from BIO tags: "B-PER" → "PER" */
function stripBioPrefix(tag: string): string {
  return tag.replace(/^[BI]-/, '')
}

// ---------------------------------------------------------------------------
// Entity merging (BIO → spans)
// ---------------------------------------------------------------------------

interface RawToken {
  word: string
  entity: string
  score: number
  start: number
  end: number
}

/**
 * Merge BIO-tagged tokens into contiguous entity spans.
 * e.g. [B-PER "An", I-PER "drew"] → { text: "Andrew", type: "PER" }
 */
function mergeTokens(tokens: RawToken[], typeMap?: Record<string, string>): Entity[] {
  const entities: Entity[] = []
  let current: Entity | null = null

  for (const token of tokens) {
    const rawType = token.entity
    const isBegin = rawType.startsWith('B-')
    const isContinue = rawType.startsWith('I-')
    const baseType = typeMap?.[rawType] ?? stripBioPrefix(rawType)

    // Skip "O" (outside) tokens
    if (rawType === 'O') {
      if (current) {
        entities.push(current)
        current = null
      }
      continue
    }

    if (isBegin || !current || current.type !== baseType) {
      // Start new entity
      if (current) entities.push(current)
      current = {
        text: token.word,
        type: baseType,
        score: token.score,
        start: token.start,
        end: token.end,
      }
    } else if (isContinue && current.type === baseType) {
      // Continue existing entity
      const needsSpace = token.start > current.end
      current.text += (needsSpace ? ' ' : '') + token.word.replace(/^##/, '')
      current.end = token.end
      current.score = Math.min(current.score, token.score)
    }
  }

  if (current) entities.push(current)
  return entities
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract named entities from text using local token classification.
 */
export async function extractEntities(
  text: string,
  options: NerOptions = {}
): Promise<Entity[]> {
  const config = registry.get('ner')!
  const modelId = options.modelId ?? config.modelId
  const threshold = options.threshold ?? 0.5

  const pipe = await loadModel(modelId, 'token-classification', {
    quantized: options.quantized ?? true,
  })

  const raw = await pipe(text) as RawToken[]

  // Merge sub-word tokens into spans
  const entities = mergeTokens(raw, options.typeMap)

  // Apply confidence threshold
  return entities.filter((e) => e.score >= threshold)
}
