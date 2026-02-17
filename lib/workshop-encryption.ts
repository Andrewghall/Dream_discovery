/**
 * Workshop data encryption utilities
 * Encrypts sensitive business context and participant data
 */

import { encryptFields, decryptFields, isEncryptionEnabled } from './encryption';

/**
 * Fields to encrypt in Workshop model
 */
const WORKSHOP_ENCRYPTED_FIELDS: string[] = ['businessContext'];

/**
 * Fields to encrypt in WorkshopParticipant model
 */
const PARTICIPANT_ENCRYPTED_FIELDS: string[] = ['email'];

/**
 * Fields to encrypt in WorkshopScratchpad model
 * Commercial content contains sensitive pricing/investment data
 */
const SCRATCHPAD_ENCRYPTED_FIELDS: string[] = ['commercialContent'];

/**
 * Encrypt workshop data before saving to database
 */
export function encryptWorkshopData(workshop: any) {
  if (!isEncryptionEnabled()) {
    return workshop;
  }

  return encryptFields(workshop, WORKSHOP_ENCRYPTED_FIELDS);
}

/**
 * Decrypt workshop data after reading from database
 */
export function decryptWorkshopData(workshop: any) {
  if (!isEncryptionEnabled() || !workshop) {
    return workshop;
  }

  return decryptFields(workshop, WORKSHOP_ENCRYPTED_FIELDS);
}

/**
 * Encrypt participant data before saving
 */
export function encryptParticipantData(participant: any) {
  if (!isEncryptionEnabled()) {
    return participant;
  }

  return encryptFields(participant, PARTICIPANT_ENCRYPTED_FIELDS);
}

/**
 * Decrypt participant data after reading
 */
export function decryptParticipantData(participant: any) {
  if (!isEncryptionEnabled() || !participant) {
    return participant;
  }

  return decryptFields(participant, PARTICIPANT_ENCRYPTED_FIELDS);
}

/**
 * Encrypt scratchpad commercial content before saving
 */
export function encryptScratchpadData(scratchpad: any) {
  if (!isEncryptionEnabled()) {
    return scratchpad;
  }

  return encryptFields(scratchpad, SCRATCHPAD_ENCRYPTED_FIELDS);
}

/**
 * Decrypt scratchpad commercial content after reading
 */
export function decryptScratchpadData(scratchpad: any) {
  if (!isEncryptionEnabled() || !scratchpad) {
    return scratchpad;
  }

  return decryptFields(scratchpad, SCRATCHPAD_ENCRYPTED_FIELDS);
}

/**
 * Example usage in API routes:
 *
 * // CREATING a workshop
 * const workshopData = {
 *   name: 'Digital Transformation',
 *   businessContext: 'Sensitive business context here...',
 * };
 *
 * const encryptedData = encryptWorkshopData(workshopData);
 * await prisma.workshop.create({ data: encryptedData });
 *
 * // READING a workshop
 * const workshop = await prisma.workshop.findUnique({ where: { id } });
 * const decryptedWorkshop = decryptWorkshopData(workshop);
 * return decryptedWorkshop;
 */
