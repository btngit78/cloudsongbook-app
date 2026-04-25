import React, { useState, useEffect, useRef, useMemo } from 'react';

interface ChordAssistantModalProps {
  songKey: string;
  songBody: string;
  onInsert: (chord: string) => void;
  onRemove: () => void;
  onUpdateBody: (newBody: string) => void;
  onUpdateKey?: (newKey: string) => void;
  onClose: () => void;
}

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_SCALE_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

const ADV_EXTENSIONS = ["", "sus", "7", "M7", "m7", "9", "M9", "m9", "11", "m11", "6", "m6","13", "M13", "dim7", "7-Alt"];
const ADD_TO_EXTENSIONS = ["+7","+5", "-5", "+9", "-9", "+11", "(2)", "(6)", "(9)", "(4)", "sus"];

const getDiatonicSet = (songKey: string, isAdvanced: boolean, useFlats: boolean) => {
  const isMinor = songKey.endsWith('m');
  const root = songKey.replace('m', '');
  const rootPart = root.charAt(0).toUpperCase() + (root.length > 1 ? root.charAt(1).toLowerCase() : '');
  const baseIdx = CHROMATIC_SCALE.indexOf(FLAT_MAP[rootPart] || rootPart);
  const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
  const scale = useFlats ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE;
  
  return intervals.map((interval, i) => {
    const noteIdx = (baseIdx + interval) % 12;
    const note = scale[noteIdx];
    const step = i + 1;

    if (isMinor) {
      if (step === 1) return isAdvanced ? `${note}m7` : `${note}m`;
      if (step === 2) return isAdvanced ? `${note}m7-5` : `${note}dim`;
      if (step === 3) return isAdvanced ? `${note}M7` : note;
      if (step === 4) return isAdvanced ? `${note}m7` : `${note}m`;
      if (step === 5) return `${note}7`; // Both modes dominant 5th per user
      if (step === 6) return isAdvanced ? `${note}M7` : note;
      if (step === 7) return isAdvanced ? `${note}6` : note; // 7th degree is natural minor VII
    } else {
      if (step === 1) return isAdvanced ? `${note}M7` : note;
      if (step === 2) return isAdvanced ? `${note}m7` : `${note}m`;
      if (step === 3) return isAdvanced ? `${note}m7` : `${note}m`;
      if (step === 4) return isAdvanced ? `${note}M7` : note;
      if (step === 5) return `${note}7`; // Dominant 5th
      if (step === 6) return isAdvanced ? `${note}m7` : `${note}m`;
      if (step === 7) return isAdvanced ? `${note}m7-5` : `${note}dim`;
    }
    return note;
  });
};

const getRoot = (chord: string) => {
  const match = chord.match(/^([A-G][#b]?)/);
  return match ? match[1] : '';
};

const getChromaticIndex = (root: string, keyRoot: string) => {
  const rootPart = root.charAt(0).toUpperCase() + (root.length > 1 ? root.charAt(1).toLowerCase() : '');
  const keyPart = keyRoot.charAt(0).toUpperCase() + (keyRoot.length > 1 ? keyRoot.charAt(1).toLowerCase() : '');
  const r = FLAT_MAP[rootPart] || rootPart;
  const k = FLAT_MAP[keyPart] || keyPart;
  const kIdx = CHROMATIC_SCALE.indexOf(k);
  const rIdx = CHROMATIC_SCALE.indexOf(r);
  if (kIdx === -1 || rIdx === -1) return 99;
  return (rIdx - kIdx + 12) % 12;
};

const transposeChord = (chord: string, semitones: number, useFlats: boolean) => {
  const scale = useFlats ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE;
  return chord.replace(/[a-gA-G][#b]?/g, (match) => {
    const rootPart = match.charAt(0).toUpperCase() + (match.length > 1 ? match.charAt(1).toLowerCase() : '');
    let root = FLAT_MAP[rootPart] || rootPart;
    let index = CHROMATIC_SCALE.indexOf(root);
    if (index === -1) return match;
    let newIndex = (index + semitones + 12) % 12;
    return scale[newIndex];
  });
};

const isTraditionallyFlatKey = (key: string) => {
  // Keys that prefer flats but don't have 'b' in their root name (F Major, Dm, Gm, Cm, Fm)
  const flatKeys = ['F', 'Dm', 'Gm', 'Cm', 'Fm'];
  return key.includes('b') || flatKeys.includes(key);
};

const ChordAssistantModal: React.FC<ChordAssistantModalProps> = ({ songKey, songBody, onInsert, onRemove, onUpdateBody, onUpdateKey, onClose }) => {
  const [pos, setPos] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [manualChords, setManualChords] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newChordText, setNewChordText] = useState('');
  const [activeShortcutKey, setActiveShortcutKey] = useState<string | null>(null);
  const [addChordInput, setAddChordInput] = useState('');
  const [useFlats, setUseFlats] = useState(isTraditionallyFlatKey(songKey));
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ oldChord: string; newChord: string; count: number } | null>(null);
  const [variationTarget, setVariationTarget] = useState<string | null>(null);
  const [history, setHistory] = useState<{ body: string; manual: string[] }[]>([]);
  const variationCloseTimerRef = useRef<number | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);

  // Sync flat preference when the song key changes in the parent form
  useEffect(() => {
    setUseFlats(isTraditionallyFlatKey(songKey));
  }, [songKey]);

  const performAction = (action: () => void) => {
    setHistory(prev => [{ body: songBody, manual: [...manualChords] }, ...prev].slice(0, 20));
    action();
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const [lastState, ...rest] = history;
    onUpdateBody(lastState.body);
    setManualChords(lastState.manual);
    setHistory(rest);
  };

  // Extract chords from body
  const chordsInBody = useMemo(() => {
    const matches = songBody.match(/\[(.*?)\]/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(1, -1)))].sort();
  }, [songBody]);

  const diatonicChords = useMemo(() => getDiatonicSet(songKey, isAdvanced, useFlats), [songKey, isAdvanced, useFlats]);

  // Determine palette
  const palette = useMemo(() => {
    const otherBodyChords = chordsInBody.filter(c => !diatonicChords.includes(c));
    const otherManualChords = manualChords.filter(c => !diatonicChords.includes(c) && !chordsInBody.includes(c));
    
    const combined = [...new Set([...diatonicChords, ...otherBodyChords, ...otherManualChords])];
    const keyRoot = songKey.replace('m', '');

    const sorted = combined.sort((a, b) => {
      const rootA = getRoot(a);
      const rootB = getRoot(b);
      const idxA = getChromaticIndex(rootA, keyRoot);
      const idxB = getChromaticIndex(rootB, keyRoot);
      
      if (idxA !== idxB) return idxA - idxB;
      return a.localeCompare(b);
    });
    return sorted;
  }, [chordsInBody, songKey, manualChords, isAdvanced, diatonicChords]);

  const groupedChords = useMemo(() => {
    const groups: string[][] = [];
    let currentGroup: string[] = [];
    
    palette.forEach((chord, i) => {
      const root = getRoot(chord);
      const prevRoot = i > 0 ? getRoot(palette[i - 1]) : null;
      if (root !== prevRoot && i > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentGroup.push(chord);
    });
    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups;
  }, [palette]);

  const keyNotes = useMemo(() => {
    const isMinor = songKey.endsWith('m');
    const root = songKey.replace('m', '');
    const rootPart = root.charAt(0).toUpperCase() + (root.length > 1 ? root.charAt(1).toLowerCase() : '');
    const baseIdx = CHROMATIC_SCALE.indexOf(FLAT_MAP[rootPart] || rootPart);
    const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
    return intervals.map(interval => {
      const noteIdx = (baseIdx + interval) % 12;
      return transposeChord(CHROMATIC_SCALE[noteIdx], 0, useFlats);
    });
  }, [songKey, useFlats]);

  // Keyboard Shortcuts (1-7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        setActiveShortcutKey('Delete');
        setTimeout(() => setActiveShortcutKey(null), 200);
        performAction(onRemove);
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= 7 && diatonicChords[num - 1]) {
        setActiveShortcutKey(e.key);
        setTimeout(() => setActiveShortcutKey(null), 200);
        performAction(() => onInsert(diatonicChords[num - 1]));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [diatonicChords, onInsert, onRemove, performAction, handleUndo]);

  const handleGlobalRename = (oldChord: string, newChord: string) => {
    setEditingIndex(null);
    if (!newChord || oldChord === newChord) return;

    const escaped = oldChord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\[${escaped}\\]`, 'g');
    const count = (songBody.match(regex) || []).length;

    if (count > 0) {
      setRenameTarget({ oldChord, newChord, count });
    } else {
      performAction(() => {
        setManualChords(prev => [...prev.filter(c => c !== oldChord), newChord]);
      });
    }
  };

  const confirmGlobalRename = () => {
    if (!renameTarget) return;
    const { oldChord, newChord } = renameTarget;
    const escaped = oldChord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\[${escaped}\\]`, 'g');
    const nextBody = songBody.replace(regex, `[${newChord}]`);
    performAction(() => {
      onUpdateBody(nextBody);
      setManualChords(prev => [...prev.filter(c => c !== oldChord), newChord]);
    });
    setRenameTarget(null);
  };

  const handleTranspose = (semitones: number) => {
    const nextBody = songBody.replace(/\[(.*?)\]/g, (match, p1) => `[${transposeChord(p1, semitones, useFlats)}]`);
    performAction(() => {
      onUpdateBody(nextBody);
      setManualChords(prev => prev.map(c => transposeChord(c, semitones, useFlats)));
    });
  };

  const handleToggleFlats = () => {
    const nextUseFlats = !useFlats;
    performAction(() => {
      setUseFlats(nextUseFlats);
      // Immediately normalize all chords in the body to the new preference
      const nextBody = songBody.replace(/\[(.*?)\]/g, (match, p1) => `[${transposeChord(p1, 0, nextUseFlats)}]`);
      onUpdateBody(nextBody);
      // Normalize the song key as well
      if (onUpdateKey) {
        onUpdateKey(transposeChord(songKey, 0, nextUseFlats));
      }
      // Ensure manually added palette chords stay consistent
      setManualChords(prev => prev.map(c => transposeChord(c, 0, nextUseFlats)));
    });
  };

  const handleNormalize = () => {
    const nextBody = songBody.replace(/\[(.*?)\]/g, (match, p1) => `[${transposeChord(p1, 0, useFlats)}]`);
    performAction(() => {
      onUpdateBody(nextBody);
      setManualChords(prev => prev.map(c => transposeChord(c, 0, useFlats)));
    });
  };

  const buildAndInsert = (base: string, suffix: string, append: boolean = false, bass?: string) => {
    const rootMatch = base.match(/^([A-G][#b]?)/);
    const root = rootMatch ? rootMatch[1] : base;
    const finalChord = append ? `${base}${suffix}` : `${root}${suffix}`;
    performAction(() => onInsert(`${finalChord}${bass ? '/' + bass : ''}`));
    setVariationTarget(null);
  };

  const gridLayout = useMemo(() => {
    const keyRoot = songKey.replace('m', '');
    const isMinor = songKey.endsWith('m');
    const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
    
    // Map chromatic offsets (0-11) to column indices (0-6)
    const offsetToCol: Record<number, number> = {};
    intervals.forEach((interval, i) => {
      offsetToCol[interval] = i;
    });

    const matrix: (string[] | null)[][] = [Array(7).fill(null)];
    const nonDiatonicGroups: string[][] = [];

    groupedChords.forEach(group => {
      const root = getRoot(group[0]);
      const offset = getChromaticIndex(root, keyRoot);
      const col = offsetToCol[offset];

      if (col !== undefined) {
        matrix[0][col] = group;
      } else {
        nonDiatonicGroups.push(group);
      }
    });

    // Fill subsequent rows with non-diatonic groups
    for (let i = 0; i < nonDiatonicGroups.length; i += 7) {
      matrix.push(nonDiatonicGroups.slice(i, i + 7).concat(Array(Math.max(0, 7 - (nonDiatonicGroups.length - i))).fill(null)));
    }

    return matrix;
  }, [groupedChords, songKey]);

  // Handle single vs double click for the main chord button
  const handleMainChordClick = (chord: string) => {
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      return; // It's a double click, handled by onDoubleClick
    }

    clickTimeoutRef.current = window.setTimeout(() => {
      performAction(() => onInsert(chord));
      clickTimeoutRef.current = null;
    }, 400);
  };

  const startVariationCloseTimer = () => {
    variationCloseTimerRef.current = window.setTimeout(() => setVariationTarget(null), 500);
  };

  const cancelVariationCloseTimer = () => {
    if (variationCloseTimerRef.current) {
      window.clearTimeout(variationCloseTimerRef.current);
      variationCloseTimerRef.current = null;
    }
  };

  const renderChordButton = (chord: string) => {
    const idx = palette.indexOf(chord);
    const dIdx = diatonicChords.indexOf(chord);
    const isFlashing = dIdx !== -1 && activeShortcutKey === (dIdx + 1).toString();
    
    return (
      <div key={chord} className="relative group flex items-stretch min-h-[36px]">
        {editingIndex === idx ? (
          <input
            autoFocus
            className={`w-full text-center font-bold border rounded bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 ${isCompact ? 'py-1 text-[10px]' : 'py-2 text-xs'}`}
            value={newChordText}
            onChange={e => setNewChordText(e.target.value)}
            onBlur={() => handleGlobalRename(chord, newChordText)}
            onKeyDown={e => e.key === 'Enter' && handleGlobalRename(chord, newChordText)}
          />
        ) : (
          <div className={`flex w-full rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 hover:border-blue-300 transition-all duration-200 ease-in-out group/btn shadow-sm ${dIdx !== -1 ? 'ring-1 ring-indigo-500/20 border-indigo-200' : ''} ${isFlashing ? 'ring-2 ring-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 scale-95 shadow-lg' : ''}`}>
            <button
              onClick={() => handleMainChordClick(chord)}
              onDoubleClick={() => {
                setEditingIndex(idx);
                setNewChordText(chord);
              }}
              title="Click to insert, Double-click to rename all"
              className={`flex-1 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 text-blue-600 dark:text-amber-400 truncate ${isCompact ? 'py-1 text-[10px]' : 'py-2 text-xs'}`}
            >
              {chord}
              {dIdx !== -1 && (
                <span className="absolute -top-1.5 left-1 text-[8px] bg-indigo-600 text-white px-1 rounded-full font-black z-10 shadow-sm">
                  {dIdx + 1}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVariationTarget(chord);
              }}
              className="w-6 flex items-center justify-center border-l border-gray-100 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-300 hover:text-indigo-500 transition-colors"
              title="Show variations"
            >
              <i className="fa-solid fa-chevron-right text-[8px]"></i>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed top-0 left-0 w-full z-[100] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col transition-all animate-slideInDown max-h-[70vh] overflow-hidden resize-y select-none">
      {/* Header */}
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="font-black text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-r border-gray-300 dark:border-gray-600 pr-3 mr-1">
            <i className="fa-solid fa-guitar mr-1.5"></i> Chord Assistant
          </span>
          <span className="font-bold text-sm text-gray-700 dark:text-gray-300">
            Key: {songKey}
          </span>
          <div className="flex gap-1.5 ml-2">
            <button 
              type="button"
              onClick={() => setIsAdvanced(!isAdvanced)}
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all ${isAdvanced ? 'bg-indigo-600 border-indigo-700 text-white shadow-inner' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400'}`}
            >
              {isAdvanced ? 'Adv' : 'Basic'}
            </button>
            <button 
              type="button"
              onClick={() => setIsCompact(!isCompact)}
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all ${isCompact ? 'bg-indigo-600 border-indigo-700 text-white shadow-inner' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400'}`}
            >
              Compact
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-4 italic hidden md:block">Double-click to rename • 1-7 shortcuts • Del to remove</span>
          {history.length > 0 && (
            <button 
              onClick={handleUndo}
              className="w-8 h-8 flex items-center justify-center rounded-full text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all mr-1"
              title="Undo last action (Ctrl+Z)"
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>
          )}
          <button title="Close Assistant" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-red-500 hover:text-white transition-all">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      </div>

      {/* Functional Action Bar - Moved to top, under header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 border-r border-gray-200 dark:border-gray-700 pr-4">
          <button
            onClick={() => performAction(onRemove)}
            className={`px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 transition-all duration-200 ease-in-out border border-red-100 dark:border-red-900/30 flex items-center gap-2 whitespace-nowrap ${activeShortcutKey === 'Delete' ? 'ring-2 ring-red-500 dark:ring-red-400 bg-red-200 dark:bg-red-900/60 scale-95 shadow-md' : ''}`}
            title="Remove chord at cursor (Shortcut: Delete)"
          >
            <i className="fa-solid fa-eraser"></i> 
            <span className="hidden lg:inline">Remove Chord at Cursor</span>
            <span className="lg:hidden">Remove</span>
          </button>
        </div>
          
        <div className="flex items-center gap-2 border-r border-gray-200 dark:border-gray-700 pr-4">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden sm:block">Transpose</span>
          <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg">
            <button
              onClick={() => handleTranspose(-1)}
              className="px-3 py-1 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded transition-all"
              title="Down 1 semitone"
            >
              -1
            </button>
            <button
              onClick={() => handleTranspose(1)}
              className="px-3 py-1 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded transition-all"
              title="Up 1 semitone"
            >
              +1
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleNormalize}
            className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 border border-indigo-100 dark:border-indigo-900/30 transition-all flex items-center gap-2 whitespace-nowrap"
            title="Normalize chord notation"
            >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            <span>Normalize</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFlats}
            className={`w-10 h-10 text-sm font-black rounded-full border transition-all shadow-sm ${useFlats ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'}`}
              title={useFlats ? "Currently preferring Flats (b). Click to use Sharps (#)." : "Currently preferring Sharps (#). Click to use Flats (b)."}
            >
              {useFlats ? 'b' : '#'}
            </button>
        </div>

        <div className="flex-1 flex gap-2 min-w-[200px]">
            <input
              type="text"
            placeholder="Add specific chord (e.g. G/B)..."
            className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={addChordInput}
              onChange={e => setAddChordInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && addChordInput.trim()) {
                  setManualChords(prev => [...prev, addChordInput.trim()]);
                  setAddChordInput('');
                }
              }}
            />
            <button
              onClick={() => {
                if (addChordInput.trim()) {
                  setManualChords(prev => [...prev, addChordInput.trim()]);
                  setAddChordInput('');
                }
              }}
              className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
            >
              Add
            </button>
        </div>
      </div>

      {/* Main Grid Content - Organized into 7 horizontal columns (Desktop/Tablet) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50/50 dark:bg-gray-900/50">
        {/* Desktop/Tablet: 7-column degree alignment */}
        <div className="hidden sm:block">
          {gridLayout.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-7 gap-3 mb-8 items-start">
              {row.map((group, cIdx) => (
                <div key={cIdx} className="flex flex-col gap-2">
                  {group?.map(chord => renderChordButton(chord))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Mobile: Simple 4-column tiling */}
        <div className="sm:hidden grid grid-cols-4 gap-2">
          {palette.map(chord => renderChordButton(chord))}
        </div>
      </div>
      
      {/* Variation Picker Popup (Hover Actionable) */}
      {variationTarget && (
        <div 
          onMouseEnter={cancelVariationCloseTimer}
          onMouseLeave={startVariationCloseTimer}
          className="absolute inset-x-0 bottom-0 z-[120] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 p-4 shadow-2xl animate-slideInUp rounded-b-2xl"
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-widest">Constructing with root {variationTarget.charAt(0).toUpperCase() + (variationTarget.charAt(1) === '#' ? '#' : variationTarget.charAt(1) === 'b' ? 'b' : '')}</span>
            <button title="Close" onClick={() => setVariationTarget(null)} className="text-gray-400 hover:text-red-500"><i className="fa-solid fa-xmark"></i></button>
          </div>
          
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
            {/* Extension Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {!isAdvanced ? (
                // Basic Mode extensions
                ['', 'sus', '(2)', '(9)'].map(ext => (
                  <button key={ext} onClick={() => buildAndInsert(variationTarget, ext)} className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 transition-colors">
                    {ext || 'Base'}
                  </button>
                ))
              ) : (
                // Advanced Mode extensions
                <div className="space-y-3 w-full">
                  <div className="flex flex-wrap gap-1.5">
                    {ADV_EXTENSIONS.map(ext => (
                      <button key={ext} onClick={() => buildAndInsert(variationTarget, ext)} className="px-2.5 py-1 text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded hover:bg-blue-100">
                        {ext || 'Base'}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-bold text-gray-400 mb-1.5 tracking-widest">Add to present chord</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ADD_TO_EXTENSIONS.map(ext => (
                        <button key={ext} onClick={() => buildAndInsert(variationTarget, ext, true)} className="px-2.5 py-1 text-xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded hover:bg-amber-100">
                          {ext}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Slash Bass Notes */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-[10px] font-bold text-gray-400 mb-2 tracking-widest">Bass Note (Slash)</p>
              <div className="flex flex-wrap gap-1.5">
                {(isAdvanced ? (useFlats ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE) : keyNotes).map(note => (
                  <button
                    key={note}
                    onClick={() => buildAndInsert(variationTarget, '', true, note)}
                    className="w-8 h-8 text-[10px] font-bold border border-gray-200 dark:border-gray-700 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/40 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-all"
                  >
                    {note}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
               <button 
                onClick={() => performAction(() => { onInsert(variationTarget); setVariationTarget(null); })}
                className="flex-1 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/30"
               >
                 Use [{variationTarget}] as is
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Rename Confirmation Overlay */}
      {renameTarget && (
        <div className="absolute inset-0 z-[110] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm flex items-center justify-center p-6 text-center animate-fadeIn rounded-2xl">
          <div className="max-w-xs space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
              <i className="fa-solid fa-arrows-rotate text-xl"></i>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">Global Rename</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Change all <span className="font-bold text-indigo-600 dark:text-indigo-400">[{renameTarget.oldChord}]</span> to <span className="font-bold text-indigo-600 dark:text-indigo-400">[{renameTarget.newChord}]</span>?
              </p>
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mt-2 tracking-widest">
                {renameTarget.count} {renameTarget.count === 1 ? 'instance' : 'instances'} will be updated
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setRenameTarget(null)}
                className="flex-1 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmGlobalRename}
                className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                Rename All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChordAssistantModal;