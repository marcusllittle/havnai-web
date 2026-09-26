export interface QueueTrack {
  id: string;
  audioUrl?: string;
}

export function playableQueue<T extends QueueTrack>(tracks: T[]): T[] {
  return tracks.filter((track) => Boolean(track.audioUrl));
}

export function resolveQueueSelection<T extends QueueTrack>(
  track: T,
  queue?: T[],
  index?: number
): { queue: T[]; index: number; track: T | null } {
  const source = queue && queue.length > 0 ? queue : [track];
  const playable = playableQueue(source);
  if (playable.length === 0) return { queue: [], index: 0, track: null };
  const matchingIndex = playable.findIndex((item) => item.id === track.id);
  const requestedIndex = matchingIndex >= 0 ? matchingIndex : index ?? 0;
  const safeIndex = Math.max(0, Math.min(requestedIndex < 0 ? 0 : requestedIndex, playable.length - 1));
  return { queue: playable, index: safeIndex, track: playable[safeIndex] };
}

export function adjacentQueueIndex(queueLength: number, index: number, direction: -1 | 1): number | null {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= queueLength) return null;
  return nextIndex;
}

export function restoreQueueSelection<T extends QueueTrack>(
  track: T | null,
  queue: unknown
): { queue: T[]; index: number; track: T | null } {
  const storedQueue = Array.isArray(queue) ? playableQueue(queue.filter((item): item is T => Boolean(item?.id))) : [];
  if (track?.id && track.audioUrl) {
    return resolveQueueSelection(track, storedQueue.length > 0 ? storedQueue : [track]);
  }
  if (storedQueue.length > 0) {
    return { queue: storedQueue, index: 0, track: storedQueue[0] };
  }
  return { queue: [], index: 0, track: null };
}
