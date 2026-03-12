/**
 * lib/embeddings/index.ts
 * Barrel export for the vector embedding layer.
 */

export { generateEmbedding, embedAndStore, embedAsync } from './embed';
export type { EmbeddableTable } from './embed';

export { retrieveRelevant } from './retrieve';
export type { RetrievalOptions, RetrievedChunk } from './retrieve';

export { interpretImageArtefact } from './interpret-artefact';
export type { ArtefactType } from './interpret-artefact';
