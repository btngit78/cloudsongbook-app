
import React, { useState } from 'react';
import { Song, UserSettings } from '../types';

interface SongViewerProps {
  song: Song;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  transpose: number;
}

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const SongViewer: React.FC<SongViewerProps> = ({ song, settings, onUpdateSettings, transpose }) => {

  const transposeChord = (chord: string, offset: number): string => {
    if (offset === 0) return chord;
    const match = chord.match(/^([A-G][#b]?)(.*)/);
    if (!match) return chord;

    let root = match[1];
    const suffix = match[2];
    if (FLAT_MAP[root]) root = FLAT_MAP[root];

    const index = CHROMATIC_SCALE.indexOf(root);
    if (index === -1) return chord;

    let newIndex = (index + offset) % 12;
    if (newIndex < 0) newIndex += 12;

    return CHROMATIC_SCALE[newIndex] + suffix;
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
    
    return blocks.map((block, bIdx) => {
      const lines = block.split('\n');
      const startsWithChorusLabel = lines[0].toLowerCase().trim().startsWith('chorus') || 
                                    lines[0].toLowerCase().trim().startsWith('{soc}');
      
      let inChorusSection = startsWithChorusLabel;
      let mbClass = 'mb-2';

      return (
        <div key={bIdx} className={`${mbClass} last:mb-6`}>
          {lines.map((line, lIdx) => {
            const trimmed = line.trim().toLowerCase();
            if (trimmed === '{eoc}') {
              inChorusSection = false;
              return null;
            }
           
            if (lIdx === 0 && startsWithChorusLabel) {
              return <div key={lIdx} className="font-bold text-gray-800 mb-1 whitespace-pre">   Chorus:</div>;
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
      <header className="mb-4 pb-2">
        <p 
          className="text-gray-500 italic font-medium leading-none"
          style={{ fontSize: `${settings.fontSize * 0.66}px` }}
        >
          By {song.author || 'Unknown'} {song.tempo ? `-- ${song.tempo} BPM` : ''}
        </p>
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
