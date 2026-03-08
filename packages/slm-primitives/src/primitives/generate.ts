/**
 * @dream/slm-primitives — Generate Primitive
 *
 * Text generation using local seq2seq SLMs.
 * Summarize, clean, rewrite, or transform text — no API calls.
 *
 * @example Summarize
 * ```ts
 * const result = await generate('summarize: ' + longText)
 * // { text: 'Key points from the text...', model: 'Xenova/distilbart-cnn-6-6' }
 * ```
 *
 * @example Clean transcript
 * ```ts
 * const result = await generate(
 *   'Fix grammar and remove filler words: um so like the thing is we uh need to fix it',
 *   { registryKey: 'grammar' }
 * )
 * // { text: 'The thing is we need to fix it.', model: 'Xenova/flan-t5-small' }
 * ```
 *
 * @example Custom instruction
 * ```ts
 * const result = await generate(
 *   'Extract action items from: We need to update the API and fix the login bug by Friday',
 *   { registryKey: 'grammar' }
 * )
 * ```
 */

import { loadModel } from '../loader.js'
import { registry } from '../model-registry.js'
import type { GenerateResult } from '../types.js'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  /** HuggingFace model ID. Overrides registryKey. */
  modelId?: string
  /** Registry key to look up model (default: 'summarize') */
  registryKey?: string
  /** Maximum tokens to generate (default: 128) */
  maxNewTokens?: number
  /** Minimum tokens to generate (default: 1) */
  minNewTokens?: number
  /** Temperature for sampling (default: 1.0 = greedy for seq2seq) */
  temperature?: number
  /** Top-K sampling (default: 50) */
  topK?: number
  /** Use quantized model (default: true) */
  quantized?: boolean
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate text using a local seq2seq model.
 *
 * For instruction-following, use the 'grammar' registry key (flan-t5-small).
 * For summarization, use the default 'summarize' key (distilbart).
 */
export async function generate(
  input: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const key = options.registryKey ?? 'summarize'
  const config = registry.get(key)!
  const modelId = options.modelId ?? config.modelId

  const pipe = await loadModel(modelId, 'text2text-generation', {
    quantized: options.quantized ?? true,
  })

  const raw = await pipe(input, {
    max_new_tokens: options.maxNewTokens ?? 128,
    min_new_tokens: options.minNewTokens,
    temperature: options.temperature,
    top_k: options.topK,
  })

  // Pipeline returns array of generated texts
  const output = Array.isArray(raw) ? raw[0] : raw
  const text = (output as any).generated_text ?? (output as any).text ?? String(output)

  return {
    text: text.trim(),
    model: modelId,
  }
}

/**
 * Convenience: summarize text.
 */
export async function summarize(
  text: string,
  options: Omit<GenerateOptions, 'registryKey'> = {}
): Promise<GenerateResult> {
  return generate(text, { ...options, registryKey: 'summarize' })
}

/**
 * Convenience: clean/correct text using instruction-following model.
 */
export async function clean(
  text: string,
  instruction = 'Fix grammar and remove filler words',
  options: Omit<GenerateOptions, 'registryKey'> = {}
): Promise<GenerateResult> {
  return generate(`${instruction}: ${text}`, {
    ...options,
    registryKey: 'grammar',
  })
}
