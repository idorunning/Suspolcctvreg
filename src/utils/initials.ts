// The last-used initials value, kept in localStorage purely to pre-fill the
// "Your initials" field on the add/edit forms — not a login of any kind.

const INITIALS_STORAGE_KEY = 'sussex_cctv_initials';

export function getStoredInitials(): string {
  return localStorage.getItem(INITIALS_STORAGE_KEY) || '';
}

export function normalizeInitials(raw: string): string {
  return raw.toUpperCase().slice(0, 6);
}

export function storeInitials(value: string): void {
  const v = value.trim();
  if (v) localStorage.setItem(INITIALS_STORAGE_KEY, v);
}
