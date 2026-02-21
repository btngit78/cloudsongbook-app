import React from 'react';
import { Song } from '../types';

interface SongListProps {
  songs: Song[];
  onSongClick: (song: Song) => void;
  emptyMessage?: string;
}

export const SongList: React.FC<SongListProps> = ({
  songs,
  onSongClick,
  emptyMessage = "No songs found matching your search."
}) => {
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

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
      {songs.map((song) => (
        <li key={song.id}>
          <button
            onClick={() => onSongClick(song)}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150 flex items-center justify-between group focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-800/50"
          >
            <div className="min-w-0 flex-1 pr-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {song.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {song.authors}
              </p>
            </div>
            
            <div className="flex items-center text-gray-400 shrink-0">
               {song.key && (
                 <span className="hidden sm:inline-block mr-3 text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded px-2 py-0.5">
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
  );
};