import { useEffect, useSyncExternalStore } from 'react';
import { aiAvailability } from './coachApi.ts';

export type AiAvailability = 'checking' | 'online' | 'offline';

/** Whether Luka's AI answers, checked when a coach screen opens (GET /api/coach/status) and shared between them. */
export function useAiAvailability(): AiAvailability {
  const isAvailable = useSyncExternalStore(aiAvailability.subscribe, aiAvailability.lastKnown, aiAvailability.lastKnown);

  useEffect(() => {
    void aiAvailability.resolve();
  }, []);

  if (isAvailable === null) return 'checking';
  return isAvailable ? 'online' : 'offline';
}
