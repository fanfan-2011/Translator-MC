import { safeStorage } from 'electron'

// Encrypt secrets (API keys) with the OS keychain where available,
// falling back to base64 obfuscation otherwise. Never store plaintext.
export function encryptSecret(plain: string): string {
  if (!plain) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return 'enc:' + safeStorage.encryptString(plain).toString('base64')
    }
  } catch {
    /* fall through */
  }
  return 'plain:' + Buffer.from(plain, 'utf8').toString('base64')
}

export function decryptSecret(stored: string): string {
  if (!stored) return ''
  try {
    if (stored.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
    }
    if (stored.startsWith('plain:')) {
      return Buffer.from(stored.slice(6), 'base64').toString('utf8')
    }
  } catch {
    /* fall through */
  }
  return stored
}
