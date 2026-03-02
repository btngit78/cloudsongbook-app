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
    { start: 0x0180, end: 0x024F },   // Latin Extended-B (for ơ, ư, etc.)
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

const normalizeForSearch = (str: string): string => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

export type SortOrder = 'relevance' | 'lastUsed' | 'dateAdded' | 'alphabetic';

export const useFilteredSongs = (songs: Song[], query:string, sortOrder: SortOrder, sortDirection: 'asc' | 'desc') => {
  return useMemo(() => {
    if (!query.trim()) return songs;

    const pattern = getSearchPattern(query);
    const regex = new RegExp(pattern, 'i');
    const normalizedQuery = normalizeForSearch(query);
    const isShortQuery = normalizedQuery.length < 3;

    const filtered = songs.filter(s => {
      // 1. Exact/Regex Match (High Priority)
      if (regex.test(s.title) || regex.test(s.authors)) return true;

      // 2. Fuzzy Match (Typo handling)
      if (isShortQuery) return false;

      const normTitle = normalizeForSearch(s.title);
      const normAuthor = normalizeForSearch(s.authors);
      
      // Dynamic threshold based on query length
      const maxErrors = Math.max(1, Math.floor(normalizedQuery.length / 4));

      // Check words in title
      const titleWords = normTitle.split(/\s+/);
      if (titleWords.some(w => Math.abs(w.length - normalizedQuery.length) <= 2 && getLevenshteinDistance(normalizedQuery, w) <= maxErrors)) return true;
      
      // Check words in author
      const authorWords = normAuthor.split(/\s+/);
      if (authorWords.some(w => Math.abs(w.length - normalizedQuery.length) <= 2 && getLevenshteinDistance(normalizedQuery, w) <= maxErrors)) return true;

      // Check full string if lengths are close
      if (Math.abs(normTitle.length - normalizedQuery.length) <= 3) {
         if (getLevenshteinDistance(normalizedQuery, normTitle) <= maxErrors + 1) return true;
      }

      return false;
    });

    const dir = sortDirection === 'asc' ? 1 : -1;

    // Now, sort the filtered results
    switch (sortOrder) {
      case 'lastUsed':
        return [...filtered].sort((a, b) => ((a.lastUsedAt || 0) - (b.lastUsedAt || 0)) * dir);
      case 'dateAdded':
        return [...filtered].sort((a, b) => ((a.createdAt || 0) - (b.createdAt || 0)) * dir);
      case 'alphabetic':
        return [...filtered].sort((a, b) => a.title.localeCompare(b.title) * dir);
      case 'relevance':
      default:
        const sorted = [...filtered].sort((a, b) => {
          const aRegex = regex.test(a.title) || regex.test(a.authors);
          const bRegex = regex.test(b.title) || regex.test(b.authors);

          // Regex matches always come before fuzzy matches
          if (aRegex && !bRegex) return -1;
          if (!aRegex && bRegex) return 1;
          
          if (aRegex && bRegex) {
            const aTitleMatch = regex.test(a.title);
            const bTitleMatch = regex.test(b.title);
            
            if (aTitleMatch && !bTitleMatch) return -1;
            if (!aTitleMatch && bTitleMatch) return 1;
            return 0;
          }
          
          // For fuzzy matches, fallback to alphabetic
          return a.title.localeCompare(b.title);
        });
        // 'asc' is default (title matches first). 'desc' is the reverse.
        if (sortDirection === 'desc') {
          return sorted.reverse();
        }
        return sorted;
    }
  }, [songs, query, sortOrder, sortDirection]);
};

export const useSongSearch = (songs: Song[]) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('dateAdded');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSortChange = (newSortOrder: SortOrder) => {
    if (newSortOrder === sortOrder) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOrder(newSortOrder);
      // Set default direction for the new sort type
      if (newSortOrder === 'alphabetic' || newSortOrder === 'relevance') {
        setSortDirection('asc');
      } else { // dateAdded, lastUsed
        setSortDirection('desc');
      }
    }
  };

  const filteredSongs = useFilteredSongs(songs, searchQuery, sortOrder, sortDirection);
  return { searchQuery, setSearchQuery, filteredSongs, sortOrder, sortDirection, handleSortChange };
};