// Polls the data file's mtime so the UI can warn when a teammate has saved.

import { currentMtime, peekMtime } from './storage';

const INTERVAL_MS = 30_000;

export function watchForRemoteChanges(onChange: () => void): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const here = currentMtime();
      const there = await peekMtime();
      if (here !== null && there !== null && there > here) onChange();
    } catch {
      // ignore — folder may be detached temporarily by sync engine
    }
  };
  const id = window.setInterval(tick, INTERVAL_MS);
  return () => {
    stopped = true;
    window.clearInterval(id);
  };
}
