/**
 * lib/evidence/types.ts
 *
 * Common internal evidence model for the historical evidence ingestion layer.
 *
 * Design principle:
 *   Discovery  = what people SAY
 *   Evidence   = what documents/data SHOW
 *   Synthesis  = where they align, differ, and what that means
 *
 * This is the single source of truth for evidence types used across:
 *   - File extraction pipeline
 *   - Normalisation agent
 *   - Cross-validation agent
 *   - Output rendering
 */

// ── Source Classification ──────────────────────────────────────────────────

export type EvidenceSourceCategory =
  | 'operational_report'      // internal ops reports, management summaries
  | 'performance_metrics'     // KPI dashboards, SLA scorecards, MI reports
  | 'survey_data'             // internal employee/customer surveys
  | 'customer_feedback'       // complaints, compliments, feedback logs
  | 'csat'                    // Customer Satisfaction scores
  | 'nps'                     // Net Promoter Score data
  | 'social_media'            // Trustpilot, Twitter/X, App Store reviews
  | 'financial_data'          // cost reports, P&L, budget data
  | 'process_documentation'   // SOPs, playbooks, process maps
  | 'strategic_document'      // strategy decks, board papers, plans
  | 'audit_report'            // compliance, quality, risk audits
  | 'training_data'           // training records, capability assessments
  | 'incident_log'            // incident reports, change logs, post-mortems
  | 'other'                   // catch-all

export type SignalDirection = 'red' | 'amber' | 'green' | 'mixed'

export type EvidenceProcessingStatus = 'uploading' | 'processing' | 'ready' | 'failed'

// ── Individual Finding ─────────────────────────────────────────────────────

export interface NormalisedEvidenceFinding {
  /** Stable ID for this finding within the document */
  id: string
  /** Single clear declarative statement of the finding */
  text: string
  /** Classification of what kind of evidence this is */
  type: 'problem' | 'metric' | 'trend' | 'feedback' | 'observation' | 'risk' | 'positive'
  /** Traffic-light signal */
  signalDirection: SignalDirection
  /** How confident the AI is in this extraction (0–1) */
  confidence: number
  /** Which DREAM lenses this finding touches */
  relevantLenses: string[]          // People / Organisation / Customer / Technology / Regulation
  /** Which journey stages this finding touches */
  relevantJourneyStages: string[]
  /** Verbatim text from the document this was derived from */
  sourceExcerpt?: string
  /** Page number, slide number, or row range */
  sourcePage?: string
}

// ── Extracted Metric ───────────────────────────────────────────────────────

export interface EvidenceMetric {
  name: string                  // e.g. "First Call Resolution"
  value: string                 // e.g. "48%"
  unit?: string                 // e.g. "%", "£", "days", "seconds"
  trend?: 'improving' | 'declining' | 'stable' | 'unknown'
  period?: string               // e.g. "Q3 2024", "Jan–Dec 2024"
  benchmark?: string            // e.g. "industry avg 65%"
  isKPI: boolean
}

// ── Normalised Document ────────────────────────────────────────────────────

export interface NormalisedEvidenceDocument {
  id: string
  workshopId: string
  originalFileName: string
  mimeType: string
  fileSizeBytes: number
  /** Path in Supabase Storage */
  storageKey: string
  status: EvidenceProcessingStatus
  errorMessage?: string

  // ── AI-interpreted metadata ─────────────────────────────────────────────
  /** Auto-detected category */
  sourceCategory: EvidenceSourceCategory
  /** 2–4 sentence plain-English summary of what this document says */
  summary: string
  /** Approximate period this document covers */
  timeframeFrom?: string
  timeframeTo?: string

  // ── Extracted structured content ────────────────────────────────────────
  findings: NormalisedEvidenceFinding[]
  metrics: EvidenceMetric[]
  /** Verbatim excerpts worth quoting in output */
  excerpts: string[]

  // ── Signal assessment ───────────────────────────────────────────────────
  /** Overall traffic-light for this document */
  signalDirection: SignalDirection
  /** Overall confidence in the extraction (0–1) */
  confidence: number

  // ── Relevance mapping ───────────────────────────────────────────────────
  relevantLenses: string[]
  relevantActors: string[]
  relevantJourneyStages: string[]

  createdAt: string
  updatedAt: string
  /** Cross-validation result (populated after running validation against discovery) */
  crossValidation?: CrossValidationResult | null
}

// ── Cross-Validation ───────────────────────────────────────────────────────

export type CrossValidationAlignment =
  | 'corroborated'          // Discovery finding supported by evidence
  | 'contradicted'          // Evidence says the opposite
  | 'partially_supported'   // Evidence partially supports, with caveats

export interface CrossValidationMatch {
  /** Short label for the discovery finding (quoted or summarised) */
  discoveryFinding: string
  /** Short label for the evidence finding */
  evidenceFinding: string
  /** ID of the EvidenceDocument this came from */
  documentId: string
  /** Filename for display */
  documentName: string
  /** How they relate */
  alignment: CrossValidationAlignment
  /** Free-text nuance note (1–2 sentences) */
  note?: string
  /** Confidence in this match (0–1) */
  confidence: number
}

export interface CrossValidationResult {
  /** Discovery findings confirmed by uploaded evidence */
  corroborated: CrossValidationMatch[]
  /** Evidence directly contradicts a discovery finding */
  contradicted: CrossValidationMatch[]
  /** Evidence partially supports but with nuance */
  partiallySupported: CrossValidationMatch[]
  /** Discovery findings with no evidence coverage */
  unsupported: string[]
  /**
   * Evidence findings not reflected anywhere in discovery.
   * These are gaps — things the workshop missed.
   */
  evidenceOnly: Array<{
    finding: NormalisedEvidenceFinding
    documentId: string
    documentName: string
  }>
  /**
   * Executive narrative: what does the cross-validation mean for the conclusion?
   * 2–4 sentences.
   */
  conclusionImpact: string
  /** When cross-validation was last run */
  generatedAt: string
}

// ── Aggregate Evidence Summary ─────────────────────────────────────────────
// Used in the output tab to give an at-a-glance view across all documents

export interface EvidenceSummary {
  totalDocuments: number
  totalFindings: number
  totalMetrics: number
  signalBreakdown: { red: number; amber: number; green: number; mixed: number }
  topLenses: string[]          // lenses mentioned most across all documents
  commonThemes: string[]       // AI-generated themes common across sources
  overallSignalDirection: SignalDirection
  overallConfidence: number
  crossValidation?: CrossValidationResult
}

// ── Cross-Document Synthesis ───────────────────────────────────────────────
// Produced by the cross-doc synthesis agent across ALL ready evidence documents.
// Stored on Workshop.evidenceSynthesis.

export interface CrossDocSynthesisTheme {
  /** Short descriptive label for the theme */
  theme: string
  /** IDs of documents where this theme appears */
  appearsInDocIds: string[]
  /** Filenames for display */
  appearsInDocNames: string[]
  /** Aggregate signal across all docs mentioning this theme */
  signalDirection: SignalDirection
}

export interface CrossDocSynthesisContradiction {
  /** The topic on which documents disagree */
  topic: string
  /** One position per document that has a conflicting view */
  positions: Array<{
    documentId: string
    documentName: string
    position: string
  }>
}

export interface CrossDocSynthesis {
  /** Findings that appear in 2 or more documents */
  sharedThemes: CrossDocSynthesisTheme[]
  /** Findings present in only one document — single-source signals */
  outliers: Array<{
    finding: string
    documentId: string
    documentName: string
    note: string
  }>
  /** Where documents directly contradict each other */
  crossDocContradictions: CrossDocSynthesisContradiction[]
  /** 2–4 sentence narrative across all documents */
  workshopLevelSummary: string
  /** Number of documents included in this synthesis */
  documentCount: number
  /** ISO timestamp when synthesis was generated */
  generatedAt: string
}

// ── Processing Pipeline ────────────────────────────────────────────────────

/** Raw extracted content from a file before normalisation */
export interface RawFileExtraction {
  text: string              // Full extracted text
  pageCount?: number        // For PDFs
  slideCount?: number       // For PPTX
  rowCount?: number         // For XLSX/CSV
  extractionMethod: 'text' | 'vision' | 'ocr' | 'structured'
  mimeType: string
}
