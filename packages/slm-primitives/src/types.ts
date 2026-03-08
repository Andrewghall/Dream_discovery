/**
 * @dream/slm-primitives — Core Types
 *
 * Shared type definitions for all SLM primitives.
 * These types are model-agnostic — any HuggingFace-compatible
 * ONNX model can back any primitive.
 */

// ---------------------------------------------------------------------------
// Model Configuration
// ---------------------------------------------------------------------------

/** Supported primitive task types */
export type TaskType =
  | 'text-classification'
  | 'token-classification'
  | 'text2text-generation'
  | 'feature-extraction'

/** A registered model configuration */
export interface ModelConfig {
  /** HuggingFace model ID (e.g. "Xenova/distilbert-base-uncased") */
  modelId: string
  /** Task this model performs */
  task: TaskType
  /** Quantization level — smaller = faster, lower quality */
  quantized?: boolean
  /** Maximum input token length */
  maxLength?: number
  /** Human-readable description */
  description?: string
}

/** Registry of named model configurations */
export type ModelRegistry = Record<string, ModelConfig>

// ---------------------------------------------------------------------------
// Primitive Results
// ---------------------------------------------------------------------------

/** Single classification result */
export interface ClassifyResult {
  label: string
  score: number
}

/** Entity extracted by token classification */
export interface Entity {
  text: string
  type: string
  score: number
  /** Character start offset in source text */
  start: number
  /** Character end offset in source text */
  end: number
}

/** Text generation result */
export interface GenerateResult {
  text: string
  /** Source model that produced this */
  model: string
}

/** Embedding vector result */
export interface EmbedResult {
  /** Dense float vector */
  vector: number[]
  /** Dimensionality */
  dimensions: number
  /** Source model */
  model: string
}

// ---------------------------------------------------------------------------
// Pipeline / Orchestration
// ---------------------------------------------------------------------------

/** A single step in an orchestrated pipeline */
export interface PipelineStep<TIn = unknown, TOut = unknown> {
  /** Step name for logging/tracing */
  name: string
  /** The primitive function to execute */
  run: (input: TIn) => Promise<TOut>
}

/** Result from an orchestrated pipeline run */
export interface PipelineResult<T = unknown> {
  /** Final output */
  output: T
  /** Per-step timing in ms */
  timings: Record<string, number>
  /** Total wall-clock ms */
  totalMs: number
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/** Options for model loading */
export interface LoadOptions {
  /** Override default cache directory */
  cacheDir?: string
  /** Progress callback (0-1) */
  onProgress?: (progress: number) => void
  /** Use quantized model variant if available */
  quantized?: boolean
}
