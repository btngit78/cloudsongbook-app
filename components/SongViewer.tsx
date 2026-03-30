
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Song, UserSettings, SetList, SongChoice, User } from '../types';
import { useMetronome } from '../hooks/useMetronome.ts';
import YouTubePlayerModal from './YouTubePlayerModal';
import AddToSetlistModal from './AddToSetlistModal';
import FixLinkModal from './FixLinkModal';
import { LyricsRenderer } from './LyricsRenderer';
import { generateSongPdf } from '../services/pdfGenerator';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { calculateLinesPer10Seconds } from '../utils/scrollUtils';

// Set up pdf.js worker.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  localShowChords: boolean;
  onSetLocalShowChords: (show: boolean) => void;
  user?: User;
  setlists?: SetList[];
  onSaveSetlist?: (setlist: SetList) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  isScrolling: boolean;
  onToggleScroll: () => void;
  scrollSpeedValue: number;
}

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

const SongViewer: React.FC<SongViewerProps> = ({ 
  song, settings, onUpdateSettings, transpose, onTranspose,
  activeSetlist, activeSetlistIndex = 0, onNextSong, onPrevSong, onSetlistJump, onExitSetlist, allSongs, localShowChords, onSetLocalShowChords,
  onUpdateSong, user, setlists, onSaveSetlist,
  scrollContainerRef,
  isScrolling, onToggleScroll, scrollSpeedValue
}) => {
  const [hudOpen, setHudOpen] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [isAddToSetlistModalOpen, setIsAddToSetlistModalOpen] = useState(false);
  const [validVideoIds, setValidVideoIds] = useState<string[]>([]);
  const [showFixLinkModal, setShowFixLinkModal] = useState(false);
  const [brokenLinkIds, setBrokenLinkIds] = useState<string[]>([]);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const hudRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll state
  const pdfContainerRef = useRef<HTMLDivElement>(null!);

  const currentChoice = activeSetlist?.choices?.[activeSetlistIndex];
  const displayTempo = currentChoice?.tempo || song.tempo;
  
  const { tempo: effectiveTempo, setTempo: setLocalTempo, active: metronomeActive, toggle: toggleMetronome, beatFlash, tap: handleTap, reset: resetMetronome } = useMetronome(displayTempo);

  useEffect(() => {
    // Close YouTube modal when song changes
    setIsYouTubeModalOpen(false);
  }, [song.id]);

  // Keyboard shortcut for scrolling (Space bar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault(); // Prevent default page scroll
        onToggleScroll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleScroll]);

  // Double tap to toggle scroll logic
  const lastTapRef = useRef(0);
  const handleTouchStart = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onToggleScroll();
    }
    lastTapRef.current = now;
  };

  // Auto-scroll animation loop
  useEffect(() => {
    let lastTime = 0;
    let animationFrameId: number;
    let scrollRemainder = 0;

    // Calculate pixels per second based on the new "lines per second" logic
    const linesPer10Sec = calculateLinesPer10Seconds(scrollSpeedValue);
    const linesPerSec = linesPer10Sec / 10;
    
    // From Tailwind's theme, `leading-tight` is 1.25. This is a good approximation for a "line" of text.
    const lineHeight = settings.fontSize * 1.25;
    const pixelsPerSecond = linesPerSec * lineHeight;

    const animate = (time: number) => {
      if (!lastTime) lastTime = time;
      const deltaTime = time - lastTime;
      
      if (deltaTime >= 16) { // Cap at ~60fps logic
        const target = song.isPdf ? pdfContainerRef.current : scrollContainerRef?.current;
        if (target) {
          const pixelsToScroll = (pixelsPerSecond * deltaTime) / 1000;
          scrollRemainder += pixelsToScroll;

          // Accumulate fractional pixels and only apply when we have a whole pixel to move
          if (Math.abs(scrollRemainder) >= 1) {
            const pixelsToApply = Math.floor(scrollRemainder);
            target.scrollTop += pixelsToApply;
            scrollRemainder -= pixelsToApply;
          }
        }
        lastTime = time;
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };

    if (isScrolling) {
      animationFrameId = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isScrolling, scrollSpeedValue, song.isPdf, scrollContainerRef, settings.fontSize]);

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

  useEffect(() => {
    resetMetronome();
  }, [song.id, activeSetlistIndex, activeSetlist]);

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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowCopyFeedback(true);
      setTimeout(() => setShowCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleAddToSetlistConfirm = (setlistId: string | null, newName: string | null, songChoice: SongChoice) => {
    if (!onSaveSetlist || !user) return;

    let targetSetlist: SetList;

    if (setlistId && setlists) {
      // Existing
      const existing = setlists.find(s => s.id === setlistId);
      if (!existing) return; // Should not happen
      targetSetlist = { ...existing, choices: [...existing.choices, songChoice], updatedAt: Date.now() };
    } else if (newName) {
      // New
      targetSetlist = {
        id: Date.now().toString(),
        name: newName,
        choices: [songChoice],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerId: user.id,
        lastUsedAt: 0
      };
    } else {
      return;
    }
    onSaveSetlist(targetSetlist);
    setIsAddToSetlistModalOpen(false);
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
              <div 
                className={`w-2 h-2 rounded-full transition-all duration-75 ${beatFlash ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-150' : 'bg-gray-300 dark:bg-gray-600'}`}
              ></div>
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
              <button
                onClick={() => onSetLocalShowChords(!localShowChords)}
                className={`ml-1 w-5 h-5 flex items-center justify-center rounded-full transition-all ${localShowChords ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'}`}
                title={localShowChords ? "Hide Chords" : "Show Chords"}
              >
                <i className="fa-solid fa-music text-[10px]"></i>
              </button>
              <button
                onClick={handleCopyLink}
                className={`ml-2 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${showCopyFeedback ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' : 'text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                title={showCopyFeedback ? "Copied!" : "Copy Link"}
              >
                {showCopyFeedback ? <i className="fa-solid fa-check text-sm"></i> : <i className="fa-solid fa-link text-sm"></i>}
              </button>
              
              {user && setlists && onSaveSetlist && (
                <button
                  onClick={() => setIsAddToSetlistModalOpen(true)}
                  className="ml-2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Add to Setlist"
                >
                  <i className="fa-solid fa-folder-plus text-sm"></i>
                </button>
              )}
              <button
                onClick={async () => {
                  if (song.isPdf && song.pdfUrl) {
                    window.open(song.pdfUrl, '_blank');
                  } else {
                    await generateSongPdf(song, settings, localShowChords, transpose);
                  }
                }}
                className="ml-2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Print / Export to PDF"
              >
                <i className="fa-solid fa-print text-sm"></i>
              </button>
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
                      setValidVideoIds(availableIds);
                      setIsYouTubeModalOpen(true);
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
      
      <div id="printable-song-content" onTouchStart={handleTouchStart}>
        <div className="print-only">
          <h1 style={{ fontSize: '20pt', fontWeight: 'bold', color: 'black', marginBottom: '0.25rem' }}>{song.title}</h1>
          <h2 style={{ fontSize: '12pt', fontStyle: 'italic', color: 'black', marginBottom: '1rem' }}>By {song.authors || 'Unknown'}</h2>
        </div>
        <LyricsRenderer 
          song={song} 
          settings={{ ...settings, showChords: localShowChords }}
          pdfContainerRef={pdfContainerRef}
          transpose={transpose} 
        />
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
        <YouTubePlayerModal
          videoIds={validVideoIds}
          onClose={() => setIsYouTubeModalOpen(false)}
        />
      )}

      {/* Add To Setlist Modal */}
      {isAddToSetlistModalOpen && user && setlists && (
        <AddToSetlistModal 
          song={song}
          availableSetlists={setlists.filter(s => s.ownerId === user.id)}
          onClose={() => setIsAddToSetlistModalOpen(false)}
          onConfirm={handleAddToSetlistConfirm}
        />
      )}

      {/* Fix Link Modal */}
      {showFixLinkModal && onUpdateSong && (
        <FixLinkModal
          song={song}
          brokenLinkIds={brokenLinkIds}
          validVideoIds={validVideoIds}
          onClose={() => setShowFixLinkModal(false)}
          onUpdateSong={onUpdateSong}
          onShowYouTube={() => setIsYouTubeModalOpen(true)}
        />
      )}

    <style>{`
        @page {
            margin: 0.7in;
        }
        .print-only {
            display: none;
        }
        .react-pdf__Page__canvas {
            margin: 0 auto; /* Center page canvas */
        }
        @media print {
            /* Reset body and html to allow content to flow */
            html, body {
                height: auto !important;
                overflow: visible !important;
            }
            /* Hide react-pdf viewer during print, use LyricsRenderer */
            .pdf-viewer-container {
                display: none !important;
            }
            /* Hide everything on the page by default */
            body * {
                visibility: hidden;
            }
            /* Make the printable content and its children visible */
            #printable-song-content, #printable-song-content *, .print-only, .print-only * {
                visibility: visible;
            }
            /* Position the content at the top of the page, removing it from its original layout context */
            #printable-song-content {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                font-size: 12pt;
            }
            /* Show the print-specific header */
            .print-only {
                display: block;
            }

            /* --- Overrides for Clean Printing --- */
            #printable-song-content * {
                color: black !important; /* 1. Force black text */
            }
            .song-renderer-root {
                /* 2. Reset container to allow multi-page flow */
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
                padding: 0 !important;
                border: none !important;
                background: transparent !important;
                box-shadow: none !important;
            }
            .print-avoid-break {
                break-inside: avoid; /* 3. Keep chord/lyric pairs together */
                page-break-inside: avoid; /* Legacy fallback */
            }
            #printable-song-content .chord {
                color: #2563EB !important; /* 4. Style chords for clarity */
                font-weight: bold;
            }
            #printable-song-content span[class*="text-red"] {
                font-style: italic;
            }
            #printable-song-content a {
                display: none;
            }
        }
    `}</style>
    </>
  );
};

export default SongViewer;
