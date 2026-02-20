import { useState, useMemo, useEffect } from 'react';
import { Song } from '../types';

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

export const useTranspose = (currentSong: Song | null) => {
  const [transpose, setTranspose] = useState(0);

  // Reset transpose on song change
  useEffect(() => {
    setTranspose(0);
  }, [currentSong]);

  const keyInfo = useMemo(() => {
    if (!currentSong?.key) return null;
    
    let root = currentSong.key;
    let suffix = '';
    
    const match = currentSong.key.match(/^([A-G][#b]?)(.*)/);
    if (match) {
      root = match[1];
      suffix = match[2];
    }

    if (FLAT_MAP[root]) root = FLAT_MAP[root];
    const originalIndex = CHROMATIC_SCALE.indexOf(root);
    
    if (originalIndex === -1) return null;

    let currentIndex = (originalIndex + transpose) % 12;
    if (currentIndex < 0) currentIndex += 12;

    return {
      originalIndex,
      currentIndex,
      currentKey: CHROMATIC_SCALE[currentIndex] + suffix,
      suffix,
      root
    };
  }, [currentSong, transpose]);

  return {
    transpose,
    setTranspose,
    keyInfo,
    CHROMATIC_SCALE // Exporting for the dropdown
  };
};