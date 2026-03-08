/**
 * @dream/slm-primitives — Pipeline Orchestrator
 *
 * Compose SLM primitives into multi-step pipelines.
 * Each step runs sequentially, passing output to the next.
 * All timing is tracked for observability.
 *
 * @example Simple pipeline
 * ```ts
 * const analyseText = createPipeline<string, AnalysisResult>([
 *   {
 *     name: 'clean',
 *     run: async (text) => (await clean(text)).text,
 *   },
 *   {
 *     name: 'classify',
 *     run: async (cleanText) => {
 *       const [sentiment] = await classify(cleanText)
 *       const entities = await extractEntities(cleanText)
 *       return { sentiment, entities, text: cleanText }
 *     },
 *   },
 * ])
 *
 * const result = await analyseText('um so the server is like really slow')
 * // { output: { sentiment, entities, text }, timings: { clean: 45, classify: 120 }, totalMs: 165 }
 * ```
 *
 * @example Parallel fan-out
 * ```ts
 * const analyseParallel = createParallelPipeline({
 *   sentiment: async (text: string) => classify(text),
 *   entities: async (text: string) => extractEntities(text),
 *   embedding: async (text: string) => embed(text),
 * })
 *
 * const result = await analyseParallel('Customer complained about slow service')
 * // { output: { sentiment: [...], entities: [...], embedding: {...} }, timings: {...}, totalMs: 150 }
 * ```
 */

import type { PipelineStep, PipelineResult } from './types.js'

// ---------------------------------------------------------------------------
// Sequential Pipeline
// ---------------------------------------------------------------------------

/**
 * Create a sequential pipeline from an array of steps.
 * Each step receives the output of the previous step.
 */
export function createPipeline<TIn, TOut>(
  steps: PipelineStep[]
): (input: TIn) => Promise<PipelineResult<TOut>> {
  return async (input: TIn): Promise<PipelineResult<TOut>> => {
    const timings: Record<string, number> = {}
    const totalStart = performance.now()
    let current: unknown = input

    for (const step of steps) {
      const stepStart = performance.now()
      current = await step.run(current)
      timings[step.name] = Math.round(performance.now() - stepStart)
    }

    return {
      output: current as TOut,
      timings,
      totalMs: Math.round(performance.now() - totalStart),
    }
  }
}

// ---------------------------------------------------------------------------
// Parallel Fan-out Pipeline
// ---------------------------------------------------------------------------

type ParallelSteps<TIn, TOut> = {
  [K in keyof TOut]: (input: TIn) => Promise<TOut[K]>
}

/**
 * Create a parallel pipeline that fans out to multiple primitives simultaneously.
 * All branches receive the same input and run concurrently.
 */
export function createParallelPipeline<TIn, TOut extends Record<string, unknown>>(
  branches: ParallelSteps<TIn, TOut>
): (input: TIn) => Promise<PipelineResult<TOut>> {
  return async (input: TIn): Promise<PipelineResult<TOut>> => {
    const timings: Record<string, number> = {}
    const totalStart = performance.now()
    const output: Record<string, unknown> = {}

    const entries = Object.entries(branches) as Array<
      [string, (input: TIn) => Promise<unknown>]
    >

    await Promise.all(
      entries.map(async ([name, fn]) => {
        const start = performance.now()
        output[name] = await fn(input)
        timings[name] = Math.round(performance.now() - start)
      })
    )

    return {
      output: output as TOut,
      timings,
      totalMs: Math.round(performance.now() - totalStart),
    }
  }
}

// ---------------------------------------------------------------------------
// Conditional Pipeline
// ---------------------------------------------------------------------------

/**
 * Create a step that only runs if a condition is met.
 * Otherwise, passes input through unchanged.
 */
export function conditionalStep<T>(
  name: string,
  condition: (input: T) => boolean,
  step: (input: T) => Promise<T>
): PipelineStep<T, T> {
  return {
    name,
    run: async (input: T) => {
      if (condition(input)) {
        return step(input)
      }
      return input
    },
  }
}

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap a primitive with retry logic.
 * Useful for handling transient model loading failures.
 */
export function withRetry<TIn, TOut>(
  step: PipelineStep<TIn, TOut>,
  maxRetries = 2
): PipelineStep<TIn, TOut> {
  return {
    name: step.name,
    run: async (input: TIn) => {
      let lastError: Error | undefined
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await step.run(input)
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          if (attempt < maxRetries) {
            // Brief backoff
            await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
          }
        }
      }
      throw lastError
    },
  }
}
