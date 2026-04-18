import { EventEmitter } from 'node:events';
import type { CameraRow } from '../repos/cameras.js';

export type CameraStreamEvent =
  | { kind: 'upsert'; camera: CameraRow }
  | { kind: 'delete'; id: string };

class CameraBus extends EventEmitter {
  publish(event: CameraStreamEvent): void {
    this.emit('event', event);
  }
  subscribe(listener: (event: CameraStreamEvent) => void): () => void {
    this.on('event', listener);
    return () => this.off('event', listener);
  }
}

export const cameraBus = new CameraBus();
cameraBus.setMaxListeners(1000);
