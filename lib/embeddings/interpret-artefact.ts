/**
 * lib/embeddings/interpret-artefact.ts
 *
 * Converts non-text artefacts into embeddable text descriptions via GPT-4o Vision.
 *
 * All artefact types produce text output that goes into the same 1536-dim
 * embedding space as every other knowledge source.
 *
 * Semantic organisational meaning, not pixel-level similarity:
 *   - Whiteboards → key ideas, frameworks, relationships extracted as text
 *   - Sticky notes → all note text extracted, grouped by colour if distinct
 *   - Handwritten → transcribed verbatim preserving structure
 *   - Photos → organisational context described
 *   - Diagrams → structure and flow explained
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

export type ArtefactType = 'whiteboard' | 'sticky_notes' | 'diagram' | 'photo' | 'handwritten';

const PROMPTS: Record<ArtefactType, string> = {
  whiteboard:
    'Describe the key ideas, themes, frameworks and relationships shown on this whiteboard. ' +
    'Focus on organisational meaning — what problems, solutions, or strategic concepts are represented? ' +
    'Extract any text labels, arrows, groupings, and the overall narrative. ' +
    'Structure your response as a paragraph followed by a bullet list of key points.',

  sticky_notes:
    'Extract and list all text visible on the sticky notes in this image. ' +
    'Group by colour if the notes are colour-coded into distinct categories. ' +
    'For each group, identify the theme or category the notes represent. ' +
    'Preserve the exact wording of each note.',

  diagram:
    'Describe the structure, flow, and relationships shown in this diagram. ' +
    'Identify the type of diagram (process flow, org chart, architecture, concept map, etc.). ' +
    'Extract all labels, nodes, connections, and the key message the diagram communicates. ' +
    'Focus on organisational and strategic meaning rather than visual design.',

  photo:
    'Describe the organisational context and any visible content relevant to a business workshop. ' +
    'Note any visible text, whiteboards, screens, documents, or artefacts. ' +
    'Focus on what this image tells us about the business challenge, people, or work being done.',

  handwritten:
    'Transcribe all handwritten text visible in this image. ' +
    'Preserve the structure, headings, lists, and any visual organisation. ' +
    'If text is unclear, indicate this with [unclear]. ' +
    'Do not interpret — transcribe faithfully.',
};

// detail level per artefact type
const DETAIL: Record<ArtefactType, 'high' | 'low'> = {
  whiteboard: 'low',
  sticky_notes: 'high',  // needs to read individual note text
  diagram: 'low',
  photo: 'low',
  handwritten: 'high',   // needs to read handwriting accurately
};

/**
 * Interpret an image artefact via GPT-4o Vision and return a structured
 * text description ready for embedding.
 *
 * @param imageUrl  Publicly accessible URL or base64 data URL (data:image/...)
 * @param artefactType  Drives the prompt and detail level
 * @returns         Text description — embed this, not the raw image
 */
export async function interpretImageArtefact(
  imageUrl: string,
  artefactType: ArtefactType
): Promise<string> {
  if (!openai) {
    throw new Error('[embeddings] OPENAI_API_KEY not configured');
  }

  const prompt = PROMPTS[artefactType];
  const detail = DETAIL[artefactType];

  const response = await openAiBreaker.execute(() =>
    openai!.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })
  );

  const description = response.choices[0]?.message?.content?.trim();
  if (!description) {
    throw new Error('[embeddings] GPT-4o Vision returned empty description');
  }

  return description;
}
