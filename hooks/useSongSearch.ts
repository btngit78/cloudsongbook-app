import { useState, useMemo } from 'react';
import { filterSongs } from '../utils/searchUtils';
import { Song } from '@/types';

export const useSongSearch = (songs: Song[]) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSongs = useMemo(() => {
    return filterSongs(songs, searchQuery);
  }, [songs, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    filteredSongs,
  };
};