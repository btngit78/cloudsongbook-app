import React from 'react';
import { Song, SongChoice } from '../types';

// Extending SongChoice locally for the UI flag if not in global types
type ExtendedSongChoice = SongChoice & { isFuzzyMatch?: boolean };

interface SetlistSongRowProps {
  index: number;
  choice: ExtendedSongChoice;
  song?: Song;
  draggedIndex: number | null;
  isMetronomeActive: boolean;
  beatFlash: boolean;
  onUpdate: (index: number, field: keyof SongChoice, value: string | number | undefined) => void;
  onRemove: (index: number) => void;
  onToggleMetronome: (index: number) => void;
  onTapTempo: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
}

export const SetlistSongRow = React.forwardRef<HTMLDivElement, SetlistSongRowProps>(({
  index,
  choice,
  song,
  draggedIndex,
  isMetronomeActive,
  beatFlash,
  onUpdate,
  onRemove,
  onToggleMetronome,
  onTapTempo,
  onDragStart,
  onDragOver,
  onDrop,
  onKeyDown
}, ref) => {
  return (
    <div 
      ref={ref}
      tabIndex={0}
      onKeyDown={(e) => onKeyDown(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={onDrop}
      className={`song-row bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${draggedIndex === index ? 'opacity-50 ring-2 ring-blue-400' : 'hover:shadow-md'}`}
    >
      <div className="flex items-start gap-3">
        <div 
          className="mt-2 cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 p-1 -m-1" 
          title="Drag to reorder or use Ctrl+Up/Down"
          draggable
          onDragStart={(e) => {
            // Set the drag ghost image to the entire row instead of just the grip icon
            const row = e.currentTarget.closest('.song-row');
            if (row && e.dataTransfer) {
              e.dataTransfer.setDragImage(row, 20, 20);
            }
            onDragStart(e, index);
          }}
        >
          <i className="fa-solid fa-grip-vertical"></i>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-bold text-blue-500 dark:text-blue-400 mr-2">#{index + 1}</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{song?.title || 'Unknown Song'}</span>
              {choice.isFuzzyMatch && (
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUpdate(index, 'isFuzzyMatch' as any, undefined); }}
                  className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse hover:bg-amber-200 dark:hover:bg-amber-800/80 transition-colors cursor-pointer"
                  title="Fuzzy Match: Click to confirm and remove this warning"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-[8px]"></i>
                  <span>FUZZY MATCH</span>
                  <i className="fa-solid fa-check"></i>
                </button>
              )}
            </div>
            <button 
              onClick={() => onRemove(index)}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Remove from set"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Inline Editor Fields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Key</label>
              <input 
                type="text" 
                value={choice.key || ''} 
                onChange={(e) => onUpdate(index, 'key', e.target.value)}
                className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                placeholder={song?.key}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Tempo</label>
              <div className="flex items-center gap-1">
                <input 
                  type="number" 
                  min={0}
                  value={choice.tempo ?? ''} 
                  onChange={(e) => onUpdate(index, 'tempo', e.target.value === '' ? undefined : parseInt(e.target.value))}
                  className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                  placeholder={song?.tempo?.toString()}
                />
                <button
                  onClick={() => onToggleMetronome(index)}
                  className={`p-1.5 rounded transition-colors ${isMetronomeActive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  title="Metronome / Tap Tempo"
                >
                  <i className="fa-solid fa-stopwatch"></i>
                </button>
              </div>
              {isMetronomeActive && (
                <div className="mt-1 flex items-center gap-2 animate-fadeIn">
                  <button
                    onClick={onTapTempo}
                    className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-1 rounded hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    TAP
                  </button>
                  <div className={`w-2 h-2 rounded-full transition-all duration-75 ${beatFlash ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-125' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Singer</label>
              <input 
                type="text" 
                value={choice.singer || ''} 
                onChange={(e) => onUpdate(index, 'singer', e.target.value)}
                className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                placeholder="Lead"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Style</label>
              <input 
                type="text" 
                value={choice.style || ''} 
                onChange={(e) => onUpdate(index, 'style', e.target.value)}
                className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                placeholder="Ballad"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

SetlistSongRow.displayName = 'SetlistSongRow';