
import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

// Decode the 64-char hex key into a 32-byte Buffer once at module load
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');

/**
 * Encrypts plaintext string using AES-256-GCM.
 * @returns hex-encoded "iv:authTag:ciphertext"
 */
export function encrypt(plaintext: string): string {
  // Fresh random IV for every encryption — critical for semantic security
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // GCM authentication tag — must be extracted AFTER calling final()
  const authTag = cipher.getAuthTag();

  // Colon-separated hex encoding — easy to split, no ambiguity
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an "iv:authTag:ciphertext" string produced by encrypt().
 * Throws a descriptive error if the format is wrong or decryption fails
 * (which includes tamper detection — GCM authTag mismatch).
 */
export function decrypt(encryptedString: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Encrypted value has invalid format — expected "iv:authTag:ciphertext"'
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  // Must set auth tag before calling update — GCM verifies it on final()
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(), // throws if authTag doesn't match (tampered ciphertext)
    ]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error(
      'Decryption failed — ciphertext may have been tampered with or the key is wrong'
    );
  }
}
