import React, { useMemo } from 'react';
import { Song } from '../types';
import { useSearchRegex } from '../hooks/useSongSearch';

// Extend the Song type to include properties added during deep search
// This is a local extension for the SongList component's understanding of the data
type DisplaySong = Song & { 
  isSetlistInstance?: boolean; 
  setlistName?: string;
  singer?: string;
  style?: string;
  songTitle?: string;
  setlistIndex?: number;
};

interface SongListProps {
  songs: Song[];
  onSongClick: (song: Song) => void;
  emptyMessage?: string;
  searchQuery?: string;
  selectedIndex?: number;
  highlightSearch?: boolean;
  isDeepSearchThrottled?: boolean;
}

export const SongList: React.FC<SongListProps> = ({
  songs,
  onSongClick,
  emptyMessage = "No songs found matching your search.",
  searchQuery = "",
  selectedIndex = -1,
  highlightSearch = false,
  isDeepSearchThrottled = false
}) => { // Cast songs to DisplaySong[] to access extended properties
  if (!songs || songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-gray-500 dark:text-gray-400 animate-in fade-in duration-300">
        <svg
          className="w-16 h-16 mb-4 opacity-20"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-lg font-medium">{emptyMessage}</p>
        <p className="text-sm mt-2 opacity-75">Try adjusting your search terms.</p>
      </div>
    );
  }

  const textSearchQuery = useMemo(() => 
    (searchQuery.match(/(?:"[^"]*"|[^\s]+)/g) || [])
      .filter(t => !t.startsWith('#') && !t.startsWith('s:') && !t.startsWith('y:') && t !== '!!')
      .map(t => t.startsWith('"') ? t.slice(1, -1) : t)
      .join(' ')
  , [searchQuery]);

  const highlightRegex = useSearchRegex(textSearchQuery);

  const highlightMatch = (text: string) => {
    // Only highlight if there's a text query, not just keywords
    if (!highlightSearch || !highlightRegex || !text || !textSearchQuery) {
      return text;
    }

    const parts = text.split(highlightRegex);

    return (
      <>
        {parts.map((part, index) =>
          // With a capturing group in split, the matches appear at odd indices.
          index % 2 === 1 ? (
            <span key={index} className="bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100 font-medium rounded-sm">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <>
      {isDeepSearchThrottled && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
          <i className="fa-solid fa-circle-info text-amber-500 mt-0.5 shrink-0"></i>
          <p>
            <span className="font-bold">Too many results for deep search.</span> Please specify greater detail to narrow down the results for setlist search.
          </p>
        </div>
      )}
    <ul 
      ref={listRef}
      className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900"
      onMouseDown={(e) => {
        // Prevent click from bubbling to document, which would trigger the "click outside" handler in Header
        // and close the search results before the click event can fire.
        e.nativeEvent.stopImmediatePropagation();
      }}
    >
      {songs.map((song, index) => (
        <li key={song.id}> {/* song.id is already unique for setlist instances from App.tsx */}
          <button
            onClick={() => onSongClick(song)} // song is still of type Song here, but it has the extra properties
            title={(song as DisplaySong).isSetlistInstance 
              ? `Song: ${(song as DisplaySong).songTitle}\nSetlist: ${song.title} (Position: #${((song as DisplaySong).setlistIndex ?? 0) + 1})` 
              : undefined
            }
            className={`w-full text-left py-3 transition-colors duration-150 flex items-center justify-between group focus:outline-none ${
              (song as DisplaySong).isSetlistInstance ? 'pl-10 pr-4' : 'px-4'
            } ${
              index === selectedIndex 
                ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-inset ring-blue-500 z-10' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <div className="min-w-0 flex-1 pr-4">
              <h3 className={`text-base font-semibold truncate transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 ${index === selectedIndex ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                {(song as DisplaySong).isSetlistInstance ? (
                  <>
                    <span className="text-gray-500 dark:text-gray-400 font-normal">↳ in: </span>
                    <span className={index === selectedIndex ? '' : 'text-indigo-600 dark:text-indigo-400'}>
                      {highlightMatch(song.title)}
                    </span>
                  </>
                ) : (
                  highlightMatch(song.title)
                )}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {highlightMatch(song.authors)}
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-gray-400 shrink-0">
              {/* Setlist Instance Metadata (Singer & Style) */}
              {(song as DisplaySong).isSetlistInstance && (song as DisplaySong).singer && (
                <span className="inline-block text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                  <i className="fa-solid fa-microphone mr-1"></i>
                  {(song as DisplaySong).singer}
                </span>
              )}
              {(song as DisplaySong).isSetlistInstance && (song as DisplaySong).style && (
                <span className="inline-block text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                  {(song as DisplaySong).style}
                </span>
              )}

              {/* Shared Metadata (Tempo & Key) */}
              {(song.tempo !== undefined && song.tempo !== null && song.tempo > 0) && (
                <span className="inline-block text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded px-2 py-0.5">
                  {song.tempo}
                </span>
              )}
              {song.key?.trim() && (
                <span className="inline-block text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded px-2 py-0.5">
                  {song.key}
                </span>
              )}

               <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-400 dark:text-gray-600 dark:group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
               </svg>
            </div>
          </button>
        </li>
      ))}
    </ul>
    </>
  );
};