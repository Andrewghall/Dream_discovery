/**
 * Background upload sync for offline-captured audio.
 *
 * Reads pending uploads from IndexedDB and attempts to POST each one
 * to the capture token upload endpoint. Successfully uploaded items are
 * removed from the local store. Items that fail more than 3 times are
 * skipped for this run.
 */

import { getPendingUploads, removePendingUpload } from './offline-store';

const MAX_RETRIES = 3;

// Track retry counts in memory (resets on page reload, which is fine -
// persistent retry tracking is not needed for a simple queue processor).
const retryCounts = new Map<string, number>();

/**
 * Process the offline upload queue.
 *
 * @param workshopId - The workshop ID for logging / context
 * @param token - The capture JWT token used for the upload endpoint
 * @returns Counts of successfully uploaded and failed items
 */
export async function processUploadQueue(
  workshopId: string,
  token: string
): Promise<{ uploaded: number; failed: number }> {
  const pending = await getPendingUploads();

  let uploaded = 0;
  let failed = 0;

  for (const item of pending) {
    const currentRetries = retryCounts.get(item.id) ?? 0;

    // Skip items that have exceeded the retry limit
    if (currentRetries >= MAX_RETRIES) {
      failed++;
      continue;
    }

    try {
      const formData = new FormData();
      formData.append('audio', item.audioBlob, 'capture.webm');
      formData.append('metadata', JSON.stringify(item.metadata));
      formData.append('workshopId', workshopId);

      const res = await fetch(`/api/capture-tokens/${token}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await removePendingUpload(item.id);
        retryCounts.delete(item.id);
        uploaded++;
      } else {
        retryCounts.set(item.id, currentRetries + 1);
        failed++;
      }
    } catch {
      retryCounts.set(item.id, currentRetries + 1);
      failed++;
    }
  }

  return { uploaded, failed };
}
