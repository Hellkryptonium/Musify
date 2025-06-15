import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Box, Typography, Container, Button } from '@mui/material';
import './App.css';
import { MusifyMediasoup } from './mediasoupClient';

function ClubScene() {
  return (
    <Canvas style={{ height: '60vh', background: '#0a0a23' }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color={'#00eaff'} />
      </mesh>
      <OrbitControls enablePan={false} enableZoom={false} />
    </Canvas>
  );
}

function App() {
  const [isDJ, setIsDJ] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState(false);
  const [audioStream, setAudioStream] = React.useState<MediaStream | null>(null);
  const musify = React.useRef<MusifyMediasoup | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    musify.current = new MusifyMediasoup();
    musify.current.socket.on('connect', () => setIsConnected(true));
    musify.current.socket.on('disconnect', () => setIsConnected(false));
    // Listen for newProducer events to auto-consume as a listener
    musify.current.socket.on('newProducer', async ({ producerId, kind }) => {
      if (!isDJ && kind === 'audio') {
        const consumer = await musify.current!.consumeAudio(producerId) as any;
        const stream = new MediaStream([consumer.track]);
        setAudioStream(stream);
        // Play audio
        const audio = new window.Audio();
        audio.srcObject = stream;
        audio.play();
      }
    });
    // Try to fetch existing DJ on join as listener
    musify.current.socket.emit('getExistingProducers', async (producers: any[]) => {
      if (!isDJ && producers && producers.length > 0) {
        // For now, just consume the first available audio producer
        const audioProducer = producers.find(p => p.kind === 'audio');
        if (audioProducer) {
          const consumer = await musify.current!.consumeAudio(audioProducer.producerId) as any;
          const stream = new MediaStream([consumer.track]);
          setAudioStream(stream);
          const audio = new window.Audio();
          audio.srcObject = stream;
          audio.play();
        }
      }
    });
    // Clean up
    return () => {
      musify.current?.socket.disconnect();
    };
  }, [isDJ]);

  React.useEffect(() => {
    if (audioRef.current && audioStream) {
      audioRef.current.srcObject = audioStream;
    }
  }, [audioStream]);

  // Handler for DJ to start streaming mic
  const startDJ = async () => {
    setIsDJ(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setAudioStream(stream);
    await musify.current!.produceAudio(stream.getAudioTracks()[0]);
  };

  // Handler for listener to join and wait for DJ
  const joinAsListener = () => {
    setIsDJ(false);
    // If a DJ is already streaming, backend will emit newProducer
  };

  // Handler for DJ to select and play a music file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsDJ(true);
    // Create audio context and decode file
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    const dest = audioContext.createMediaStreamDestination();
    source.connect(dest);
    source.start();
    // Play locally
    const localAudio = new window.Audio();
    localAudio.src = URL.createObjectURL(file);
    localAudio.play();
    // Stream to mediasoup
    const stream = dest.stream;
    setAudioStream(stream);
    await musify.current!.produceAudio(stream.getAudioTracks()[0]);
  };

  return (
    <Container maxWidth="md" style={{ textAlign: 'center', marginTop: 40 }}>
      <Typography variant="h2" style={{ fontWeight: 700, color: '#00eaff', marginBottom: 16 }}>
        Musify
      </Typography>
      <Typography variant="h5" style={{ color: '#fff', marginBottom: 32 }}>
        Real-Time Cloud DJ Night Platform
      </Typography>
      <ClubScene />
      <Box mt={4}>
        <Button variant="contained" color="primary" size="large" style={{ background: 'linear-gradient(90deg, #00eaff, #7f00ff)', marginRight: 16 }} onClick={startDJ} disabled={!isConnected}>
          Go Live as DJ (Mic)
        </Button>
        <Button variant="outlined" color="secondary" size="large" style={{ borderColor: '#00eaff', color: '#00eaff', marginRight: 16 }} onClick={joinAsListener} disabled={!isConnected}>
          Join as Listener
        </Button>
        <Button variant="contained" color="secondary" size="large" style={{ background: 'linear-gradient(90deg, #7f00ff, #00eaff)' }} onClick={() => fileInputRef.current?.click()} disabled={!isConnected}>
          Go Live as DJ (Music File)
        </Button>
        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </Box>
      {audioStream && (
        <Box mt={4}>
          <audio ref={audioRef} controls autoPlay style={{ width: '100%' }} />
          <Typography variant="body2" color="textSecondary">
            If you don't hear anything, click play above.
          </Typography>
        </Box>
      )}
    </Container>
  );
}

export default App;
