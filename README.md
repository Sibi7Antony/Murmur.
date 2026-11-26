# Murmur

> **Transfer Beyond the Network.**  
> Encode your files into sound, and share them — no internet, no cables, no limits.

Murmur is a client-side acoustic data transmission web application that transfers files between two devices using only the sender's speaker and the receiver's microphone.

---

## Features

- **100% Client-Side & Offline**: No cloud servers, backend APIs, analytics, or user accounts. State lives in memory; all audio processing occurs directly in the browser.
- **Acoustic MFSK Modem**: Multi-Frequency Shift Keying with Gray-coded symbols, raised-cosine/Hann edge shaping, and Goertzel tone power detection.
- **Robust Cross-Correlation Sync**: Dual-chirp preamble (1000–4000 Hz) detected via matched-filter frequency-domain cross-correlation with periodic packet re-synchronization.
- **Fountain Error Correction**: Luby Transform (LT) erasure code with Robust Soliton distribution, allowing receivers to reconstruct the file from any arbitrary subset of surviving packets.
- **End-to-End Encryption**: Optional client-side encryption using WebCrypto PBKDF2-SHA-256 (250,000 iterations) and AES-GCM 256-bit with authenticated integrity.
- **Data Integrity**: CRC-16-CCITT packet-level checksums and full-file SHA-256 cryptographic verification.
- **Real-Time Visuals**: Canvas 2D waterfall spectrogram and DPR-aware oscilloscope waveform rendered at 60 FPS.
- **Modem Presets**:
  - **Robust**: 16 tones, 100 Hz spacing starting near 1500 Hz, 40 ms symbols (100–300 bps effective).
  - **Fast**: 32 tones, 100 Hz spacing, 25 ms symbols.
  - **Quiet**: Near-ultrasonic 17–19 kHz experimental band.

---

## Tech Stack

- **Framework**: React 18 + TypeScript (Strict)
- **Build Tool**: Vite
- **DSP Engine**: Custom framework-free TypeScript (FFT, Goertzel, Chirp, MFSK, LT Fountain Code, Framing)
- **Audio Capture**: Web Audio API + AudioWorklet raw PCM recorder
- **Testing**: Vitest unit test suite

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/Sibi7Antony/Murmur.git

# Navigate into the project
cd Murmur

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Running Tests

```bash
npm test
```

### Production Build

```bash
npm run build
```

---

## License

MIT
