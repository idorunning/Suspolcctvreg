// Persists a FileSystemDirectoryHandle in IndexedDB and reads/writes the
// encrypted data file inside that folder.

import { openDB, type IDBPDatabase } from 'idb';
import type { RegistryState } from '../types';
import { encryptJson, decryptJson, type EncryptedBlob } from './crypto';

const DATA_FILE = 'cctv-data.json';
const DB_NAME = 'sussex-cctv-registry';
const STORE = 'handles';
const HANDLE_KEY = 'folder';

// Feature detection — File System Access API is Chromium-only.
export const isFsaSupported = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

let dbPromise: Promise<IDBPDatabase> | null = null;
const idb = (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
};

export class ConcurrencyError extends Error {
  constructor(message = 'Another teammate has saved newer changes.') {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong password.');
    this.name = 'WrongPasswordError';
  }
}

let cachedFolder: FileSystemDirectoryHandle | null = null;
let lastSeenMtime: number | null = null;
let lastLoadedState: RegistryState | null = null;
let lastPassword: string | null = null;

export async function loadStoredFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedFolder) return cachedFolder;
  if (!isFsaSupported()) return null;
  const db = await idb();
  const handle = (await db.get(STORE, HANDLE_KEY)) as FileSystemDirectoryHandle | undefined;
  if (!handle) return null;
  cachedFolder = handle;
  return handle;
}

async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  // Casting because FSA permission API isn't in the default TS lib yet.
  const opts = { mode: 'readwrite' as const };
  const h = handle as unknown as {
    queryPermission: (o: typeof opts) => Promise<PermissionState>;
    requestPermission: (o: typeof opts) => Promise<PermissionState>;
  };
  if ((await h.queryPermission(opts)) === 'granted') return true;
  return (await h.requestPermission(opts)) === 'granted';
}

export async function pickFolder(): Promise<FileSystemDirectoryHandle> {
  if (!isFsaSupported()) throw new Error('Your browser cannot pick a folder. Use Chrome or Edge on a laptop.');
  // Cast window to access FSA picker without lib.dom changes.
  const picker = (window as unknown as {
    showDirectoryPicker: (o?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  const handle = await picker({ mode: 'readwrite' });
  const granted = await ensurePermission(handle);
  if (!granted) throw new Error('Permission to read and write the folder was denied.');
  const db = await idb();
  await db.put(STORE, handle, HANDLE_KEY);
  cachedFolder = handle;
  lastSeenMtime = null;
  return handle;
}

export async function forgetFolder(): Promise<void> {
  const db = await idb();
  await db.delete(STORE, HANDLE_KEY);
  cachedFolder = null;
  lastSeenMtime = null;
  lastLoadedState = null;
  lastPassword = null;
}

async function getFile(): Promise<{ file: File; handle: FileSystemFileHandle } | null> {
  const folder = cachedFolder;
  if (!folder) throw new Error('No folder connected yet.');
  try {
    const handle = await folder.getFileHandle(DATA_FILE, { create: false });
    const file = await handle.getFile();
    return { file, handle };
  } catch {
    return null;
  }
}

export async function hasExistingData(): Promise<boolean> {
  const folder = await loadStoredFolder();
  if (!folder) return false;
  if (!(await ensurePermission(folder))) return false;
  return (await getFile()) !== null;
}

function emptyState(): RegistryState {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    cameras: [],
    meta: { createdAt: now, updatedAt: now },
  };
}

async function writeBlob(blob: EncryptedBlob): Promise<number> {
  const folder = cachedFolder;
  if (!folder) throw new Error('No folder connected yet.');
  const handle = await folder.getFileHandle(DATA_FILE, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(blob));
  await writable.close();
  const file = await handle.getFile();
  return file.lastModified;
}

export async function setupPassword(password: string): Promise<RegistryState> {
  const folder = await loadStoredFolder();
  if (!folder) throw new Error('No folder connected yet.');
  if (!(await ensurePermission(folder))) throw new Error('Permission denied.');
  const state = emptyState();
  const blob = await encryptJson(state, password);
  lastSeenMtime = await writeBlob(blob);
  lastLoadedState = state;
  lastPassword = password;
  return state;
}

export async function unlock(password: string): Promise<RegistryState> {
  const folder = await loadStoredFolder();
  if (!folder) throw new Error('No folder connected yet.');
  if (!(await ensurePermission(folder))) throw new Error('Permission denied.');
  const found = await getFile();
  if (!found) throw new Error('Data file not found in the chosen folder.');
  let blob: EncryptedBlob;
  try {
    blob = JSON.parse(await found.file.text()) as EncryptedBlob;
  } catch {
    throw new Error('Data file is not in the expected format.');
  }
  try {
    const state = await decryptJson<RegistryState>(blob, password);
    lastSeenMtime = found.file.lastModified;
    lastLoadedState = state;
    lastPassword = password;
    return state;
  } catch {
    throw new WrongPasswordError();
  }
}

export async function reloadFromDisk(): Promise<RegistryState> {
  if (!lastPassword) throw new Error('Not unlocked yet.');
  return unlock(lastPassword);
}

export async function save(state: RegistryState): Promise<void> {
  if (!lastPassword) throw new Error('Not unlocked yet.');
  const found = await getFile();
  if (found && lastSeenMtime !== null && found.file.lastModified > lastSeenMtime) {
    throw new ConcurrencyError();
  }
  const stamped: RegistryState = {
    ...state,
    meta: { ...state.meta, updatedAt: new Date().toISOString() },
  };
  const blob = await encryptJson(stamped, lastPassword);
  lastSeenMtime = await writeBlob(blob);
  lastLoadedState = stamped;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const state = await unlock(oldPassword);
  lastPassword = newPassword;
  await save(state);
}

export function currentMtime(): number | null {
  return lastSeenMtime;
}

export async function peekMtime(): Promise<number | null> {
  const found = await getFile();
  return found ? found.file.lastModified : null;
}

export function getLastLoadedState(): RegistryState | null {
  return lastLoadedState;
}
