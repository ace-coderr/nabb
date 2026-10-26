import { useSyncExternalStore } from "react";

/**
 * One shared one-second clock for the whole app. It runs a single timer while at least one
 * component is listening, no matter how many pages or cards use it, and makes no network requests.
 */
const listeners = new Set<() => void>();
let snapshot = Date.now() / 1000;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) {
    snapshot = Date.now() / 1000;
    timer = setInterval(() => {
      snapshot = Date.now() / 1000;
      listeners.forEach((notify) => notify());
    }, 1_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => snapshot;

/** Current unix time in seconds, updated once a second. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
