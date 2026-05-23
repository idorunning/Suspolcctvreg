import { config } from '../config';
import { getToken } from './api';
import type { Camera } from '../types';

export type CameraStreamEvent =
  | { type: 'snapshot'; cameras: Camera[] }
  | { type: 'upsert'; camera: Camera }
  | { type: 'delete'; id: string };

export function subscribeCameras(
  onEvent: (ev: CameraStreamEvent) => void,
  onError?: (message: string) => void,
): () => void {
  const token = getToken();
  if (!token) {
    onError?.('Not authenticated');
    return () => undefined;
  }

  // EventSource cannot set custom headers; token goes in the query string
  // and is validated server-side against the same JWT secret.
  const url = `${config.apiBaseUrl}/cameras/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  const handle = (raw: MessageEvent) => {
    try {
      const payload = JSON.parse(raw.data) as CameraStreamEvent;
      onEvent(payload);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Malformed stream payload');
    }
  };

  es.addEventListener('snapshot', handle as EventListener);
  es.addEventListener('upsert', handle as EventListener);
  es.addEventListener('delete', handle as EventListener);

  es.onerror = () => {
    onError?.('Realtime connection lost. Retrying…');
  };

  return () => es.close();
}
