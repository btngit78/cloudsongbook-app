export const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
export const SHARP_TO_FLAT: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };

export const getShouldUseFlats = (key: string, transpose: number): boolean => {
  if (transpose === 0) return false;
  const match = key.match(/^([A-G][#b]?)(m)?/);
  const root = match ? match[1] : 'C';
  const isMinor = !!(match && match[2]);
  let normalizedRoot = root;
  if (FLAT_MAP[root]) normalizedRoot = FLAT_MAP[root];
  
  const originalIndex = CHROMATIC_SCALE.indexOf(normalizedRoot);
  let targetIndex = (originalIndex + transpose) % 12;
  if (targetIndex < 0) targetIndex += 12;
  
  // Minor Key Specific Rules
  if (isMinor) {
    // Dbm(1) -> C#m, Gbm(6) -> F#m, Abm(8) -> G#m
    if ([1, 6, 8].includes(targetIndex)) return false;
  }

  // Rules:
  // 1. A#(10), D#(3), G#(8) -> Always Flats (Bb, Eb, Ab)
  if ([3, 8, 10].includes(targetIndex)) return true;
  
  // 2. F#(6) -> Gb unless original was F(5) (semitone up)
  if (targetIndex === 6) return originalIndex !== 5;
  
  // 3. C#(1) -> Db unless original was C(0) (semitone up)
  if (targetIndex === 1) return originalIndex !== 0;
  
  // 4. F(5) -> Standard theory uses flats (Bb)
  if (targetIndex === 5) return true;

  return false;
};

export const transposeChord = (chord: string, transpose: number, useFlats: boolean): string => {
  if (transpose === 0) return chord;
  
  return chord.split('/').map(part => {
    const match = part.match(/^([A-G][#b]?)(.*)/);
    if (!match) return part;

    let root = match[1];
    const suffix = match[2];
    if (FLAT_MAP[root]) root = FLAT_MAP[root];

    const index = CHROMATIC_SCALE.indexOf(root);
    if (index === -1) return part;

    let newIndex = (index + transpose) % 12;
    if (newIndex < 0) newIndex += 12;

    const note = CHROMATIC_SCALE[newIndex];
    if (useFlats && SHARP_TO_FLAT[note]) {
      return SHARP_TO_FLAT[note] + suffix;
    }
    return note + suffix;
  }).join('/');
};