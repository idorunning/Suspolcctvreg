// Password-derived AES-GCM encryption for the registry data blob.
// PBKDF2 (SHA-256, 210k iterations) → AES-GCM-256 key.

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedBlob {
  v: 1;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 ciphertext
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(value: unknown, password: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const plaintext = encoder.encode(JSON.stringify(value));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    v: 1,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptJson<T>(blob: EncryptedBlob, password: string): Promise<T> {
  if (blob.v !== 1) throw new Error('Unsupported file format');
  const salt = fromB64(blob.salt);
  const iv = fromB64(blob.iv);
  const data = fromB64(blob.data);
  const key = await deriveKey(password, salt);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(decoder.decode(plainBuf)) as T;
}
