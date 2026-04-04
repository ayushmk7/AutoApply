import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { config } from './config.js';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function encryptionKey(): Buffer {
  const hex = config.tokenEncryptionKeyHex?.trim();
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  if (config.nodeEnv === 'production') {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters in production');
  }
  return scryptSync('dev-token-encryption', 'autoapply-salt', 32);
}

/**
 * Phase 15 — encrypt JSON / UTF-8 strings for Firestore (`docs/03_BACKEND_PRD.md` §8.1).
 * Format: base64(iv || ciphertext+tag)
 */
export function encryptAtRest(plainUtf8: string): string {
  const key = encryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plainUtf8, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

export function decryptAtRest(b64: string): string {
  const key = encryptionKey();
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('invalid_ciphertext');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const data = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
