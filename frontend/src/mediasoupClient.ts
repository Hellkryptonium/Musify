// mediasoupClient.ts
// Utility for connecting to backend mediasoup SFU via Socket.io and mediasoup-client

import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';

const SERVER_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

export class MusifyMediasoup {
  socket: Socket;
  device: mediasoupClient.types.Device | null = null;
  rtpCapabilities: any;
  transport: any;
  producer: any;
  consumer: any;

  constructor() {
    this.socket = io(SERVER_URL);
  }

  async loadDevice() {
    if (!this.device) {
      this.device = new mediasoupClient.Device();
      this.rtpCapabilities = await this.getRtpCapabilities();
      await this.device.load({ routerRtpCapabilities: this.rtpCapabilities });
    }
  }

  getRtpCapabilities(): Promise<any> {
    return new Promise((resolve) => {
      this.socket.emit('getRtpCapabilities', (rtpCapabilities: any) => {
        resolve(rtpCapabilities);
      });
    });
  }

  createTransport(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit('createWebRtcTransport', (params: any) => {
        if (params.error) return reject(params.error);
        resolve(params);
      });
    });
  }

  async connectTransport(transport: any, dtlsParameters: any) {
    return new Promise((resolve, reject) => {
      this.socket.emit('connectTransport', { dtlsParameters }, (res: any) => {
        if (res.error) return reject(res.error);
        resolve(res);
      });
    });
  }

  async produceAudio(track: MediaStreamTrack) {
    await this.loadDevice();
    const params = await this.createTransport();
    this.transport = this.device!.createSendTransport(params);
    this.transport.on('connect', async ({ dtlsParameters }: any, cb: any, errb: any) => {
      try {
        await this.connectTransport(this.transport, dtlsParameters);
        cb();
      } catch (err) {
        errb(err);
      }
    });
    this.transport.on('produce', (params: any, cb: any, errb: any) => {
      this.socket.emit('produce', {
        kind: 'audio',
        rtpParameters: params.rtpParameters,
      }, ({ id, error }: any) => {
        if (error) return errb(error);
        cb({ id });
      });
    });
    this.producer = await this.transport.produce({ track });
  }

  async consumeAudio(producerId: string) {
    await this.loadDevice();
    const params = await this.createTransport();
    this.transport = this.device!.createRecvTransport(params);
    this.transport.on('connect', async ({ dtlsParameters }: any, cb: any, errb: any) => {
      try {
        await this.connectTransport(this.transport, dtlsParameters);
        cb();
      } catch (err) {
        errb(err);
      }
    });
    return new Promise((resolve, reject) => {
      this.socket.emit('consume', {
        producerId,
        rtpCapabilities: this.device!.rtpCapabilities,
      }, async (params: any) => {
        if (params.error) return reject(params.error);
        this.consumer = await this.transport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });
        resolve(this.consumer);
      });
    });
  }
}
