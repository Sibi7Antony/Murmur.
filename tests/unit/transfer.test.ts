import { describe, it, expect } from 'vitest';
import { PRESETS } from '../../src/engine/types';
import { FountainEncoder, FountainDecoder } from '../../src/codec/fountain';
import { buildFrame, parseFrame, serializeMetadata, deserializeMetadata, PacketHeader } from '../../src/codec/framing';
import { bytesToSymbols, symbolsToBytes, modulateMFSK, demodulateMFSK } from '../../src/modem/mfsk';
import { generatePacketHeaderSync, detectPacketSync, verifySyncWord } from '../../src/modem/sync';
import { computeSha256Hex } from '../../src/codec/crypto';
import { getPacketSyncChirp } from '../../src/dsp/chirp';

describe('Acoustic File Transfer Simulation End-to-End', () => {
  it('transfers and reconstructs a 2 KB file bit-exact over simulated audio stream', async () => {
    const preset = PRESETS.robust;
    const sampleRate = 48000;
    const blockSize = 32;

    // Create 2 KB test payload (2048 bytes)
    const originalBytes = new Uint8Array(2048);
    for (let i = 0; i < originalBytes.length; i++) {
      originalBytes[i] = (i * 31 + 7) & 0xff;
    }
    const originalSha256 = await computeSha256Hex(originalBytes);

    const encoder = new FountainEncoder(originalBytes, blockSize);
    const totalBlocks = encoder.k; // 64 blocks
    const sessionId = 42;

    const metadataBytes = serializeMetadata({
      filename: 'document.txt',
      size: originalBytes.length,
      mimeType: 'text/plain',
      blockSize,
      blockCount: totalBlocks,
      encrypted: false,
      sha256: originalSha256,
    });

    // Generate audio for metadata packet and systematic data packets (k packets)
    // Packet structure: [30ms chirp][5 sync symbols][frame audio]
    const packetsAudio: Float32Array[] = [];

    // Packet 0: Metadata
    {
      const metaHeader: PacketHeader = {
        version: 1,
        sessionId,
        packetIndex: 0xffff,
        sourceBlockCount: totalBlocks,
        payloadLen: metadataBytes.length,
      };
      const metaFrame = buildFrame(metaHeader, metadataBytes);
      const metaSymbols = bytesToSymbols(metaFrame, preset.bitsPerSymbol);
      const syncAudio = generatePacketHeaderSync(preset, sampleRate);
      const dataAudio = modulateMFSK(metaSymbols, preset, sampleRate);
      const packet = new Float32Array(syncAudio.length + dataAudio.length);
      packet.set(syncAudio, 0);
      packet.set(dataAudio, syncAudio.length);
      packetsAudio.push(packet);
    }

    // Packets 1..k: Data packets
    for (let pIdx = 0; pIdx < totalBlocks; pIdx++) {
      const encResult = encoder.encode(pIdx);
      const header: PacketHeader = {
        version: 1,
        sessionId,
        packetIndex: pIdx,
        sourceBlockCount: totalBlocks,
        payloadLen: encResult.data.length,
      };
      const frame = buildFrame(header, encResult.data);
      const symbols = bytesToSymbols(frame, preset.bitsPerSymbol);
      const syncAudio = generatePacketHeaderSync(preset, sampleRate);
      const dataAudio = modulateMFSK(symbols, preset, sampleRate);
      const packet = new Float32Array(syncAudio.length + dataAudio.length);
      packet.set(syncAudio, 0);
      packet.set(dataAudio, syncAudio.length);
      packetsAudio.push(packet);
    }

    // Concatenate all packets with some random inter-packet silence/gap (e.g. 50ms)
    const gapSamples = Math.round(0.05 * sampleRate); // 50ms gap
    let totalLen = 0;
    packetsAudio.forEach((p) => {
      totalLen += p.length + gapSamples;
    });

    const fullStream = new Float32Array(totalLen);
    let curPos = 0;
    for (const p of packetsAudio) {
      fullStream.set(p, curPos);
      curPos += p.length + gapSamples;
    }

    // Now RECEIVER processes fullStream using streaming receiver logic
    let streamBuf = fullStream;
    let decoder: FountainDecoder | null = null;
    let decodedMetadata: any = null;
    const chirp = getPacketSyncChirp(sampleRate);
    const samplesPerSymbol = Math.round((preset.symbolDurationMs / 1000) * sampleRate);
    const headerSymbolCount = Math.ceil((8 * 8) / preset.bitsPerSymbol);

    let packetsProcessed = 0;

    while (streamBuf.length >= chirp.length + 5 * samplesPerSymbol + headerSymbolCount * samplesPerSymbol) {
      const searchLen = Math.min(streamBuf.length, 32768);
      const searchWindow = streamBuf.subarray(0, searchLen);

      const syncRes = detectPacketSync(searchWindow, sampleRate, 3.5);
      if (!syncRes.detected) {
        const discard = Math.max(0, searchLen - chirp.length * 2);
        if (discard <= 0) break;
        streamBuf = streamBuf.subarray(discard);
        continue;
      }

      const peakIdx = syncRes.sampleIndex;
      const syncWordStart = peakIdx + chirp.length;
      const syncWordEnd = syncWordStart + 5 * samplesPerSymbol;

      if (streamBuf.length < syncWordEnd) break;

      const syncSlice = streamBuf.subarray(syncWordStart, syncWordEnd);
      const syncSymbols = demodulateMFSK(syncSlice, 5, preset, sampleRate);

      if (!verifySyncWord(syncSymbols)) {
        streamBuf = streamBuf.subarray(peakIdx + chirp.length);
        continue;
      }

      const headerStart = syncWordEnd;
      const headerEnd = headerStart + headerSymbolCount * samplesPerSymbol;

      if (streamBuf.length < headerEnd) break;

      const headerSlice = streamBuf.subarray(headerStart, headerEnd);
      const headerSymbols = demodulateMFSK(headerSlice, headerSymbolCount, preset, sampleRate);
      const headerBytes = symbolsToBytes(headerSymbols, preset.bitsPerSymbol, 8);
      const header = {
        version: headerBytes[0],
        sessionId: (headerBytes[1] << 8) | headerBytes[2],
        packetIndex: (headerBytes[3] << 8) | headerBytes[4],
        sourceBlockCount: (headerBytes[5] << 8) | headerBytes[6],
        payloadLen: headerBytes[7],
      };

      const totalFrameBytes = 8 + header.payloadLen + 2;
      const totalFrameSymbols = Math.ceil((totalFrameBytes * 8) / preset.bitsPerSymbol);
      const totalFrameSamples = totalFrameSymbols * samplesPerSymbol;
      const packetEnd = headerStart + totalFrameSamples;

      if (streamBuf.length < packetEnd) break;

      const frameSlice = streamBuf.subarray(headerStart, packetEnd);
      const frameSymbols = demodulateMFSK(frameSlice, totalFrameSymbols, preset, sampleRate);
      const frameBytes = symbolsToBytes(frameSymbols, preset.bitsPerSymbol, totalFrameBytes);

      const parsed = parseFrame(frameBytes);
      expect(parsed).not.toBeNull();

      if (parsed) {
        if (parsed.header.packetIndex === 0xffff) {
          decodedMetadata = deserializeMetadata(parsed.payload);
          expect(decodedMetadata).not.toBeNull();
          decoder = new FountainDecoder(decodedMetadata.blockCount, decodedMetadata.blockSize);
        } else if (decoder) {
          decoder.addPacket(parsed.header.packetIndex, parsed.payload);
          packetsProcessed++;
        }
      }

      streamBuf = streamBuf.subarray(packetEnd);

      if (decoder && decoder.isComplete) {
        break;
      }
    }

    expect(decodedMetadata).not.toBeNull();
    expect(decodedMetadata.filename).toBe('document.txt');
    expect(decoder).not.toBeNull();
    expect(decoder!.isComplete).toBe(true);

    const reconstructedBytes = decoder!.reconstruct(decodedMetadata.size);
    expect(reconstructedBytes.length).toBe(originalBytes.length);
    expect(Array.from(reconstructedBytes)).toEqual(Array.from(originalBytes));

    const reconstructedSha256 = await computeSha256Hex(reconstructedBytes);
    expect(reconstructedSha256).toBe(originalSha256);
  }, 60000);
});
