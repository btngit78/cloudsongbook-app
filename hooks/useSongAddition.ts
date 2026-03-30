import { useState, useRef, useCallback } from 'react';
import { Song, SetList } from '../types';

export const useSongAddition = () => {
  const [newSongForSetlist, setNewSongForSetlist] = useState<Song | null>(null);
  const oldSongBeforeAddRef = useRef<{ id: string; title: string } | null>(null);
  const setlistBeforeAddRef = useRef<{ id: string; name: string } | null>(null);

  const captureContext = useCallback((currentSong: Song | null, activeSetlist: SetList | null) => {
    oldSongBeforeAddRef.current = currentSong ? { id: currentSong.id, title: currentSong.title } : null;
    setlistBeforeAddRef.current = activeSetlist ? { id: activeSetlist.id, name: activeSetlist.name } : null;
  }, []);

  const clearAddition = useCallback(() => {
    setNewSongForSetlist(null);
    oldSongBeforeAddRef.current = null;
    setlistBeforeAddRef.current = null;
  }, []);

  return {
    newSongForSetlist,
    setNewSongForSetlist,
    get oldSongContext() { return oldSongBeforeAddRef.current; },
    get setlistContext() { return setlistBeforeAddRef.current; },
    captureContext,
    clearAddition
  };
};