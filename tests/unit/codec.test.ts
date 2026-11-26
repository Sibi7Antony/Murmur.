import { describe, it, expect } from 'vitest';
import { computeCrc16, appendCrc16, verifyAndStripCrc16 } from '../../src/codec/crc';
import { FountainEncoder, FountainDecoder } from '../../src/codec/fountain';
import { buildFrame, parseFrame, serializeMetadata, deserializeMetadata } from '../../src/codec/framing';
import { encryptBytes, decryptBytes } from '../../src/codec/crypto';
import { bytesToSymbols, symbolsToBytes } from '../../src/modem/mfsk';

describe('CRC-16 CCITT', () => {
  it('verifies known vector "123456789"', () => {
    const testVec = new TextEncoder().encode('123456789');
    const crc = computeCrc16(testVec);
    expect(crc).toBe(0x29b1); // Standard CRC-16-CCITT check value
  });

  it('append and verify round-trips cleanly', () => {
    const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x42]);
    const framed = appendCrc16(payload);
    expect(framed.length).toBe(payload.length + 2);

    const stripped = verifyAndStripCrc16(framed);
    expect(stripped).not.toBeNull();
    expect(Array.from(stripped!)).toEqual(Array.from(payload));
  });

  it('detects corrupted byte in payload', () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const framed = appendCrc16(payload);
    framed[2] ^= 0x01; // Corrupt a bit
    expect(verifyAndStripCrc16(framed)).toBeNull();
  });
});

describe('WebCrypto AES-GCM + PBKDF2', () => {
  it('encrypts and decrypts round-trip with correct passphrase', async () => {
    const message = new TextEncoder().encode('Murmur secret sound payload');
    const passphrase = 'correct-horse-battery-staple';

    const enc = await encryptBytes(message, passphrase);
    const dec = await decryptBytes(enc, passphrase);

    expect(new TextDecoder().decode(dec)).toBe('Murmur secret sound payload');
  });

  it('fails cleanly on wrong passphrase without returning garbage', async () => {
    const message = new TextEncoder().encode('Sensitive acoustic data');
    const enc = await encryptBytes(message, 'correct-passphrase');

    await expect(decryptBytes(enc, 'wrong-passphrase')).rejects.toThrow(
      'Incorrect passphrase or corrupt data',
    );
  });
});

describe('Fountain Code (Luby Transform)', () => {
  it('recovers 100% of data under 40% packet loss', () => {
    const dataSize = 512;
    const testData = new Uint8Array(dataSize);
    for (let i = 0; i < dataSize; i++) testData[i] = (i * 37 + 13) & 0xff;

    const blockSize = 32;
    const encoder = new FountainEncoder(testData, blockSize);
    const decoder = new FountainDecoder(encoder.k, blockSize);

    let packetIdx = 0;
    while (!decoder.isComplete && packetIdx < 300) {
      // Simulate 40% packet loss
      const dropped = Math.random() < 0.4;
      if (!dropped) {
        const encPacket = encoder.encode(packetIdx);
        decoder.addPacket(packetIdx, encPacket.data);
      }
      packetIdx++;
    }

    expect(decoder.isComplete).toBe(true);
    const reconstructed = decoder.reconstruct(dataSize);
    expect(Array.from(reconstructed)).toEqual(Array.from(testData));
  });
});

describe('Packet Framing', () => {
  it('buildFrame and parseFrame round-trip', () => {
    const header = {
      version: 1,
      sessionId: 4242,
      packetIndex: 17,
      sourceBlockCount: 32,
      payloadLen: 0,
    };
    const payload = new Uint8Array([10, 20, 30, 40, 50]);
    const frame = buildFrame(header, payload);

    const parsed = parseFrame(frame);
    expect(parsed).not.toBeNull();
    expect(parsed!.header.sessionId).toBe(4242);
    expect(parsed!.header.packetIndex).toBe(17);
    expect(Array.from(parsed!.payload)).toEqual(Array.from(payload));
  });

  it('metadata serialization and deserialization round-trip', () => {
    const meta = {
      filename: 'song.txt',
      size: 1024,
      mimeType: 'text/plain',
      blockSize: 32,
      blockCount: 32,
      encrypted: true,
      saltHex: '01020304',
      ivHex: '05060708',
      sha256: 'abcdef1234567890',
    };
    const bytes = serializeMetadata(meta);
    const back = deserializeMetadata(bytes);
    expect(back).toEqual(meta);
  });
});

describe('MFSK Gray Coding', () => {
  it('bytes to symbols and back round-trips for 4 bits/symbol', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const symbols = bytesToSymbols(bytes, 4);
    const recovered = symbolsToBytes(symbols, 4, bytes.length);
    expect(Array.from(recovered)).toEqual(Array.from(bytes));
  });
});
