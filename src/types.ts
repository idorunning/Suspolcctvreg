export type CameraType = 'cctv' | 'police_council' | 'other' | 'pfs';
export type UserRole = 'admin' | 'user' | 'viewer';
export type UserStatus = 'pending' | 'approved';
export type EventAction = 'login' | 'logout' | 'camera_added' | 'camera_amended' | 'camera_removed';

export interface Camera {
  id: string;
  name?: string;
  address?: string;
  type: CameraType;
  ownerName?: string;
  policeReferenceNumber?: string;
  latitude: number;
  longitude: number;
  direction?: number;
  fieldOfView?: number;
  viewDistance?: number;
  addedBy: string;
  creatorEmail: string;
  lastVerifiedAt?: any; // Firestore Timestamp
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  needsPasswordChange?: boolean;
  createdAt: any;
}

export interface EventLog {
  id: string;
  action: EventAction;
  userId: string;
  userEmail: string;
  details?: string;
  timestamp: any; // Firestore Timestamp
}
