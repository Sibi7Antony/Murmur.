/* ===================================================================
 * All user-facing strings in one place.
 * Default to accurate copy; reference strings in comments for swap.
 * =================================================================== */

export const COPY = {
  brand: 'Murmur',
  tagline: 'Transfer Beyond the Network.',
  taglineItalicWord: 'Beyond',

  heroBody: [
    'Encode your files into sound,',
    // reference: 'and share them \u2014 no internet, no limits.'
    'and share them \u2014 no internet, no cables.',
  ],

  btnSend: 'Start Sending',
  btnReceive: 'Start Receiving',

  nav: {
    home: 'Home',
    send: 'Send',
    receive: 'Receive',
    test: 'Test',
    settings: 'Settings',
  },

  features: [
    {
      label: 'Audio Encoding',
      sub: 'Turn files into tones',
    },
    {
      label: 'Error Correction',
      sub: 'Reliable & robust',
    },
    // reference: { label: 'Fast Transfer', sub: 'In seconds' }
    {
      label: 'Small Files',
      sub: 'A few KB, no network',
    },
    {
      label: 'Works Offline',
      sub: 'No internet needed',
    },
  ],

  footer: 'Murmur \u2022 Transfer Beyond the Network.',

  status: {
    ready: 'Ready to Connect',
    requestingMic: 'Requesting Mic',
    listening: 'Listening',
    locked: 'Locked',
    receiving: 'Receiving',
    sending: 'Sending',
    micBlocked: 'Mic Blocked',
    unsupported: 'Unsupported Browser',
    demo: 'Demo Mode',
  },

  demoWarning: 'Demo Mode \u2014 no real audio processing',

  privacyNote: 'Audio is processed on this device and never uploaded.',
} as const;
