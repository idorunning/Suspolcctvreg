import { config } from '../config';
import type { Camera, EventLog, User, UserRole } from '../types';

const TOKEN_KEY = 'suspol_jwt';
const USER_KEY = 'suspol_user';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface CurrentUser {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  status: 'pending' | 'approved';
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string | null, user: CurrentUser | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function getCachedUser(): CurrentUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) {
    setSession(null, null);
    window.dispatchEvent(new Event('suspol:session-expired'));
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export interface LoginResponse {
  token: string;
  user: CurrentUser;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<CurrentUser>('GET', '/auth/me'),

  listUsers: () => request<User[]>('GET', '/users'),
  updateUser: (id: string, patch: Partial<Pick<User, 'role' | 'status'>>) =>
    request<User>('PATCH', `/users/${encodeURIComponent(id)}`, patch),
  deleteUser: (id: string) => request<void>('DELETE', `/users/${encodeURIComponent(id)}`),

  listCameras: () => request<Camera[]>('GET', '/cameras'),
  createCamera: (body: Partial<Camera>) => request<Camera>('POST', '/cameras', body),
  updateCamera: (id: string, body: Partial<Camera>) =>
    request<Camera>('PATCH', `/cameras/${encodeURIComponent(id)}`, body),
  verifyCamera: (id: string) =>
    request<Camera>('POST', `/cameras/${encodeURIComponent(id)}/verify`),
  deleteCamera: (id: string) =>
    request<void>('DELETE', `/cameras/${encodeURIComponent(id)}`),

  listEvents: () => request<EventLog[]>('GET', '/events'),
};
