/**
 * @dream/slm-primitives — Embed Primitive
 *
 * Dense vector embeddings using local SLMs.
 * Encode text into vectors for similarity search, clustering, retrieval.
 *
 * @example Single embedding
 * ```ts
 * const result = await embed('The customer complained about wait times')
 * // { vector: [0.012, -0.045, ...], dimensions: 384, model: '...' }
 * ```
 *
 * @example Batch embeddings
 * ```ts
 * const results = await embedBatch([
 *   'Customer service is slow',
 *   'The product quality is excellent',
 *   'Delivery took too long',
 * ])
 * ```
 *
 * @example Cosine similarity
 * ```ts
 * const a = await embed('performance issue')
 * const b = await embed('the server is slow')
 * const similarity = cosineSimilarity(a.vector, b.vector)
 * // 0.82
 * ```
 */

import { loadModel } from '../loader.js'
import { registry } from '../model-registry.js'
import type { EmbedResult } from '../types.js'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EmbedOptions {
  /** HuggingFace model ID. Overrides registryKey. */
  modelId?: string
  /** Registry key (default: 'embed') */
  registryKey?: string
  /** Use quantized model (default: true) */
  quantized?: boolean
  /** Normalize vectors to unit length (default: true) */
  normalize?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mean-pool token embeddings into a single sentence vector */
function meanPool(tokenEmbeddings: number[][]): number[] {
  const dim = tokenEmbeddings[0].length
  const result = new Array(dim).fill(0)

  for (const token of tokenEmbeddings) {
    for (let i = 0; i < dim; i++) {
      result[i] += token[i]
    }
  }

  const count = tokenEmbeddings.length
  for (let i = 0; i < dim; i++) {
    result[i] /= count
  }

  return result
}

/** L2-normalize a vector to unit length */
function normalize(vec: number[]): number[] {
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Embed a single text into a dense vector.
 */
export async function embed(
  text: string,
  options: EmbedOptions = {}
): Promise<EmbedResult> {
  const key = options.registryKey ?? 'embed'
  const config = registry.get(key)!
  const modelId = options.modelId ?? config.modelId
  const shouldNormalize = options.normalize ?? true

  const pipe = await loadModel(modelId, 'feature-extraction', {
    quantized: options.quantized ?? true,
  })

  const raw = await pipe(text, { pooling: 'mean', normalize: shouldNormalize })

  // Output is a Tensor — convert to flat array
  let vector: number[]

  if (raw?.tolist) {
    // Transformers.js Tensor
    const nested = raw.tolist()
    vector = Array.isArray(nested[0]) ? nested[0] : nested
  } else if (Array.isArray(raw)) {
    // Already array — may be nested [[...]]
    vector = Array.isArray(raw[0]) ? raw[0] : raw
  } else {
    vector = Array.from(raw as any)
  }

  if (shouldNormalize) {
    vector = normalize(vector)
  }

  return {
    vector,
    dimensions: vector.length,
    model: modelId,
  }
}

/**
 * Embed multiple texts in batch.
 */
export async function embedBatch(
  texts: string[],
  options: EmbedOptions = {}
): Promise<EmbedResult[]> {
  // Process sequentially — models are single-threaded in ONNX runtime
  const results: EmbedResult[] = []
  for (const text of texts) {
    results.push(await embed(text, options))
  }
  return results
}

/**
 * Cosine similarity between two vectors. Returns -1 to 1.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
