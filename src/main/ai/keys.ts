import { safeStorage, app } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';

// Stored as a binary file (encrypted ciphertext from safeStorage).
// We don't put it in electron-store JSON because store fields don't
// roundtrip raw Buffer ciphertext well across versions.
function keyPath(): string {
  return join(app.getPath('userData'), 'ai-key.bin');
}

export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

export async function saveKey(plainKey: string): Promise<void> {
  if (!isEncryptionAvailable()) {
    throw new Error('OS keychain encryption is not available on this Mac.');
  }
  const cipher = safeStorage.encryptString(plainKey);
  await fs.writeFile(keyPath(), cipher, { mode: 0o600 });
}

export async function clearKey(): Promise<void> {
  await fs.rm(keyPath(), { force: true });
}

export async function loadKey(): Promise<string | null> {
  try {
    const cipher = await fs.readFile(keyPath());
    if (!isEncryptionAvailable()) return null;
    return safeStorage.decryptString(cipher);
  } catch {
    return null;
  }
}

export async function hasKey(): Promise<boolean> {
  try {
    const st = await fs.stat(keyPath());
    return st.size > 0;
  } catch {
    return false;
  }
}
