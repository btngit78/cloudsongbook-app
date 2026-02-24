
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Song, UserSettings } from '../types';
import { SetList } from '../types';

interface SongViewerProps {
  song: Song;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  transpose: number;
  activeSetlist?: SetList | null;
  activeSetlistIndex?: number;
  onNextSong?: () => void;
  onPrevSong?: () => void;
  onSetlistJump?: (index: number) => void;
  onExitSetlist?: () => void;
  allSongs?: Song[];
}

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
const SHARP_TO_FLAT: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };

const SongViewer: React.FC<SongViewerProps> = ({ 
  song, settings, onUpdateSettings, transpose,
  activeSetlist, activeSetlistIndex = 0, onNextSong, onPrevSong, onSetlistJump, onExitSetlist, allSongs
}) => {
  const [hudOpen, setHudOpen] = useState(false);
  const hudRef = useRef<HTMLDivElement>(null);
  const currentChoice = activeSetlist?.choices?.[activeSetlistIndex];

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

  // Determine if we should use flats for the target key based on user preference rules
  const useFlats = useMemo(() => {
    const match = song.key.match(/^([A-G][#b]?)/);
    const root = match ? match[1] : 'C';
    let normalizedRoot = root;
    if (FLAT_MAP[root]) normalizedRoot = FLAT_MAP[root];
    
    const originalIndex = CHROMATIC_SCALE.indexOf(normalizedRoot);
    let targetIndex = (originalIndex + transpose) % 12;
    if (targetIndex < 0) targetIndex += 12;
    
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

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-4 animate-fadeIn relative pb-24">
      <header className="mb-4 pb-2 flex justify-between items-end">
        <div className="text-left">
          <p 
            className="text-gray-500 dark:text-gray-400 italic font-medium leading-none"
            style={{ fontSize: `${settings.fontSize * 0.66}px` }}
          >
            By {song.authors || 'Unknown'} {(currentChoice?.tempo || song.tempo) ? `-- ${currentChoice?.tempo || song.tempo} BPM` : ''}
          </p>
          {currentChoice && (
            <div className="flex flex-wrap gap-2 mt-1.5">
              {currentChoice.singer && (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                  <i className="fa-solid fa-microphone mr-1"></i>{currentChoice.singer}
                </span>
              )}
              {currentChoice.key && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
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
                      <span className="truncate">{sTitle}</span>
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
  );
};

export default SongViewer;
