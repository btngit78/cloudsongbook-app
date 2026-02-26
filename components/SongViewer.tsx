
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Song, UserSettings } from '../types';
import { SetList } from '../types';
import { useMetronome } from '../hooks/useMetronome.ts';

interface SongViewerProps {
  song: Song;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  transpose: number;
  onTranspose?: (val: number) => void;
  activeSetlist?: SetList | null;
  activeSetlistIndex?: number;
  onNextSong?: () => void;
  onPrevSong?: () => void;
  onSetlistJump?: (index: number) => void;
  onExitSetlist?: () => void;
  allSongs?: Song[];
  onUpdateSong?: (song: Partial<Song>) => void;
}

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
const SHARP_TO_FLAT: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

const SongViewer: React.FC<SongViewerProps> = ({ 
  song, settings, onUpdateSettings, transpose, onTranspose,
  activeSetlist, activeSetlistIndex = 0, onNextSong, onPrevSong, onSetlistJump, onExitSetlist, allSongs,
  onUpdateSong
}) => {
  const [hudOpen, setHudOpen] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [currentYouTubeIndex, setCurrentYouTubeIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [validVideoIds, setValidVideoIds] = useState<string[]>([]);
  const [showFixLinkModal, setShowFixLinkModal] = useState(false);
  const [fixLinkUrl, setFixLinkUrl] = useState('');
  const [brokenLinkIds, setBrokenLinkIds] = useState<string[]>([]);
  const [modalPosition, setModalPosition] = useState({ x: 20, y: 100 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const onDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging.current) return;
    
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    
    let newX = clientX - dragOffset.current.x;
    let newY = clientY - dragOffset.current.y;

    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;

      newX = Math.max(0, Math.min(newX, viewportWidth - rect.width));
      newY = Math.max(0, Math.min(newY, viewportHeight - rect.height));
    }

    setModalPosition({ x: newX, y: newY });
  }, []);

  const stopDrag = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
  }, [onDrag]);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    dragOffset.current = {
      x: clientX - modalPosition.x,
      y: clientY - modalPosition.y
    };
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
  };

  const hudRef = useRef<HTMLDivElement>(null);
  const currentChoice = activeSetlist?.choices?.[activeSetlistIndex];
  const displayTempo = currentChoice?.tempo || song.tempo;
  
  const { tempo: effectiveTempo, setTempo: setLocalTempo, active: metronomeActive, toggle: toggleMetronome, beatFlash, tap: handleTap, reset: resetMetronome } = useMetronome(displayTempo);

  useEffect(() => {
    // Close YouTube modal when song changes
    setIsYouTubeModalOpen(false);
  }, [song.id]);

  const youTubeVideoIds = useMemo(() => {
    const ids = new Set<string>();
    const matches = song.body.matchAll(YOUTUBE_REGEX);
    for (const match of matches) {
      if (match[1]) ids.add(match[1]);
    }
    return Array.from(ids);
  }, [song.body]);

  const checkVideoAvailability = (id: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Valid mqdefault is 320x180. The "unavailable" placeholder is 120x90.
        resolve(img.width > 120);
      };
      img.onerror = () => {
        resolve(false);
      };
      img.src = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
    });
  };

  const extractYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    resetMetronome();
  }, [song.id, activeSetlistIndex]);

  useEffect(() => {
    if (!hudOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (hudRef.current && !hudRef.current.contains(event.target as Node)) {
        setHudOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [hudOpen]);

  // Ensure modal stays in viewport on resize
  useEffect(() => {
    const handleResize = () => {
      if ((isYouTubeModalOpen || showFixLinkModal) && modalRef.current) {
        const rect = modalRef.current.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        
        setModalPosition(prev => ({
          x: Math.max(0, Math.min(prev.x, viewportWidth - rect.width)),
          y: Math.max(0, Math.min(prev.y, viewportHeight - rect.height))
        }));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isYouTubeModalOpen, showFixLinkModal]);

  // Determine if we should use flats for the target key based on user preference rules
  const useFlats = useMemo(() => {
    const match = song.key.match(/^([A-G][#b]?)(m)?/);
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
  }, [song.key, transpose]);

  const chordClass = (settings.chordColor === '' || settings.chordColor === 'amber') 
    ? 'text-blue-600 dark:text-amber-400'   // default chord color for both themes
    : 'text-blue-600 dark:text-blue-400';   // alternative chord color for dark theme
    
  const sectionClass = (settings.sectionColor === '' || settings.sectionColor === 'purple')
    ? 'text-gray-800 dark:text-indigo-500'  // default section color for both themes
    : 'text-gray-800 dark:text-teal-400';   // alternative section color for dark theme

  const transposeChord = (chord: string, offset: number): string => {
    if (offset === 0) return chord;
    
    return chord.split('/').map(part => {
      const match = part.match(/^([A-G][#b]?)(.*)/);
      if (!match) return part;

      let root = match[1];
      const suffix = match[2];
      if (FLAT_MAP[root]) root = FLAT_MAP[root];

      const index = CHROMATIC_SCALE.indexOf(root);
      if (index === -1) return part;

      let newIndex = (index + offset) % 12;
      if (newIndex < 0) newIndex += 12;

      const note = CHROMATIC_SCALE[newIndex];
      if (useFlats && SHARP_TO_FLAT[note]) {
        return SHARP_TO_FLAT[note] + suffix;
      }
      return note + suffix;
    }).join('/');
  };

  const processLine = (line: string, isChorus: boolean) => {
    if (!settings.showChords) {
      const lyricLine = line.replace(/\[.*?\]/g, '').trim();
      const indent = isChorus ? '   ' : '';
      return {
        chordLine: '',
        lyricLine: indent + lyricLine
      };
    }

    const parts = line.split(/(\[.*?\])/g).filter(p => p !== '');
    let chordLine = '';
    let lyricLine = '';

    parts.forEach(part => {
      if (part.startsWith('[') && part.endsWith(']')) {
        const chordRaw = part.slice(1, -1);
        const chord = transposeChord(chordRaw, transpose);
        
        // Synchronize lengths so chord aligns with current text position
        const maxLen = Math.max(chordLine.length, lyricLine.length);
        chordLine = chordLine.padEnd(maxLen, ' ');
        lyricLine = lyricLine.padEnd(maxLen, ' ');

        // Ensure separation: if chordLine doesn't end in space, add one to both lines
        if (chordLine.length > 0 && !chordLine.endsWith(' ')) {
          chordLine += ' ';
          lyricLine += ' ';
        }

        chordLine += chord;
      } else {
        lyricLine += part;
      }
    });

    const indent = isChorus ? '   ' : '';

    return {
      chordLine: indent + chordLine,
      lyricLine: indent + lyricLine
    };
  };

  const formatLyrics = (text: string) => {
    const parts = text.split(/(\([^)]*\))/g);
    return parts.map((part, index) => {
      if (part.startsWith('(') && part.endsWith(')')) {
        return <span key={index} className="text-red-600 dark:text-red-400">{part}</span>;
      }
      return part;
    });
  };

  const renderContent = (body: string) => {
    const blocks = body.split(/\n\s*\n/);
    let chorusCount = 0;
    
    return blocks.map((block, bIdx) => {
      const lines = block.split('\n');
      const startsWithChorusLabel = lines[0].toLowerCase().trim().startsWith('chorus') || 
                                    lines[0].toLowerCase().trim().startsWith('{soc}');
      
      let inChorusSection = startsWithChorusLabel;
      let mbClass = 'mb-2';
      
      const sectionId = startsWithChorusLabel ? `chorus-${chorusCount++}` : undefined;

      return (
        <div key={bIdx} id={sectionId} className={`${mbClass} last:mb-6`}>
          {lines.map((line, lIdx) => {
            const isComment = line.trim().startsWith('#');
            if (isComment) {
              if (!settings.showComments) return null;
              return <div key={lIdx} className="whitespace-pre font-mono text-gray-400 dark:text-gray-500 italic text-sm my-1">{line}</div>;
            }

            const trimmed = line.trim().toLowerCase();
            if (trimmed === '{eoc}') {
              inChorusSection = false;
              return null;
            }
           
            if (lIdx === 0) {
              if (startsWithChorusLabel)        // Chorus label (e.g. "Chorus:", "{soc}") needs indentation
                return <div key={lIdx} className={`font-bold ${sectionClass} mb-1 whitespace-pre`}>   Chorus:</div>;
              else if (trimmed.endsWith(':'))   // Section header (e.g. "Verse 1:", "Bridge:", "Coda:")
                return <div key={lIdx} className={`font-bold ${sectionClass} mb-1 whitespace-pre`}>{line.trim()}</div>;
            }

            const { chordLine, lyricLine } = processLine(line, inChorusSection);
            const hasChords = chordLine.trim().length > 0;

            return (
              <div key={lIdx} className="mb-0.5 last:mb-6">
                {settings.showChords && hasChords && (
                  <div className={`chord whitespace-pre font-mono min-h-[1em] leading-none ${chordClass} mt-0.5`}>{chordLine}</div>
                )}
                <div className="lyrics whitespace-pre font-mono">{formatLyrics(lyricLine)}</div>
              </div>
            );
          })}
        </div>
      );
    });
  };

  const handleQuickTranspose = () => {
    if (!currentChoice?.key || !onTranspose) return;
    
    const targetKey = currentChoice.key;
    const match = targetKey.match(/^([A-G][#b]?)/);
    if (!match) return;
    
    let targetRoot = match[1];
    if (FLAT_MAP[targetRoot]) targetRoot = FLAT_MAP[targetRoot];
    
    const targetIndex = CHROMATIC_SCALE.indexOf(targetRoot);
    
    // Get original key
    const originalMatch = song.key.match(/^([A-G][#b]?)/);
    if (!originalMatch) return;
    
    let originalRoot = originalMatch[1];
    if (FLAT_MAP[originalRoot]) originalRoot = FLAT_MAP[originalRoot];
    const originalIndex = CHROMATIC_SCALE.indexOf(originalRoot);
    
    if (targetIndex === -1 || originalIndex === -1) return;

    let diff = targetIndex - originalIndex;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    
    onTranspose(diff);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto p-2 md:p-4 animate-fadeIn relative pb-24">
      <header className="mb-4 pb-2 flex justify-between items-end">
        <div className="text-left">
          <div 
            className="text-gray-500 dark:text-gray-400 italic font-medium leading-none flex items-center flex-wrap gap-y-1"
            style={{ fontSize: `${settings.fontSize * 0.66}px` }}
          >
            <span>By {song.authors || 'Unknown'}</span>
            <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-600 pl-2 ml-2">
              <input
                type="number"
                min={0}
                max={400}
                value={effectiveTempo ?? ''}
                onChange={(e) => setLocalTempo(e.target.value === '' ? undefined : parseInt(e.target.value))}
                className="w-14 bg-transparent text-gray-500 dark:text-gray-400 font-medium p-0 border-none focus:ring-0 text-right"
                placeholder="---"
                title="Adjust tempo temporarily"
              />
              <span className="text-gray-400 dark:text-gray-500 -ml-2">BPM</span>
              <button
                onClick={handleTap}
                className="ml-1 px-2 py-0.5 text-[10px] font-bold border border-gray-300 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-blue-100 dark:active:bg-blue-900 transition-colors select-none"
                title="Tap to set tempo"
              >
                TAP
              </button>
              <button
                onClick={toggleMetronome}
                disabled={!effectiveTempo || effectiveTempo <= 0}
                className={`w-5 h-5 flex items-center justify-center rounded-full transition-all ${metronomeActive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'} disabled:opacity-50 disabled:cursor-not-allowed`}
                title={metronomeActive ? "Stop Metronome" : "Start Metronome"}
              >
                <i className="fa-solid fa-stopwatch text-[10px]"></i>
              </button>
              <div 
                className={`w-2 h-2 rounded-full transition-all duration-75 ${beatFlash ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-150' : 'bg-gray-300 dark:bg-gray-600'}`}
              ></div>
              <button
                onClick={async () => {
                  const allIdsInBody = youTubeVideoIds;
              
                  if (allIdsInBody.length === 0) {
                      if (window.confirm(`No YouTube video link found.\n\nSearch YouTube for "${song.title}"?`)) {
                          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.authors)}`, '_blank');
                      }
                      return;
                  }
              
                  const checks = await Promise.all(allIdsInBody.map(async (id) => ({ id, valid: await checkVideoAvailability(id) })));
                  const availableIds = checks.filter(c => c.valid).map(c => c.id);
                  const invalidIds = checks.filter(c => !c.valid).map(c => c.id);
              
                  if (invalidIds.length > 0 && onUpdateSong) {
                      let shouldRemove = false;
                      
                      if (settings.autoRemoveBrokenLinks) {
                          shouldRemove = true;
                      } else {
                          setBrokenLinkIds(invalidIds);
                          setValidVideoIds(availableIds);
                          setShowFixLinkModal(true);
                          return;
                      }

                      if (shouldRemove) {
                          const newBody = song.body.split('\n').filter(line => {
                              if (!line.trim().startsWith('#')) return true;
                              const containsInvalidLink = invalidIds.some(id => line.includes(id));
                              return !containsInvalidLink;
                          }).join('\n');
                          
                          onUpdateSong({ ...song, body: newBody });
                          
                          // If manual confirmation, return to refresh. If auto, fall through to show valid videos if any.
                          if (!settings.autoRemoveBrokenLinks) return;
                      }
                  }
              
                  if (availableIds.length > 0) {
                      const width = window.innerWidth;
                      const modalWidth = width >= 768 ? 384 : 320;
                      setModalPosition({ x: Math.max(20, width - modalWidth - 30), y: 100 });
                      setValidVideoIds(availableIds);
                      setCurrentYouTubeIndex(0);
                      setIsYouTubeModalOpen(true);
                      setIsMinimized(false);
                  } else {
                      const confirmMessage = `Existing URL link is no longer valid and should be repaired.\n\nStart a search on YouTube?`;
                      if (window.confirm(confirmMessage)) {
                          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.authors)}`, '_blank');
                      }
                  }
                }}
                className={`ml-2 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${youTubeVideoIds.length > 0 ? 'text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900' : 'text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                title={youTubeVideoIds.length > 0 ? "Watch YouTube video" : "Search on YouTube"}
              >
                <i className="fa-brands fa-youtube text-sm"></i>
              </button>
            </div>
          </div>
          {currentChoice && (
            <div className="flex flex-wrap gap-2 mt-1.5">
              {currentChoice.singer && (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                  <i className="fa-solid fa-microphone mr-1"></i>{currentChoice.singer}
                </span>
              )}
              {currentChoice.key && (
                <span 
                  onDoubleClick={handleQuickTranspose}
                  title="Double-click to transpose to this key"
                  className="text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 cursor-pointer select-none hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  Key: {currentChoice.key}
                </span>
              )}
              {currentChoice.style && (
                <span className="text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                  {currentChoice.style}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Setlist HUD */}
        {activeSetlist && (
          <div ref={hudRef} className="relative z-20">
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
              <button
                aria-label="Previous Song" 
                onClick={onPrevSong}
                title="Previous Song"
                disabled={activeSetlistIndex <= 0}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <i className="fa-solid fa-backward-step"></i>
              </button>
              
              <button 
                onClick={() => setHudOpen(!hudOpen)}
                className="px-3 py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Click to jump to another song"
              >
                <span className="text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{activeSetlist.name}:</span>
                <span className="text-gray-900 dark:text-gray-100 text-sm">{activeSetlistIndex + 1}/{activeSetlist.choices.length}</span>
              </button>

              <button
                aria-label="Next Song" 
                onClick={onNextSong}
                title="Next Song"
                disabled={activeSetlistIndex >= activeSetlist.choices.length - 1}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <i className="fa-solid fa-forward-step"></i>
              </button>

              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

              <button 
                onClick={onExitSetlist}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Exit Setlist"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Dropdown List */}
            {hudOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-64 overflow-y-auto">
                {activeSetlist.choices.map((choice, idx) => {
                  const sTitle = allSongs?.find(s => s.id === choice.songId)?.title || 'Unknown';
                  return (
                    <button
                      key={idx}
                      onClick={() => { onSetlistJump?.(idx); setHudOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 flex items-center space-x-3 ${idx === activeSetlistIndex ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : 'text-gray-700 dark:text-gray-200'}`}
                    >
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-4">{idx + 1}.</span>
                      <span className="truncate flex-1">{sTitle}</span>
                      {choice.key && (
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 shrink-0">
                          {choice.key}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </header>
      
      <div 
        className={`bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-300 overflow-hidden ${song.isPdf ? 'p-0' : 'p-2 md:p-4 overflow-x-auto'}`}
        style={!song.isPdf ? { fontSize: `${settings.fontSize}px` } : {}}
      >
        {song.isPdf && song.pdfData ? (
          <div className="w-full h-[80vh]">
            <iframe 
              src={`${song.pdfData}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              className="w-full h-full rounded-3xl"
              title={song.title}
            ></iframe>
          </div>
        ) : (
          <div className="leading-tight select-text font-mono text-gray-900 dark:text-gray-100">
            {renderContent(song.body)}
          </div>
        )}
      </div>

      {song.keywords && (
        <div className="mt-8 flex flex-wrap gap-2">
          {song.keywords.map((kw, i) => (
            <span key={i} className="text-[10px] font-bold text-blue-500 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded uppercase tracking-wider">
              #{kw}
            </span>
          ))}
        </div>
      )}
      </div>

      {/* YouTube Modal */}
      {isYouTubeModalOpen && validVideoIds.length > 0 && (
        <div 
          ref={modalRef}
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 md:w-96 animate-fadeIn overflow-hidden"
          style={{ left: modalPosition.x, top: modalPosition.y }}
        >
          <div 
            className="p-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 cursor-move bg-gray-50 dark:bg-gray-700/50 rounded-t-xl"
            onMouseDown={startDrag}
            onTouchStart={startDrag}
          >
            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 ml-2 select-none flex items-center gap-2">
              <i className="fa-brands fa-youtube text-red-600"></i>
              <span>({currentYouTubeIndex + 1}/{validVideoIds.length})</span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={isMinimized ? "Expand" : "Minimize"}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <i className={`fa-solid ${isMinimized ? 'fa-expand' : 'fa-minus'} text-xs`}></i>
              </button>
              <button
                onClick={() => setIsYouTubeModalOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Close"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
          </div>
          {!isMinimized && (
            <>
          <div className="aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${validVideoIds[currentYouTubeIndex]}?autoplay=1&rel=0`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>
          {validVideoIds.length > 1 && (
            <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-1 pointer-events-none">
              <button
                onClick={() => setCurrentYouTubeIndex(prev => (prev - 1 + validVideoIds.length) % validVideoIds.length)}
                className="bg-black/30 text-white w-8 h-8 rounded-full hover:bg-black/50 transition-colors pointer-events-auto flex items-center justify-center"
                title="Previous Video"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <button
                onClick={() => setCurrentYouTubeIndex(prev => (prev + 1) % validVideoIds.length)}
                className="bg-black/30 text-white w-8 h-8 rounded-full hover:bg-black/50 transition-colors pointer-events-auto flex items-center justify-center"
                title="Next Video"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* Fix Link Modal */}
      {showFixLinkModal && (
        <div 
          ref={modalRef}
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 md:w-96 animate-fadeIn overflow-hidden"
          style={{ left: modalPosition.x, top: modalPosition.y }}
        >
          <div 
            className="p-3 border-b border-gray-200 dark:border-gray-700 cursor-move bg-gray-50 dark:bg-gray-700/50 rounded-t-xl flex justify-between items-center"
            onMouseDown={startDrag}
            onTouchStart={startDrag}
          >
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 select-none">
              <i className="fa-solid fa-wrench text-amber-500"></i>
              Fix Broken Link
            </h3>
            <button
              title="Close"
              onClick={() => setShowFixLinkModal(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p className="mb-2">A YouTube link in this song is unavailable.</p>
              <button 
                onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.authors)}`, '_blank')}
                className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-bold flex items-center gap-1"
              >
                <i className="fa-brands fa-youtube"></i> Search for replacement
              </button>
            </div>

            <input
              type="text"
              value={fixLinkUrl}
              onChange={(e) => setFixLinkUrl(e.target.value)}
              placeholder="Paste new YouTube URL here..."
              className="w-full text-sm p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  const newBody = song.body.split('\n').filter(line => {
                    if (!line.trim().startsWith('#')) return true;
                    return !brokenLinkIds.some(id => line.includes(id));
                  }).join('\n');
                  onUpdateSong?.({ ...song, body: newBody });
                  setShowFixLinkModal(false);
                }}
                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                Remove Link
              </button>
              <button
                onClick={() => {
                  const newId = extractYouTubeId(fixLinkUrl);
                  if (newId && brokenLinkIds.length > 0) {
                    const oldId = brokenLinkIds[0];
                    const newBody = song.body.replace(oldId, newId);
                    onUpdateSong?.({ ...song, body: newBody });
                    setShowFixLinkModal(false);
                    setFixLinkUrl('');
                  } else {
                    alert("Invalid YouTube URL");
                  }
                }}
                disabled={!fixLinkUrl}
                className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Replace
              </button>
            </div>
            
            {validVideoIds.length > 0 && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 text-center">
                <button
                  onClick={() => {
                    setShowFixLinkModal(false);
                    setIsYouTubeModalOpen(true);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Ignore and watch valid videos ({validVideoIds.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SongViewer;
