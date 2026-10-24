import { useEffect, useReducer } from 'react';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Notifies live queries that local data changed (after every committed write). */
export function emitChange(): void {
  for (const listener of [...listeners]) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Live read model: runs a synchronous query against the local DB on every render and
 * re-renders whenever local data changes. The DB is the source of truth for the UI
 * (mobile-app-structure.md §1); local queries are small and synchronous, so no caching.
 */
export function useLiveQuery<T>(query: () => T): T {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribe(rerender), []);
  return query();
}
