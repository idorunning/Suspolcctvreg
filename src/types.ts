export type CameraType = 'cctv' | 'police_council' | 'pfs' | 'other';

// ISO-8601 date strings, used in the local JSON file.
export type Timestamp = string;

export interface Camera {
  id: string;
  type: CameraType;
  name?: string | null;
  address?: string | null;
  policeReferenceNumber?: string | null;
  publicOutputUrl?: string | null;
  latitude: number;
  longitude: number;
  direction?: number | null;
  fieldOfView?: number | null;
  viewDistance?: number | null;
  addedBy?: string | null; // free-form initials, informational only
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastVerifiedAt?: Timestamp | null;
}

// What a circle/area filter holds when one is active.
export interface AreaFilter {
  lat: number;
  lng: number;
  radiusM: number;
}

// Persisted, encrypted file shape.
export interface RegistryState {
  schemaVersion: 1;
  cameras: Camera[];
  meta: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
  };
}
