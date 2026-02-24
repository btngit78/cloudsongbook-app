import { useState, useMemo } from 'react';
import { Song } from '../types';

const DIACRITICS_REGEX_MAP = (() => {
  const map: Record<string, string> = {};
  const baseChars = 'abcdefghijklmnopqrstuvwxyz';
  
  for (const char of baseChars) {
    map[char] = char + char.toUpperCase();
  }

  const ranges = [
    { start: 0xC0, end: 0xFF },       // Latin-1 Supplement
    { start: 0x0100, end: 0x017F },   // Latin Extended-A
    { start: 0x1E00, end: 0x1EFF }    // Latin Extended Additional
  ];

  for (const range of ranges) {
    for (let i = range.start; i <= range.end; i++) {
      const char = String.fromCharCode(i);
      const normalized = char.normalize('NFD');
      const base = normalized.replace(/[\u0300-\u036f]/g, '').toLowerCase();
      
      if (base.length === 1 && map[base]) {
        map[base] += char;
      }
    }
  }

  // Manual overrides for Vietnamese Đ/đ
  if (map['d']) {
    map['d'] += 'đĐ';
  }

  const regexMap: Record<string, string> = {};
  for (const key in map) {
    const uniqueChars = Array.from(new Set(map[key].split(''))).join('');
    const escaped = uniqueChars.replace(/[\]\\-^]/g, '\\$&');
    regexMap[key] = `[${escaped}]`;
  }
  
  return regexMap;
})();

export const getSearchPattern = (query: string): string => {
  return query.split('').map(char => {
    let normalized = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.toLowerCase() === 'đ') normalized = 'd';
    const lower = normalized.toLowerCase();
    return DIACRITICS_REGEX_MAP[lower] || char.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }).join('');
};

export const useSearchRegex = (query: string) => {
  return useMemo(() => {
    if (!query || !query.trim()) return null;
    const pattern = getSearchPattern(query);
    return new RegExp(`(${pattern})`, 'gi');
  }, [query]);
};

export const useFilteredSongs = (songs: Song[], query: string) => {
  return useMemo(() => {
    if (!query.trim()) return songs;
    const pattern = getSearchPattern(query);
    const regex = new RegExp(pattern, 'i');
    return songs.filter(s => regex.test(s.title) || regex.test(s.authors));
  }, [songs, query]);
};

export const useSongSearch = (songs: Song[]) => {
  const [searchQuery, setSearchQuery] = useState('');
  const filteredSongs = useFilteredSongs(songs, searchQuery);
  return { searchQuery, setSearchQuery, filteredSongs };
};