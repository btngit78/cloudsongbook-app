import { useState, useEffect, useMemo, useCallback } from 'react';
import { Song } from '../types';

export const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

export const getKeyLabel = (note: string, suffix: string) => {
  const flatMap: Record<string, string> = {
    'C#': 'Db',
    'D#': 'Eb',
    'F#': 'Gb',
    'G#': 'Ab',
    'A#': 'Bb'
  };
  // Show Flat / Sharp for black keys to be unambiguous
  if (flatMap[note]) {
    return `${flatMap[note]}${suffix} / ${note}${suffix}`;
  }
  return `${note}${suffix}`;
};

export const useTranspose = (song?: Song | null) => {
  const [transpose, setTranspose] = useState(0);

  // Reset transpose when song changes
  useEffect(() => {
    setTranspose(0);
  }, [song?.id]);

  const keyInfo = useMemo(() => {
    if (!song?.key) return null;

    const match = song.key.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return null;

    let root = match[1];
    const suffix = match[2] || '';

    // Normalize flat to sharp for internal calculation
    if (FLAT_MAP[root]) root = FLAT_MAP[root];

    const originalIndex = CHROMATIC_SCALE.indexOf(root);
    if (originalIndex === -1) return null;

    // Calculate current key based on transpose
    let currentIndex = (originalIndex + transpose) % 12;
    if (currentIndex < 0) currentIndex += 12;

    const currentRoot = CHROMATIC_SCALE[currentIndex];

    return {
      originalRoot: root,
      originalIndex,
      suffix,
      currentKey: currentRoot + suffix,
      currentRoot,
      currentIndex
    };
  }, [song, transpose]);

  const setTransposeByKey = useCallback((targetKey: string) => {
    if (!keyInfo) return;
    
    const match = targetKey.match(/^([A-G][#b]?)/);
    if (!match) return;
    
    let targetRoot = match[1];
    if (FLAT_MAP[targetRoot]) targetRoot = FLAT_MAP[targetRoot];
    
    const targetIndex = CHROMATIC_SCALE.indexOf(targetRoot);
    if (targetIndex === -1) return;

    let diff = targetIndex - keyInfo.originalIndex;
    
    // Normalize to shortest path (-6 to +6)
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    
    setTranspose(diff);
  }, [keyInfo]);

  return {
    transpose,
    setTranspose,
    keyInfo,
    CHROMATIC_SCALE,
    setTransposeByKey
  };
};