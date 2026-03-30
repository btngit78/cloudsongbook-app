import { useState, useEffect, useCallback } from 'react';
import { SetList, User } from '../types';
import { dbService } from '../services/dbService';

export const useSetlists = (user: User | null, selectSong: (songId: string) => Promise<any>) => {
  const [setlists, setSetlists] = useState<SetList[]>([]);
  const [activeSetlist, setActiveSetlist] = useState<SetList | null>(null);
  const [activeSetlistIndex, setActiveSetlistIndex] = useState(0);

  // Load setlists when user changes
  useEffect(() => {
    // Load setlists for everyone (public read)
    dbService.getSetlists().then(setSetlists);
  }, [user]);

  const saveSetlist = useCallback((setlist: SetList) => {
    setSetlists(currentSetlists => {
      const existingIdx = currentSetlists.findIndex(s => s.id === setlist.id);
      if (existingIdx >= 0) {
        const newSetlists = [...currentSetlists];
        newSetlists[existingIdx] = setlist;
        return newSetlists;
      } else {
        return [...currentSetlists, setlist];
      }
    });
    if (user) dbService.saveSetlist(setlist);
  }, [user]);

  const exitSetlist = useCallback(() => {
    setActiveSetlist(null);
    setActiveSetlistIndex(0);
  }, []);

  const deleteSetlist = useCallback((id: string) => {
    setSetlists(currentSetlists => currentSetlists.filter(s => s.id !== id));
    dbService.deleteSetlist(id);
    if (activeSetlist?.id === id) exitSetlist();
  }, [activeSetlist?.id, exitSetlist]);

  const playSetlist = useCallback(async (setlist: SetList, startIndex: number = 0) => {
    // Create the updated object first so both the active state 
    // and the persisted global list share the same data (including lastUsedAt)
    const updated = { ...setlist, lastUsedAt: Date.now() };
    
    setActiveSetlist(updated);
    setActiveSetlistIndex(startIndex);
    if (updated.choices && updated.choices.length > startIndex) {
      await selectSong(updated.choices[startIndex].songId);
    }
    saveSetlist(updated);
  }, [selectSong, saveSetlist]);

  const navigateSetlist = useCallback(async (direction: 'next' | 'prev' | number) => {
    if (!activeSetlist) return;

    let newIndex = activeSetlistIndex;
    if (direction === 'next') newIndex++;
    else if (direction === 'prev') newIndex--;
    else newIndex = direction;

    if (activeSetlist.choices && newIndex >= 0 && newIndex < activeSetlist.choices.length) {
      setActiveSetlistIndex(newIndex);
      await selectSong(activeSetlist.choices[newIndex].songId);
    }
  }, [activeSetlist, activeSetlistIndex, selectSong]);

  const refreshSetlists = useCallback(async () => {
    const data = await dbService.getSetlists();
    setSetlists(data);
  }, []);

  return {
    setlists,
    activeSetlist,
    activeSetlistIndex,
    saveSetlist,
    deleteSetlist,
    playSetlist,
    navigateSetlist,
    exitSetlist,
    refreshSetlists
  };
};