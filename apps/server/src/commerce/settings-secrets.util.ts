import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Ciphertext marker so plaintext leftovers (e.g. `sk_…`) stay readable. */
export const SETTINGS_SECRET_PREFIX = 'enc:v1:';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Master key from `SETTINGS_SECRETS_KEY` or `PAYMENT_SECRETS_ENCRYPTION_KEY`.
 * Accepts 32-byte hex (64 chars) or base64.
 */
export function resolveSettingsSecretsKey(): Buffer | null {
  const raw =
    process.env.SETTINGS_SECRETS_KEY?.trim() ||
    process.env.PAYMENT_SECRETS_ENCRYPTION_KEY?.trim() ||
    '';
  if (!raw) return null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    const fromB64 = Buffer.from(raw, 'base64');
    if (fromB64.length === KEY_LENGTH) return fromB64;
  } catch {
    // fall through
  }

  throw new Error(
    'SETTINGS_SECRETS_KEY / PAYMENT_SECRETS_ENCRYPTION_KEY must be 32-byte hex (64 chars) or base64',
  );
}

export function isEncryptedSettingsSecret(value: string): boolean {
  return value.startsWith(SETTINGS_SECRET_PREFIX);
}

export function encryptSettingsSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return `${SETTINGS_SECRET_PREFIX}${payload}`;
}

export function decryptSettingsSecret(ciphertext: string, key: Buffer): string {
  if (!isEncryptedSettingsSecret(ciphertext)) return ciphertext;
  const payload = Buffer.from(ciphertext.slice(SETTINGS_SECRET_PREFIX.length), 'base64');
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted settings secret payload');
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * Encrypt for DB storage when a master key is configured.
 * Plaintext is kept as-is when no key is set (dev / migrate path).
 * Already-encrypted values are left unchanged.
 */
export function sealSettingsSecret(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const trimmed = plaintext.trim();
  if (!trimmed) return null;
  if (isEncryptedSettingsSecret(trimmed)) return trimmed;

  let key: Buffer | null;
  try {
    key = resolveSettingsSecretsKey();
  } catch {
    throw new Error(
      'Invalid SETTINGS_SECRETS_KEY / PAYMENT_SECRETS_ENCRYPTION_KEY; refusing to store payment secret',
    );
  }
  if (!key) return trimmed;
  return encryptSettingsSecret(trimmed, key);
}

/**
 * Decrypt DB value for API use. Plaintext (no `enc:v1:` prefix) passes through.
 * Returns null when ciphertext cannot be opened (missing/invalid key).
 */
export function openSettingsSecret(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;
  if (!isEncryptedSettingsSecret(trimmed)) return trimmed;

  let key: Buffer | null;
  try {
    key = resolveSettingsSecretsKey();
  } catch {
    return null;
  }
  if (!key) return null;
  try {
    return decryptSettingsSecret(trimmed, key);
  } catch {
    return null;
  }
}
