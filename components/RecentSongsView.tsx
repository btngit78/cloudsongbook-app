import React, { useState, useEffect, useMemo } from 'react';
import { Song, UserRole } from '../types';
import { dbService } from '../services/dbService';

interface RecentSongsViewProps {
  songs: Song[];
  onSelectSong: (id: string) => void;
  onEditSong: (song: Song) => void;
  onArchiveSong: (song: Song) => void;
  onBack: () => void;
  onArchiveSongs: (songs: Song[]) => void;
  onEditSongs: (songs: Song[]) => void;
}

const RecentSongsView: React.FC<RecentSongsViewProps> = ({
  songs,
  onSelectSong,
  onEditSong,
  onArchiveSong,
  onBack,
  onArchiveSongs,
  onEditSongs,
}) => {
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchOwners = async () => {
      const uniqueOwnerIds = Array.from(new Set(songs.map(s => s.ownerId).filter(id => id && id !== 'Unknown')));
      const names: Record<string, string> = {};
      
      await Promise.all(uniqueOwnerIds.map(async (id) => {
        const user = await dbService.getUser(id!);
        if (user) {
          names[id!] = user.role === UserRole.ADMIN ? 'Admin' : user.name;
        } else {
          names[id!] = 'Unknown';
        }
      }));
      setOwnerNames(names);
    };
    if (songs.length > 0) fetchOwners();
  }, [songs]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === songs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(songs.map(s => s.id)));
    }
  };

  const selectedSongs = useMemo(() => songs.filter(s => selectedIds.has(s.id)), [songs, selectedIds]);

  return (
    <div className="max-w-4xl mx-auto p-6 pb-24">
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recently Added</h2>
          <button 
            onClick={handleSelectAll}
            className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {selectedIds.size === songs.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="flex items-center gap-2">
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
            <p className="text-gray-500 dark:text-gray-400 font-medium">No songs found.</p>
          </div>
        ) : (
          songs.map(s => {
            const ownerName = (!s.ownerId || s.ownerId === 'Unknown') ? 'Unknown' : ownerNames[s.ownerId] || 'Loading...';
            const displayOwner = ownerName !== 'Admin' && ownerName !== 'Loading...';

            return (
              <div 
                key={s.id} 
                className={`bg-white dark:bg-gray-800 p-4 rounded-xl border flex justify-between items-center hover:shadow-md transition-all group ${selectedIds.has(s.id) ? 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className="mr-4 flex-shrink-0">
                  <input title="Select Song"
                    type="checkbox" 
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 cursor-pointer"
                    checked={selectedIds.has(s.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(s.id);
                    }}
                  />
                </div>
                <div 
                  className="text-left flex-1 cursor-pointer min-w-0 mr-4"
                  onClick={() => toggleSelect(s.id)}
                >
                  <p className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{s.title}</p>
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2 overflow-hidden">
                    <span className="truncate">{s.authors}</span>
                    <span className="flex-shrink-0 text-gray-300 dark:text-gray-600">&middot;</span>
                    <span className="flex-shrink-0">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                    {s.key && (
                      <>
                        <span className="flex-shrink-0 text-gray-300 dark:text-gray-600">&middot;</span>
                        <span className="flex-shrink-0">Key: {s.key}</span>
                      </>
                    )}
                    {displayOwner && (
                      <>
                        <span className="flex-shrink-0 text-gray-300 dark:text-gray-600">&middot;</span>
                        <span className="flex-shrink-0">Owner: {ownerName}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditSong(s); }}
                  className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                  title="Edit Song"
                >
                  <i className="fa-solid fa-pen"></i>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Confirmation is handled by the parent function
                    onArchiveSong(s);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                  title="Archive Song"
                >
                  <i className="fa-solid fa-archive"></i>
                </button>
                <button
                  title="Select Song"
                  onClick={() => onSelectSong(s.id)}
                  className="p-2 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
              </div>
            );
          })
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-slideInUp">
          <div className="px-3 border-r border-gray-200 dark:border-gray-700">
            <span className="text-sm font-bold text-gray-900 dark:text-white">{selectedIds.size} Selected</span>
          </div>
          <button 
            onClick={() => onEditSongs(selectedSongs)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-pen-to-square"></i> Edit
          </button>
          <button 
            onClick={() => onArchiveSongs(selectedSongs)}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-archive"></i> Archive
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentSongsView;