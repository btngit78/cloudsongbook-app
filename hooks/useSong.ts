import { useState, useEffect, useCallback } from 'react';
import { Song } from '../types';
import { dbService } from '../services/dbService';

export const useSongs = () => {
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);

  // Initialize songs on mount
  useEffect(() => {
    const init = async () => {
      try {
        const songs = await dbService.getSongs();
        setAllSongs(songs);

        const recent = dbService.getRecentCache();
        if (recent.length > 0) {
          setCurrentSong(recent[0]);
        } else if (songs.length > 0) {
          setCurrentSong(songs[0]);
        }
      } catch (error) {
        console.error("Failed to load songs:", error);
      }
    };
    init();
  }, []);

  const selectSong = useCallback(async (songId: string) => {
    const song = await dbService.getSong(songId);
    if (song) {
      setCurrentSong(song);
      setSearchOpen(false);
      setSearchQuery('');
    }
    return song;
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults([]);
    } else {
      const filtered = allSongs.filter(s => 
        s.title.toLowerCase().includes(query.toLowerCase()) || 
        s.authors.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
    }
  }, [allSongs]);

  const saveSong = async (songData: Partial<Song>) => {
    const saved = await dbService.saveSong(songData);
    const updatedSongs = await dbService.getSongs();
    setAllSongs(updatedSongs);
    setCurrentSong(saved);
    return saved;
  };

  const deleteSong = async () => {
    if (currentSong && window.confirm(`Delete "${currentSong.title}"?`)) {
      await dbService.deleteSong(currentSong.id);
      const songs = await dbService.getSongs();
      setAllSongs(songs);
      setCurrentSong(songs[0] || null);
      return true;
    }
    return false;
  };

  const deleteSpecificSong = async (song: Song) => {
    if (window.confirm(`Delete "${song.title}"?`)) {
      await dbService.deleteSong(song.id);
      const songs = await dbService.getSongs();
      setAllSongs(songs);
      if (currentSong?.id === song.id) {
        setCurrentSong(songs[0] || null);
      }
    }
  };

  return {
    allSongs,
    currentSong,
    setCurrentSong,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchResults,
    selectSong,
    handleSearch,
    saveSong,
    deleteSong,
    deleteSpecificSong
  };
};
