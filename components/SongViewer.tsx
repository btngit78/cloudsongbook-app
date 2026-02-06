
import React, { useState } from 'react';
import { Song, UserSettings } from '../types';

interface SongViewerProps {
  song: Song;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const SongViewer: React.FC<SongViewerProps> = ({ song, settings, onUpdateSettings }) => {
  const [transpose, setTranspose] = useState(0);

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
    let lyricLine = '';
    let chordEntries: { pos: number; chord: string }[] = [];
    
    let currentPos = 0;
    const regex = /\[(.*?)\]/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(line)) !== null) {
      const textBefore = line.substring(lastIndex, match.index);
      lyricLine += textBefore;
      currentPos += textBefore.length;
      
      const chord = transposeChord(match[1], transpose);
      chordEntries.push({ pos: currentPos, chord });
      
      lastIndex = regex.lastIndex;
    }
    
    lyricLine += line.substring(lastIndex);

    let chordLine = '';
    let cursor = 0;
    chordEntries.forEach(({ pos, chord }) => {
      const spacesNeeded = pos - cursor;
      if (spacesNeeded > 0) {
        chordLine += ' '.repeat(spacesNeeded);
      } else if (spacesNeeded < 0 && chordLine.length > 0) {
        chordLine += ' ';
      }
      chordLine += chord;
      cursor = chordLine.length;
    });

    const indent = isChorus ? '  ' : '';

    return {
      chordLine: indent + chordLine,
      lyricLine: indent + lyricLine
    };
  };

  const renderContent = (body: string) => {
    const blocks = body.split(/\n\s*\n/);
    
    return blocks.map((block, bIdx) => {
      const lines = block.split('\n');
      const isChorus = lines[0].toLowerCase().trim().startsWith('chorus') || 
                       lines[0].toLowerCase().trim().startsWith('[chorus]');

      return (
        <div key={bIdx} className="mb-8">
          {lines.map((line, lIdx) => {
            const { chordLine, lyricLine } = processLine(line, isChorus);
            const hasChords = chordLine.trim().length > 0;

            return (
              <div key={lIdx} className="mb-2 last:mb-0">
                {settings.showChords && hasChords && (
                  <div className="chord whitespace-pre min-h-[1.2em]">{chordLine}</div>
                )}
                <div className="lyrics whitespace-pre font-mono">{lyricLine}</div>
              </div>
            );
          })}
        </div>
      );
    });
  };

  const handleZoom = (delta: number) => {
    const newSize = Math.max(12, Math.min(48, settings.fontSize + delta));
    onUpdateSettings({ fontSize: newSize });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fadeIn relative pb-24">
      {/* Meta Bar */}
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
        <div className="flex gap-4">
          {song.key && (
            <div className="flex items-center space-x-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100">
              <i className="fa-solid fa-music"></i>
              <span>Key: {song.key}</span>
            </div>
          )}
          {song.tempo && (
            <div className="flex items-center space-x-1.5 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg border border-orange-100">
              <i className="fa-solid fa-gauge-high"></i>
              <span>BPM: {song.tempo}</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">
          <i className="fa-solid fa-language"></i>
          <span>{song.language}</span>
        </div>
      </div>

      {/* Controls Bar */}
      {!song.isPdf && (
        <div className="sticky top-20 z-20 mb-8 flex flex-wrap gap-2 justify-center">
          <div className="bg-white/80 backdrop-blur-md border border-gray-200 p-1.5 rounded-full shadow-lg flex items-center space-x-1">
            <span className="text-[10px] font-bold text-gray-400 px-2 uppercase tracking-tight">Transpose</span>
            <button 
              onClick={() => setTranspose(prev => prev - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <i className="fa-solid fa-minus text-xs"></i>
            </button>
            <span className="w-8 text-center font-mono font-bold text-blue-600 text-sm">
              {transpose > 0 ? `+${transpose}` : transpose}
            </span>
            <button 
              onClick={() => setTranspose(prev => prev + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <i className="fa-solid fa-plus text-xs"></i>
            </button>
            <button 
              onClick={() => setTranspose(0)}
              className="text-[10px] font-bold text-blue-500 px-2 hover:underline"
            >
              Reset
            </button>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-gray-200 p-1.5 rounded-full shadow-lg flex items-center space-x-1">
            <span className="text-[10px] font-bold text-gray-400 px-2 uppercase tracking-tight">Zoom</span>
            <button 
              onClick={() => handleZoom(-2)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <i className="fa-solid fa-magnifying-glass-minus text-xs"></i>
            </button>
            <span className="w-8 text-center font-mono font-bold text-gray-700 text-sm">
              {settings.fontSize}
            </span>
            <button 
              onClick={() => handleZoom(2)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <i className="fa-solid fa-magnifying-glass-plus text-xs"></i>
            </button>
          </div>
        </div>
      )}

      <header className="mb-4 pb-2">
        <p 
          className="text-gray-500 italic font-medium leading-none"
          style={{ fontSize: `${settings.fontSize * 0.66}px` }}
        >
          By {song.author || 'Unknown'}
        </p>
      </header>
      
      <div 
        className={`bg-white rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 overflow-hidden ${song.isPdf ? 'p-0' : 'p-6 md:p-12 overflow-x-auto'}`}
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
