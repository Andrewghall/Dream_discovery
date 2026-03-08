/**
 * @dream/slm-primitives
 *
 * Local SLM inference primitives for DREAM Phase 2 and Agent2.0.
 *
 * No API keys. No tokens. No cloud dependency.
 * Free, offline, trainable, orchestratable.
 *
 * Primitives:
 *   classify     — Text classification (sentiment, emotion, zero-shot)
 *   extractEntities — Named entity recognition (NER)
 *   generate     — Text generation, summarization, cleanup (seq2seq)
 *   embed        — Dense vector embeddings for similarity/retrieval
 *
 * Orchestration:
 *   createPipeline         — Sequential multi-step pipeline
 *   createParallelPipeline — Parallel fan-out pipeline
 *   conditionalStep        — Conditional execution
 *   withRetry              — Retry wrapper
 *
 * Model Management:
 *   registry     — Register/lookup model configurations
 *   loadModel    — Lazy-load models with caching
 *   warmup       — Pre-warm models at startup
 *
 * @example Quick start
 * ```ts
 * import { classify, extractEntities, embed, cosineSimilarity } from '@dream/slm-primitives'
 *
 * const sentiment = await classify('The deployment went smoothly')
 * const entities = await extractEntities('Andrew reviewed the London office')
 * const vec = await embed('customer satisfaction')
 * ```
 */

// --- Types ---
export type {
  TaskType,
  ModelConfig,
  ModelRegistry,
  ClassifyResult,
  Entity,
  GenerateResult,
  EmbedResult,
  PipelineStep,
  PipelineResult,
  LoadOptions,
} from './types.js'

// --- Model Management ---
export { registry, DEFAULT_MODELS } from './model-registry.js'
export { loadModel, isLoaded, unload, unloadAll, listLoaded, warmup } from './loader.js'

// --- Primitives ---
export { classify, classifyZeroShot } from './primitives/classify.js'
export type { ClassifyOptions, ZeroShotOptions } from './primitives/classify.js'

export { extractEntities } from './primitives/ner.js'
export type { NerOptions } from './primitives/ner.js'

export { generate, summarize, clean } from './primitives/generate.js'
export type { GenerateOptions } from './primitives/generate.js'

export { embed, embedBatch, cosineSimilarity } from './primitives/embed.js'
export type { EmbedOptions } from './primitives/embed.js'

// --- Pipeline / Orchestration ---
export {
  createPipeline,
  createParallelPipeline,
  conditionalStep,
  withRetry,
} from './pipeline.js'
