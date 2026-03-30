import React from 'react';
import { Song } from '../types';

interface RecentlyViewedSongsViewProps {
  songs: Song[];
  allSongs: Song[];
  onSelectSong: (id: string) => void;
  onBack: () => void;
  onClear: () => void;
}

const RecentlyViewedSongsView: React.FC<RecentlyViewedSongsViewProps> = ({
  songs,
  allSongs,
  onSelectSong,
  onBack,
  onClear,
}) => {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recently Viewed Songs</h2>
        <div className="flex items-center gap-2">
          {songs.length > 0 && (
            <button 
              onClick={onClear}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-2 rounded-lg transition-colors"
            >
              Clear History
            </button>
          )}
          <button 
            onClick={onBack}
            className="px-4 py-2 text-gray-800 dark:text-gray-200 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Back
          </button>
        </div>
      </div>
      <div className="grid gap-4">
        {songs.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 transition-colors">
            <p className="text-gray-500 dark:text-gray-400 font-medium">No recently viewed songs.</p>
            <p className="text-sm text-gray-400 mt-2">View a song to add it to this list.</p>
          </div>
        ) : (
          songs.map(cachedSong => {
            const liveSong = allSongs.find(song => song.id === cachedSong.id);
            const s = liveSong || cachedSong;
            const isArchived = !!s.isArchived;

            return (
              <div 
                key={s.id} 
                className={`bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center transition-all group ${
                  isArchived ? 'bg-gray-50 dark:bg-gray-900/40 opacity-70' : 'hover:shadow-md'
                }`}
              >
                <div className={`text-left flex-1 min-w-0 mr-4 ${isArchived ? 'cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !isArchived && onSelectSong(s.id)}>
                  <p className={`font-bold truncate transition-colors ${isArchived ? 'text-gray-400 dark:text-gray-500 italic' : 'text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                    {s.title} {isArchived && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 ml-1 uppercase">(Archived)</span>}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.authors}</p>
                </div>
                <button title="Select Song" onClick={() => !isArchived && onSelectSong(s.id)} disabled={isArchived} className={`p-2 transition-colors ${isArchived ? 'text-gray-300 dark:text-gray-700' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`}>
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecentlyViewedSongsView;