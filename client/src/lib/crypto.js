import { sha256 as nobleSha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(bytes) {
  if (globalThis.crypto?.subtle) {
    try {
      const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      return toHex(new Uint8Array(hash));
    } catch {
      // Fall through to the JavaScript implementation on non-secure origins.
    }
  }
  return bytesToHex(nobleSha256(bytes));
}

export async function sha256Blob(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return digest(bytes);
}

export async function fingerprintFile(file) {
  const input = `${file.name}\u0000${file.size}\u0000${file.lastModified}\u0000${file.type || ''}`;
  return digest(new TextEncoder().encode(input));
}
