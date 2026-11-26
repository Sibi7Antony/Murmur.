/* ===================================================================
 * CRC-16-CCITT (polynomial 0x1021, initial 0xFFFF)
 * Standard error detection for packets.
 * =================================================================== */

const CRC_TABLE = new Uint16Array(256);

// Initialize table
(() => {
  for (let i = 0; i < 256; i++) {
    let curr = (i << 8) & 0xffff;
    for (let j = 0; j < 8; j++) {
      if ((curr & 0x8000) !== 0) {
        curr = ((curr << 1) ^ 0x1021) & 0xffff;
      } else {
        curr = (curr << 1) & 0xffff;
      }
    }
    CRC_TABLE[i] = curr;
  }
})();

export function computeCrc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    const idx = ((crc >> 8) ^ bytes[i]) & 0xff;
    crc = ((crc << 8) ^ CRC_TABLE[idx]) & 0xffff;
  }
  return crc;
}

export function appendCrc16(payload: Uint8Array): Uint8Array {
  const crc = computeCrc16(payload);
  const out = new Uint8Array(payload.length + 2);
  out.set(payload);
  out[payload.length] = (crc >> 8) & 0xff;
  out[payload.length + 1] = crc & 0xff;
  return out;
}

export function verifyAndStripCrc16(frame: Uint8Array): Uint8Array | null {
  if (frame.length < 2) return null;
  const payload = frame.subarray(0, frame.length - 2);
  const expectedCrc = (frame[frame.length - 2] << 8) | frame[frame.length - 1];
  const actualCrc = computeCrc16(payload);
  if (expectedCrc !== actualCrc) return null;
  return payload;
}
