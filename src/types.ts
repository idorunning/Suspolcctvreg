export type CameraType = 'cctv' | 'police_council' | 'other' | 'pfs';
export type UserRole = 'admin' | 'user' | 'viewer';
export type UserStatus = 'pending' | 'approved';
export type EventAction =
  | 'login'
  | 'logout'
  | 'camera_added'
  | 'camera_amended'
  | 'camera_removed';

// ISO-8601 date strings from the backend API.
export type Timestamp = string;

export interface Camera {
  id: string;
  name?: string | null;
  address?: string | null;
  type: CameraType;
  ownerName?: string | null;
  policeReferenceNumber?: string | null;
  latitude: number;
  longitude: number;
  direction?: number | null;
  fieldOfView?: number | null;
  viewDistance?: number | null;
  addedBy: string;
  creatorEmail: string;
  lastVerifiedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp;
}

export interface EventLog {
  id: string;
  action: EventAction;
  userId: string;
  userEmail: string;
  details?: string | null;
  timestamp: Timestamp;
}
