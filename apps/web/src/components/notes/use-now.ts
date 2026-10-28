import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, MINUTE);

  return () => {
    clearInterval(timer);
  };
}

// Rounded to the minute so the snapshot is stable between ticks.
function snapshot() {
  return Math.floor(Date.now() / MINUTE) * MINUTE;
}

/** The current time, refreshed every minute. */
export function useNow() {
  return useSyncExternalStore(subscribe, snapshot);
}
