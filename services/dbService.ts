
import { Song, SetList } from '../types';
import { MOCK_SONGS } from '../constants';

const CACHE_KEY = 'cloudsong_cache_v1';
const RECENT_SONGS_LIMIT = 40;

export const dbService = {
  async getSongs(): Promise<Song[]> {
    const local = localStorage.getItem('cloudsong_all_songs');
    if (local) return JSON.parse(local);
    return MOCK_SONGS;
  },

  async getSong(id: string): Promise<Song | null> {
    const songs = await this.getSongs();
    const song = songs.find(s => s.id === id) || null;
    if (song) {
      this.updateRecentCache(song);
    }
    return song;
  },

  async saveSong(songData: Partial<Song>): Promise<Song> {
    const songs = await this.getSongs();
    
    // Fix: Include missing required properties language and isPdf, plus other optional properties
    const newSong: Song = {
      id: songData.id || Math.random().toString(36).substr(2, 9),
      title: songData.title || 'Untitled',
      author: songData.author || 'Unknown',
      body: songData.body || '',
      key: songData.key,
      tempo: songData.tempo,
      keywords: songData.keywords,
      language: songData.language || 'English',
      isPdf: songData.isPdf || false,
      pdfData: songData.pdfData,
      createdAt: songData.createdAt || Date.now(),
      lastUsedAt: Date.now(),
    };
    
    const updated = songData.id 
      ? songs.map(s => s.id === songData.id ? newSong : s)
      : [newSong, ...songs];
    
    localStorage.setItem('cloudsong_all_songs', JSON.stringify(updated));
    this.updateRecentCache(newSong);
    return newSong;
  },

  async deleteSong(id: string): Promise<void> {
    const songs = await this.getSongs();
    const updated = songs.filter(s => s.id !== id);
    localStorage.setItem('cloudsong_all_songs', JSON.stringify(updated));
    
    const recent = this.getRecentCache();
    const updatedRecent = recent.filter(s => s.id !== id);
    localStorage.setItem(CACHE_KEY, JSON.stringify(updatedRecent));
  },

  getRecentCache(): Song[] {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  updateRecentCache(song: Song) {
    let recent = this.getRecentCache();
    recent = recent.filter(s => s.id !== song.id);
    recent.unshift({ ...song, lastUsedAt: Date.now() });
    if (recent.length > RECENT_SONGS_LIMIT) {
      recent = recent.slice(0, RECENT_SONGS_LIMIT);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(recent));
  }
};
