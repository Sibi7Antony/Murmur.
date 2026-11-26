/* ===================================================================
 * Packet Framing and Metadata structures.
 * Packet: [chirp][sync word][header (8 bytes)][payload][CRC-16 (2 bytes)]
 * Header: [version(1B), sessionId(2B), packetIndex(2B), sourceBlockCount(2B), payloadLen(1B)]
 * =================================================================== */

import { appendCrc16, verifyAndStripCrc16 } from './crc';

export const PROTOCOL_VERSION = 1;
export const SYNC_WORD = [3, 7, 12, 1, 15]; // Fixed symbol sequence for MFSK sync

export interface PacketHeader {
  version: number;
  sessionId: number;
  packetIndex: number;
  sourceBlockCount: number;
  payloadLen: number;
}

export interface MetadataPayload {
  filename: string;
  size: number;
  mimeType: string;
  blockSize: number;
  blockCount: number;
  encrypted: boolean;
  saltHex?: string;
  ivHex?: string;
  sha256: string;
}

export function encodeHeader(h: PacketHeader): Uint8Array {
  const buf = new Uint8Array(8);
  buf[0] = h.version & 0xff;
  buf[1] = (h.sessionId >> 8) & 0xff;
  buf[2] = h.sessionId & 0xff;
  buf[3] = (h.packetIndex >> 8) & 0xff;
  buf[4] = h.packetIndex & 0xff;
  buf[5] = (h.sourceBlockCount >> 8) & 0xff;
  buf[6] = h.sourceBlockCount & 0xff;
  buf[7] = h.payloadLen & 0xff;
  return buf;
}

export function decodeHeader(bytes: Uint8Array): PacketHeader {
  if (bytes.length < 8) throw new Error('Header too short');
  return {
    version: bytes[0],
    sessionId: (bytes[1] << 8) | bytes[2],
    packetIndex: (bytes[3] << 8) | bytes[4],
    sourceBlockCount: (bytes[5] << 8) | bytes[6],
    payloadLen: bytes[7],
  };
}

export function buildFrame(header: PacketHeader, payload: Uint8Array): Uint8Array {
  header.payloadLen = payload.length;
  const headerBytes = encodeHeader(header);
  const combined = new Uint8Array(headerBytes.length + payload.length);
  combined.set(headerBytes, 0);
  combined.set(payload, headerBytes.length);
  return appendCrc16(combined);
}

export function parseFrame(
  frame: Uint8Array,
): { header: PacketHeader; payload: Uint8Array } | null {
  const verified = verifyAndStripCrc16(frame);
  if (!verified || verified.length < 8) return null;

  const header = decodeHeader(verified.subarray(0, 8));
  if (header.version !== PROTOCOL_VERSION) return null;
  const payload = verified.subarray(8, 8 + header.payloadLen);
  return { header, payload };
}

export function serializeMetadata(meta: MetadataPayload): Uint8Array {
  const json = JSON.stringify(meta);
  return new TextEncoder().encode(json);
}

export function deserializeMetadata(bytes: Uint8Array): MetadataPayload | null {
  try {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as MetadataPayload;
  } catch {
    return null;
  }
}
