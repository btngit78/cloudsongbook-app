import React, { useMemo } from 'react';
import { Song, UserSettings } from '../types';

interface LyricsRendererProps {
  song: Song;
  settings: UserSettings;
  transpose: number;
}

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
const SHARP_TO_FLAT: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };

export const LyricsRenderer: React.FC<LyricsRendererProps> = ({ song, settings, transpose }) => {
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
              // Check for URLs in comments to render them as clickable links
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              if (urlRegex.test(line)) {
                const parts = line.split(urlRegex);
                return (
                  <div key={lIdx} className="my-1.5 flex flex-wrap items-center gap-x-1 text-sm">
                    <i className="fa-solid fa-arrow-up-right-from-square text-xs text-blue-500 dark:text-blue-400 mr-1 opacity-70"></i>
                    {parts.map((part, pIdx) => {
                      if (part.match(/^https?:\/\//)) {
                        return (
                          <a key={pIdx} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all font-medium" onClick={(e) => e.stopPropagation()}>
                            {part}
                          </a>
                        );
                      }
                      // Remove leading # from the first text part
                      let text = part;
                      if (pIdx === 0) text = text.replace(/^#\s*/, '');
                      if (!text.trim()) return null;
                      return <span key={pIdx} className="text-gray-500 dark:text-gray-400 italic">{text}</span>;
                    })}
                  </div>
                );
              }
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

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-300 overflow-hidden ${song.isPdf ? 'p-0' : 'p-2 md:p-4 overflow-x-auto'}`}
      style={!song.isPdf ? { fontSize: `${settings.fontSize}px` } : {}}
    >
      {song.isPdf && song.pdfUrl ? (
        <div className="w-full h-[80vh]">
          <iframe 
            src={`${song.pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
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
  );
};