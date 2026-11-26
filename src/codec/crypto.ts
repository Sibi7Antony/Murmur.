/* ===================================================================
 * WebCrypto AES-GCM + PBKDF2 for optional passphrase protection.
 * Strict error handling: bad passphrase rejects cleanly without garbage.
 * =================================================================== */

export interface EncryptedPayload {
  salt: Uint8Array;      // 16 bytes
  iv: Uint8Array;        // 12 bytes
  ciphertext: Uint8Array;
}

export async function encryptBytes(
  plaintext: Uint8Array,
  passphrase: string,
): Promise<EncryptedPayload> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const payloadIv = iv;
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: payloadIv as any },
    key,
    plaintext as any,
  );

  return {
    salt,
    iv,
    ciphertext: new Uint8Array(ciphertextBuf),
  };
}

export async function decryptBytes(
  payload: EncryptedPayload,
  passphrase: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: payload.salt as any,
      iterations: 250000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: payload.iv as any },
      key,
      payload.ciphertext as any,
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new Error('Incorrect passphrase or corrupt data');
  }
}

export async function computeSha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data as any);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
