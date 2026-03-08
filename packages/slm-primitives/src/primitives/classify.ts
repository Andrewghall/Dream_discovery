/**
 * @dream/slm-primitives — Classify Primitive
 *
 * Text classification using local SLMs.
 * Supports standard classification and zero-shot classification.
 *
 * @example Standard classification
 * ```ts
 * const results = await classify('This product is amazing!')
 * // [{ label: 'POSITIVE', score: 0.9998 }]
 * ```
 *
 * @example With specific model
 * ```ts
 * const results = await classify('I am furious about this', {
 *   modelId: 'Xenova/distilbert-base-uncased-emotion',
 * })
 * // [{ label: 'anger', score: 0.95 }, { label: 'fear', score: 0.02 }, ...]
 * ```
 *
 * @example Zero-shot (provide your own labels)
 * ```ts
 * const results = await classifyZeroShot(
 *   'The server response time is 3 seconds',
 *   ['performance', 'security', 'usability', 'reliability']
 * )
 * // [{ label: 'performance', score: 0.82 }, ...]
 * ```
 */

import { loadModel } from '../loader.js'
import { registry } from '../model-registry.js'
import type { ClassifyResult } from '../types.js'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ClassifyOptions {
  /** HuggingFace model ID. Defaults to registry 'sentiment' model. */
  modelId?: string
  /** Return top-K results (default: all) */
  topK?: number
  /** Use quantized model (default: true) */
  quantized?: boolean
}

export interface ZeroShotOptions {
  /** HuggingFace model ID. Defaults to registry 'zero-shot' model. */
  modelId?: string
  /** Allow multiple labels to be true (default: false) */
  multiLabel?: boolean
  /** Use quantized model (default: true) */
  quantized?: boolean
}

// ---------------------------------------------------------------------------
// Standard Classification
// ---------------------------------------------------------------------------

/**
 * Classify text into model-defined categories.
 * Uses a pre-trained classification head — fast, deterministic, no prompting.
 */
export async function classify(
  text: string,
  options: ClassifyOptions = {}
): Promise<ClassifyResult[]> {
  const config = registry.get('sentiment')!
  const modelId = options.modelId ?? config.modelId

  const pipe = await loadModel(modelId, 'text-classification', {
    quantized: options.quantized ?? true,
  })

  const raw = await pipe(text, { topk: options.topK })

  // Normalize output shape (pipeline can return single object or array)
  const results = Array.isArray(raw) ? raw : [raw]

  return results.map((r: any) => ({
    label: r.label as string,
    score: r.score as number,
  }))
}

/**
 * Classify text against arbitrary labels using natural language inference.
 * No training needed — provide labels at runtime.
 */
export async function classifyZeroShot(
  text: string,
  candidateLabels: string[],
  options: ZeroShotOptions = {}
): Promise<ClassifyResult[]> {
  const config = registry.get('zero-shot')!
  const modelId = options.modelId ?? config.modelId

  const pipe = await loadModel(modelId, 'text-classification', {
    quantized: options.quantized ?? true,
  })

  // Zero-shot via NLI: score each "text entails label" pair
  const results: ClassifyResult[] = []

  for (const label of candidateLabels) {
    const hypothesis = `This text is about ${label}.`
    const raw = await pipe(
      { text, text_pair: hypothesis },
      { topk: null },
    )

    const scores = Array.isArray(raw) ? raw : [raw]
    // NLI models output entailment/neutral/contradiction
    // We want the entailment score as our confidence
    const entailment = scores.find((s: any) => s.label === 'entailment' || s.label === 'ENTAILMENT')
    results.push({
      label,
      score: entailment?.score ?? 0,
    })
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score)
  return results
}
