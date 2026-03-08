/**
 * @dream/slm-primitives — Model Loader
 *
 * Lazy-loads and caches HuggingFace transformer models.
 * Models are downloaded once, cached to disk, and held in memory
 * for subsequent calls within the same process.
 *
 * Uses @huggingface/transformers which runs ONNX models
 * directly in Node.js — no Python, no API keys, fully offline
 * after first download.
 */

import { pipeline, type Pipeline } from '@huggingface/transformers'
import type { TaskType, LoadOptions } from './types.js'

// ---------------------------------------------------------------------------
// In-memory pipeline cache (keyed by modelId + task)
// ---------------------------------------------------------------------------

const _cache = new Map<string, Pipeline>()

function cacheKey(modelId: string, task: TaskType): string {
  return `${task}::${modelId}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load (or retrieve from cache) a transformer pipeline for the given task and model.
 *
 * First call downloads the model (~10-200MB depending on model).
 * Subsequent calls return the cached pipeline instantly.
 *
 * @example
 * ```ts
 * const classifier = await loadModel('Xenova/distilbert-base-uncased-finetuned-sst-2-english', 'text-classification')
 * const result = await classifier('I love this product')
 * ```
 */
export async function loadModel(
  modelId: string,
  task: TaskType,
  options: LoadOptions = {}
): Promise<Pipeline> {
  const key = cacheKey(modelId, task)

  const cached = _cache.get(key)
  if (cached) return cached

  const pipelineOptions: Record<string, unknown> = {}

  if (options.quantized !== undefined) {
    pipelineOptions.quantized = options.quantized
  }

  if (options.cacheDir) {
    pipelineOptions.cache_dir = options.cacheDir
  }

  if (options.onProgress) {
    pipelineOptions.progress_callback = (progress: { progress: number }) => {
      options.onProgress?.(progress.progress / 100)
    }
  }

  const pipe = await pipeline(task, modelId, pipelineOptions)

  _cache.set(key, pipe)
  return pipe
}

/**
 * Check if a model is already loaded in memory.
 */
export function isLoaded(modelId: string, task: TaskType): boolean {
  return _cache.has(cacheKey(modelId, task))
}

/**
 * Evict a specific model from the in-memory cache.
 */
export function unload(modelId: string, task: TaskType): boolean {
  return _cache.delete(cacheKey(modelId, task))
}

/**
 * Evict all models from the in-memory cache.
 */
export function unloadAll(): void {
  _cache.clear()
}

/**
 * List all currently loaded model keys.
 */
export function listLoaded(): string[] {
  return Array.from(_cache.keys())
}

/**
 * Pre-warm models by loading them into cache.
 * Useful at startup to avoid cold-start latency on first inference.
 *
 * @example
 * ```ts
 * await warmup([
 *   { modelId: 'Xenova/all-MiniLM-L6-v2', task: 'feature-extraction' },
 *   { modelId: 'Xenova/bert-base-NER', task: 'token-classification' },
 * ])
 * ```
 */
export async function warmup(
  models: Array<{ modelId: string; task: TaskType; options?: LoadOptions }>
): Promise<void> {
  await Promise.all(
    models.map((m) => loadModel(m.modelId, m.task, m.options))
  )
}
