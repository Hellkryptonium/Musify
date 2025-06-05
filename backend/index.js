require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const mediasoupConfig = require('./mediasoupConfig');
// mediasoup setup will be added soon

const app = express();
const server = http.createServer(app);

// Allow CORS for frontend dev
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Mediasoup variables
let worker;
let router;
let audioTransportMap = new Map(); // Map<socketId, {producer, transport}>
// Keep track of current audio producers
let currentProducers = new Map(); // Map<socketId, {kind}>

// Start mediasoup worker and router
async function startMediasoup() {
  worker = await mediasoup.createWorker(mediasoupConfig.worker);
  router = await worker.createRouter({ mediaCodecs: mediasoupConfig.mediaCodecs });
  console.log('Mediasoup worker and router started');
}

startMediasoup();

// Basic Socket.io event
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Client requests RTP capabilities
  socket.on('getRtpCapabilities', (cb) => {
    cb(router.rtpCapabilities);
  });

  // Client creates a WebRTC transport
  socket.on('createWebRtcTransport', async (cb) => {
    try {
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });
      audioTransportMap.set(socket.id, { transport });
      cb({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (err) {
      console.error('Error creating WebRTC transport:', err);
      cb({ error: err.message });
    }
  });

  // Client connects transport
  socket.on('connectTransport', async ({ dtlsParameters }, cb) => {
    const entry = audioTransportMap.get(socket.id);
    if (!entry) return cb({ error: 'No transport found' });
    await entry.transport.connect({ dtlsParameters });
    cb({ connected: true });
  });

  // Client produces audio
  socket.on('produce', async ({ kind, rtpParameters }, cb) => {
    const entry = audioTransportMap.get(socket.id);
    if (!entry) return cb({ error: 'No transport found' });
    const producer = await entry.transport.produce({ kind, rtpParameters });
    entry.producer = producer;
    currentProducers.set(socket.id, { kind, producerId: producer.id });
    cb({ id: producer.id });
    // Broadcast to all other clients
    socket.broadcast.emit('newProducer', { socketId: socket.id, kind, producerId: producer.id });
  });

  // Client consumes audio
  socket.on('consume', async ({ producerId, rtpCapabilities }, cb) => {
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      console.error('Cannot consume', { producerId, rtpCapabilities, routerCaps: router.rtpCapabilities });
      return cb({ error: 'Cannot consume' });
    }
    const entry = audioTransportMap.get(socket.id);
    if (!entry) return cb({ error: 'No transport found' });
    const consumer = await entry.transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });
    cb({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  });

  // Provide list of current producers
  socket.on('getExistingProducers', (cb) => {
    const producers = Array.from(currentProducers.entries()).map(([socketId, { kind, producerId }]) => ({ socketId, kind, producerId }));
    cb(producers);
  });

  socket.on('disconnect', () => {
    // Clean up mediasoup resources
    const entry = audioTransportMap.get(socket.id);
    if (entry) {
      if (entry.producer) entry.producer.close();
      if (entry.transport) entry.transport.close();
      audioTransportMap.delete(socket.id);
    }
    currentProducers.delete(socket.id);
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
