"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

/** Renders children only in the browser (for screens that read browser storage on first render). */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return <>{mounted ? children : fallback}</>;
}
