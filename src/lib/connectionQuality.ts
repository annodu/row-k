import { useEffect, useState } from "react";

// Network Information API — Chromium/Android only (no Safari/Firefox support), so this is a
// proactive early-skip for the subset of users the browser itself flags as constrained, not the
// only signal. Per-image onError/timeout handling (see PortfolioPhotoCarousel) is what actually
// catches slow/broken loads everywhere else.
type NetworkInformation = EventTarget & {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
};

function getConnection(): NetworkInformation | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function computeIsSlow(): boolean {
  const connection = getConnection();
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g";
}

// Single shared listener rather than one per hook instance — a results page can render hundreds
// of PortfolioPhotoCarousel cards at once.
const subscribers = new Set<(value: boolean) => void>();
let currentValue = computeIsSlow();
let listening = false;

function notifySubscribers() {
  const next = computeIsSlow();
  if (next === currentValue) return;
  currentValue = next;
  for (const subscriber of subscribers) subscriber(currentValue);
}

function ensureListening() {
  if (listening) return;
  const connection = getConnection();
  connection?.addEventListener("change", notifySubscribers);
  listening = true;
}

export function useIsSlowConnection(): boolean {
  const [isSlow, setIsSlow] = useState(currentValue);

  useEffect(() => {
    ensureListening();
    subscribers.add(setIsSlow);
    setIsSlow(currentValue);
    return () => {
      subscribers.delete(setIsSlow);
    };
  }, []);

  return isSlow;
}
