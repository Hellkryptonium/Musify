// mediasoupConfig.js
// Basic mediasoup server configuration for Musify

module.exports = {
  // Worker settings
  numWorkers: 1, // For production, set to require('os').cpus().length
  worker: {
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },
  // Router media codecs (Opus for audio, VP8 for video)
  mediaCodecs: [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {},
    },
  ],
};
