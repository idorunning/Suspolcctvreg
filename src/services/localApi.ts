// In-memory CRUD against the loaded RegistryState, with save-after-mutate.
// Exposes the same shape components used previously, but talks to the local
// encrypted JSON in the user's OneDrive folder.

import type { Camera, RegistryState } from '../types';
import { getLastLoadedState, save } from './storage';

const listeners = new Set<(cameras: Camera[]) => void>();
let cameras: Camera[] = [];

export function bootFromState(state: RegistryState): void {
  cameras = state.cameras.slice();
  emit();
}

function emit() {
  for (const l of listeners) l(cameras);
}

export function subscribe(listener: (cameras: Camera[]) => void): () => void {
  listeners.add(listener);
  listener(cameras);
  return () => {
    listeners.delete(listener);
  };
}

export function listCameras(): Camera[] {
  return cameras;
}

async function persist(): Promise<void> {
  const state = getLastLoadedState();
  if (!state) throw new Error('Registry not unlocked.');
  const next: RegistryState = { ...state, cameras };
  await save(next);
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function createCamera(
  input: Partial<Camera>,
  addedBy: string | null,
): Promise<Camera> {
  if (typeof input.latitude !== 'number' || typeof input.longitude !== 'number') {
    throw new Error('Camera needs a latitude and longitude.');
  }
  if (!input.type) throw new Error('Camera type is required.');
  const now = new Date().toISOString();
  const cam: Camera = {
    id: newId(),
    type: input.type,
    name: input.name ?? null,
    address: input.address ?? null,
    policeReferenceNumber: input.policeReferenceNumber ?? null,
    publicOutputUrl: input.publicOutputUrl ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    direction: input.direction ?? null,
    fieldOfView: input.fieldOfView ?? null,
    viewDistance: input.viewDistance ?? null,
    addedBy,
    createdAt: now,
    updatedAt: now,
    lastVerifiedAt: null,
  };
  cameras = [cam, ...cameras];
  await persist();
  emit();
  return cam;
}

export async function updateCamera(id: string, patch: Partial<Camera>): Promise<Camera> {
  const idx = cameras.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Camera not found.');
  const now = new Date().toISOString();
  const merged: Camera = { ...cameras[idx], ...patch, id, updatedAt: now };
  cameras = cameras.slice();
  cameras[idx] = merged;
  await persist();
  emit();
  return merged;
}

export async function verifyCamera(id: string): Promise<Camera> {
  return updateCamera(id, { lastVerifiedAt: new Date().toISOString() });
}

export async function deleteCamera(id: string): Promise<void> {
  cameras = cameras.filter((c) => c.id !== id);
  await persist();
  emit();
}
