import React, { useMemo } from 'react';
import { Document, Page } from 'react-pdf';
import { Song, UserSettings } from '../types';
import { getShouldUseFlats, transposeChord } from '../utils/musicUtils';

interface LyricsRendererProps {
  song: Song;
  settings: UserSettings;
  transpose: number;
}

export const LyricsRenderer: React.FC<LyricsRendererProps> = ({ song, settings, transpose }) => {
  // Determine if we should use flats for the target key based on user preference rules
  const useFlats = useMemo(() => {
    return getShouldUseFlats(song.key, transpose);
  }, [song.key, transpose]);

  const chordClass = (settings.chordColor === '' || settings.chordColor === 'amber') 
    ? 'text-blue-600 dark:text-amber-400'   // default chord color for both themes
    : 'text-blue-600 dark:text-blue-400';   // alternative chord color for dark theme
    
  const sectionClass = (settings.sectionColor === '' || settings.sectionColor === 'purple')
    ? 'text-gray-800 dark:text-indigo-500'  // default section color for both themes
    : 'text-gray-800 dark:text-teal-400';   // alternative section color for dark theme


  const processLine = (line: string, isChorus: boolean) => {
    if (!settings.showChords) {
      const lyricLine = line.trim().replace(/\[.*?\]/g, '');
      const indent = isChorus ? '    ' : '';
      return {
        chordLine: '',
        lyricLine: indent + lyricLine
      };
    }

    const parts = line.trim().split(/(\[.*?\])/g).filter(p => p !== '');
    let chordLine = '';
    let lyricLine = '';

    parts.forEach(part => {
      if (part.startsWith('[') && part.endsWith(']')) {
        const chordRaw = part.slice(1, -1);
        const chord = transposeChord(chordRaw, transpose, useFlats);
        
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

    const indent = isChorus ? '    ' : '';

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
    const blocks = body.split(/\n\s*\n\s*/);
    let chorusCount = 0;
    let isGlobalChorus = false;
    
    return blocks.map((block, bIdx) => {
      const lines = block.split('\n');
      const firstLineTrimmed = lines[0].toLowerCase().trim();
      const isSocMarker = firstLineTrimmed.startsWith('{soc}');
      const isChorusKeyword = firstLineTrimmed.startsWith('chorus');
      
      // Only {soc} sets the global state that persists across blocks
      if (isSocMarker) {
        isGlobalChorus = true;
      }

      // A block is part of a chorus if we're in a global {soc} section,
      // OR if the block itself starts with "Chorus:"
      let inChorusSection = isGlobalChorus || isChorusKeyword;
      let mbClass = 'mb-2';
      
      const startsWithChorusLabel = isSocMarker || isChorusKeyword;
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
              isGlobalChorus = false;
              return null;
            }
           
            if (lIdx === 0) {
              if (startsWithChorusLabel)        // Chorus label (e.g. "Chorus:", "{soc}") needs indentation
                return <div key={lIdx} className={`font-bold ${sectionClass} mb-1 whitespace-pre`}>    Chorus:</div>;
              else if (trimmed.endsWith(':'))   // Section header (e.g. "Verse 1:", "Bridge:", "Coda:")
                return <div key={lIdx} className={`font-bold ${sectionClass} mb-1 whitespace-pre`}>{line.trim()}</div>;
            }

            const { chordLine, lyricLine } = processLine(line, inChorusSection);
            const hasChords = chordLine.trim().length > 0;

            return (
              <div key={lIdx} className="mb-0.5 last:mb-6 print-avoid-break">
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
      className={`song-renderer-root bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-300 overflow-hidden ${song.isPdf ? 'p-0 pdf-viewer-container' : 'p-2 md:p-4 overflow-x-auto'}`}
      style={!song.isPdf ? { fontSize: `${settings.fontSize}px` } : {}}
    >
      {song.isPdf && song.pdfUrl ? (
        <div className="w-full h-[80vh] overflow-y-auto bg-gray-100 dark:bg-gray-900 rounded-3xl flex justify-center">
          <Document
            file={song.pdfUrl}
            onLoadSuccess={({ numPages }: { numPages: number }) => (window as any).setNumPages(numPages)}
            onLoadError={(error: Error) => (window as any).setPdfError(error.message)}
            loading={
              <div className="flex items-center justify-center h-full">
                <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-500"></i>
                <span className="ml-3 text-gray-500">Loading PDF...</span>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <p className="font-bold text-red-500">Error</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{(window as any).pdfError || 'Failed to load PDF.'}</p>
                <a 
                  href={song.pdfUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm"
                >
                  Open PDF Directly
                </a>
              </div>
            }
            className="flex flex-col items-center"
          >
            {Array.from(new Array((window as any).numPages || 0), (el, index) => (
              <Page key={`page_${index + 1}`} pageNumber={index + 1} width={Math.min((window as any).containerWidth || 800, 800)} className="my-2 shadow-lg" renderAnnotationLayer={false} renderTextLayer={false} />
            ))}
          </Document>
        </div>
      ) : (
        <div className="leading-tight select-text font-mono text-gray-900 dark:text-gray-100">
          {renderContent(song.body)}
        </div>
      )}
    </div>
  );
};