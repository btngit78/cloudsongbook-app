import { describe, it, expect } from 'vitest';
import { getShouldUseFlats, transposeChord } from './musicUtils';

describe('musicUtils', () => {
  describe('getShouldUseFlats', () => {
    it('returns false for 0 transpose', () => {
      expect(getShouldUseFlats('C', 0)).toBe(false);
    });

    it('returns true for target keys usually associated with flats', () => {
      // Eb Major (Index 3)
      // C (0) + 3 = 3
      expect(getShouldUseFlats('C', 3)).toBe(true);
      
      // Ab Major (Index 8)
      // C (0) + 8 = 8
      expect(getShouldUseFlats('C', 8)).toBe(true);

      // Bb Major (Index 10)
      // C (0) + 10 = 10
      expect(getShouldUseFlats('C', 10)).toBe(true);

      // F Major (Index 5)
      // C (0) + 5 = 5
      expect(getShouldUseFlats('C', 5)).toBe(true);
    });

    it('handles the F#/Gb edge case', () => {
      // F (5) -> F# (6) (Should use sharps)
      expect(getShouldUseFlats('F', 1)).toBe(false);

      // G (7) -> Gb (6) (Should use flats)
      expect(getShouldUseFlats('G', -1)).toBe(true);
    });

    it('handles the C#/Db edge case', () => {
      // C (0) -> C# (1) (Should use sharps based on logic)
      expect(getShouldUseFlats('C', 1)).toBe(false);

      // D (2) -> Db (1) (Should use flats)
      expect(getShouldUseFlats('D', -1)).toBe(true);
    });

    it('handles minor key exclusions', () => {
      // Target Index 1 (C#/Db). For minor, logic says return false (C#m).
      // Dm (2) -> C#m (-1)
      expect(getShouldUseFlats('Dm', -1)).toBe(false);

      // Target Index 6 (F#/Gb). For minor, return false (F#m).
      // Gm (7) -> F#m (-1)
      expect(getShouldUseFlats('Gm', -1)).toBe(false);
    });
  });

  describe('transposeChord', () => {
    it('transposes simple chords correctly', () => {
      expect(transposeChord('C', 2, false)).toBe('D');
      expect(transposeChord('G', 2, false)).toBe('A');
    });

    it('handles sharps and flats based on flag', () => {
      // C + 1 = C# (if flats=false)
      expect(transposeChord('C', 1, false)).toBe('C#');
      // C + 1 = Db (if flats=true)
      expect(transposeChord('C', 1, true)).toBe('Db');
    });

    it('handles minor chords and extensions', () => {
      expect(transposeChord('Am7', 2, false)).toBe('Bm7');
      expect(transposeChord('Cm7-5', 2, false)).toBe('Dm7-5');
    });

    it('handles slash chords', () => {
      expect(transposeChord('C/G', 2, false)).toBe('D/A');
      expect(transposeChord('C/E', 1, true)).toBe('Db/F');
    });

    it('wraps around the chromatic scale', () => {
      // B (11) + 1 = C (0)
      expect(transposeChord('B', 1, false)).toBe('C');
      // C (0) - 1 = B (11)
      expect(transposeChord('C', -1, false)).toBe('B');
    });
  });
});