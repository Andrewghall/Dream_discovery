/**
 * @dream/slm-primitives — Model Registry
 *
 * Default model configurations for each primitive task.
 * All models are free, open-weight, ONNX-compatible via HuggingFace.
 *
 * To use a custom/fine-tuned model, either:
 *   1. Override when calling a primitive: classify(text, { modelId: 'your/model' })
 *   2. Register globally: registry.set('my-classifier', { ... })
 *
 * Fine-tuning workflow:
 *   1. Train with HuggingFace transformers (Python)
 *   2. Export to ONNX: optimum-cli export onnx --model ./my-model ./my-model-onnx
 *   3. Push to HF Hub or load from local path
 *   4. Reference by modelId in primitives
 */

import type { ModelConfig, ModelRegistry } from './types.js'

// ---------------------------------------------------------------------------
// Default Models (all Xenova/* are pre-converted ONNX, ready for transformers.js)
// ---------------------------------------------------------------------------

export const DEFAULT_MODELS: ModelRegistry = {
  // --- Classification ---
  'sentiment': {
    modelId: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    task: 'text-classification',
    quantized: true,
    maxLength: 512,
    description: 'Binary sentiment (positive/negative)',
  },
  'emotion': {
    modelId: 'Xenova/distilbert-base-uncased-emotion',
    task: 'text-classification',
    quantized: true,
    maxLength: 512,
    description: '6-class emotion (joy, sadness, anger, fear, surprise, love)',
  },
  'zero-shot': {
    modelId: 'Xenova/mobilebert-uncased-mnli',
    task: 'text-classification',
    quantized: true,
    maxLength: 512,
    description: 'Zero-shot classification via NLI (provide your own labels)',
  },

  // --- Token Classification (NER) ---
  'ner': {
    modelId: 'Xenova/bert-base-NER',
    task: 'token-classification',
    quantized: true,
    maxLength: 512,
    description: 'Named entity recognition (PER, ORG, LOC, MISC)',
  },

  // --- Text Generation (seq2seq) ---
  'summarize': {
    modelId: 'Xenova/distilbart-cnn-6-6',
    task: 'text2text-generation',
    quantized: true,
    maxLength: 1024,
    description: 'Text summarization',
  },
  'grammar': {
    modelId: 'Xenova/flan-t5-small',
    task: 'text2text-generation',
    quantized: true,
    maxLength: 512,
    description: 'Grammar correction, text cleanup, general instruction following',
  },

  // --- Embeddings ---
  'embed': {
    modelId: 'Xenova/all-MiniLM-L6-v2',
    task: 'feature-extraction',
    quantized: true,
    maxLength: 256,
    description: '384-dim sentence embeddings for similarity/retrieval',
  },
  'embed-large': {
    modelId: 'Xenova/bge-base-en-v1.5',
    task: 'feature-extraction',
    quantized: true,
    maxLength: 512,
    description: '768-dim embeddings, higher quality, slower',
  },
}

// ---------------------------------------------------------------------------
// Mutable runtime registry
// ---------------------------------------------------------------------------

const _registry = new Map<string, ModelConfig>(
  Object.entries(DEFAULT_MODELS)
)

export const registry = {
  get(name: string): ModelConfig | undefined {
    return _registry.get(name)
  },

  set(name: string, config: ModelConfig): void {
    _registry.set(name, config)
  },

  has(name: string): boolean {
    return _registry.has(name)
  },

  list(): Array<{ name: string; config: ModelConfig }> {
    return Array.from(_registry.entries()).map(([name, config]) => ({
      name,
      config,
    }))
  },

  /** Reset to defaults (useful for testing) */
  reset(): void {
    _registry.clear()
    for (const [name, config] of Object.entries(DEFAULT_MODELS)) {
      _registry.set(name, config)
    }
  },
}
