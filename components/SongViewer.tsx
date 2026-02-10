
import React, { useState } from 'react';
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

const SongViewer: React.FC<SongViewerProps> = ({ 
  song, settings, onUpdateSettings, transpose,
  activeSetlist, activeSetlistIndex = 0, onNextSong, onPrevSong, onSetlistJump, onExitSetlist, allSongs
}) => {
  const [hudOpen, setHudOpen] = useState(false);

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

      return CHROMATIC_SCALE[newIndex] + suffix;
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
        return <span key={index} className="text-red-600">{part}</span>;
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
                return <div key={lIdx} className="font-bold text-gray-800 mb-1 whitespace-pre">   Chorus:</div>;
              else if (trimmed.endsWith(':'))   // Section header (e.g. "Verse 1:", "Bridge:", "Coda:")
                return <div key={lIdx} className="font-bold text-gray-800 mb-1 whitespace-pre">{line.trim()}</div>;
            }

            const { chordLine, lyricLine } = processLine(line, inChorusSection);
            const hasChords = chordLine.trim().length > 0;

            return (
              <div key={lIdx} className="mb-0.5 last:mb-6">
                {settings.showChords && hasChords && (
                  <div className="chord whitespace-pre font-mono min-h-[1em] leading-none text-blue-600 mt-0.5">{chordLine}</div>
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
            className="text-gray-500 italic font-medium leading-none"
            style={{ fontSize: `${settings.fontSize * 0.66}px` }}
          >
            By {song.author || 'Unknown'} {song.tempo ? `-- ${song.tempo} BPM` : ''}
          </p>
        </div>

        {/* Setlist HUD */}
        {activeSetlist && (
          <div className="relative z-20">
            <div className="flex items-center bg-gray-100 text-gray-900 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <button 
                onClick={onPrevSong}
                disabled={activeSetlistIndex <= 0}
                className="p-2 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <i className="fa-solid fa-backward-step"></i>
              </button>
              
              <button 
                onClick={() => setHudOpen(!hudOpen)}
                className="px-3 py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-gray-200 transition-colors"
              >
                <span className="text-gray-500 truncate max-w-[150px]">{activeSetlist.name}:</span>
                <span className="text-gray-900 text-sm">{activeSetlistIndex + 1}/{activeSetlist.songIds.length}</span>
              </button>

              <button 
                onClick={onNextSong}
                disabled={activeSetlistIndex >= activeSetlist.songIds.length - 1}
                className="p-2 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <i className="fa-solid fa-forward-step"></i>
              </button>

              <div className="w-px h-5 bg-gray-300 mx-1"></div>

              <button 
                onClick={onExitSetlist}
                className="p-2 hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                title="Exit Setlist"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Dropdown List */}
            {hudOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden max-h-64 overflow-y-auto">
                {activeSetlist.songIds.map((sid, idx) => {
                  const sTitle = allSongs?.find(s => s.id === sid)?.title || 'Unknown';
                  return (
                    <button
                      key={idx}
                      onClick={() => { onSetlistJump?.(idx); setHudOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 hover:bg-blue-50 flex items-center space-x-3 ${idx === activeSetlistIndex ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                    >
                      <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
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
        className={`bg-white rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 overflow-hidden ${song.isPdf ? 'p-0' : 'p-2 md:p-4 overflow-x-auto'}`}
        style={!song.isPdf ? { fontSize: `${settings.fontSize}px` } : {}}
      >
        {song.isPdf && song.pdfData ? (
          <div className="w-full h-[80vh]">
            <iframe 
              src={song.pdfData} 
              className="w-full h-full rounded-3xl"
              title={song.title}
            ></iframe>
          </div>
        ) : (
          <div className="leading-tight select-text font-mono">
            {renderContent(song.body)}
          </div>
        )}
      </div>

      {song.keywords && (
        <div className="mt-8 flex flex-wrap gap-2">
          {song.keywords.split(' ').map((kw, i) => (
            <span key={i} className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded uppercase tracking-wider">
              #{kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default SongViewer;
