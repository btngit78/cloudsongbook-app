import { useState, useEffect } from 'react';
import { SetList, User } from '../types';
import { dbService } from '../services/dbService';

export const useSetlists = (user: User | null, selectSong: (songId: string) => void) => {
  const [setlists, setSetlists] = useState<SetList[]>([]);
  const [activeSetlist, setActiveSetlist] = useState<SetList | null>(null);
  const [activeSetlistIndex, setActiveSetlistIndex] = useState(0);

  // Load setlists when user changes
  useEffect(() => {
    if (user) {
      dbService.getSetlists(user.id).then(setSetlists);
    } else {
      setSetlists([]);
      setActiveSetlist(null);
      setActiveSetlistIndex(0);
    }
  }, [user]);

  const saveSetlist = (setlist: SetList) => {
    const existingIdx = setlists.findIndex(s => s.id === setlist.id);
    let newSetlists;
    if (existingIdx >= 0) {
      newSetlists = [...setlists];
      newSetlists[existingIdx] = setlist;
    } else {
      newSetlists = [...setlists, setlist];
    }
    setSetlists(newSetlists);
    if (user) dbService.saveSetlist(setlist, user.id);
  };

  const deleteSetlist = (id: string) => {
    const newSetlists = setlists.filter(s => s.id !== id);
    setSetlists(newSetlists);
    dbService.deleteSetlist(id);
    if (activeSetlist?.id === id) {
        setActiveSetlist(null);
        setActiveSetlistIndex(0);
    }
  };

  const playSetlist = (setlist: SetList) => {
    setActiveSetlist(setlist);
    setActiveSetlistIndex(0);
    if (setlist.songIds.length > 0) {
      selectSong(setlist.songIds[0]);
    }
  };

  const navigateSetlist = (direction: 'next' | 'prev' | number) => {
    if (!activeSetlist) return;
    let newIndex = activeSetlistIndex;
    
    if (direction === 'next') newIndex++;
    else if (direction === 'prev') newIndex--;
    else newIndex = direction;

    if (newIndex >= 0 && newIndex < activeSetlist.songIds.length) {
      setActiveSetlistIndex(newIndex);
      selectSong(activeSetlist.songIds[newIndex]);
    }
  };

  const exitSetlist = () => {
    setActiveSetlist(null);
    setActiveSetlistIndex(0);
  };

  return {
    setlists,
    activeSetlist,
    activeSetlistIndex,
    saveSetlist,
    deleteSetlist,
    playSetlist,
    navigateSetlist,
    exitSetlist,
  };
};