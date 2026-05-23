// Event logging moved server-side. The backend appends an events row for every
// mutating request, so this module is retained only as a thin shim for any
// call sites that have not yet been updated.

export type EventLogger = (...args: unknown[]) => Promise<void>;

export const logEvent: EventLogger = async () => {
  // No-op: the backend is the source of truth for audit logs.
};
