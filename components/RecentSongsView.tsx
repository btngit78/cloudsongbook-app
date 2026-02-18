import React, { useState, useEffect } from 'react';
import { Song, UserRole } from '../types';
import { dbService } from '../services/dbService';

interface RecentSongsViewProps {
  songs: Song[];
  onSelectSong: (id: string) => void;
  onEditSong: (song: Song) => void;
  onDeleteSong: (song: Song) => void;
  onBack: () => void;
}

const RecentSongsView: React.FC<RecentSongsViewProps> = ({
  songs,
  onSelectSong,
  onEditSong,
  onDeleteSong,
  onBack,
}) => {
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});

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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recently Added (Last 50)</h2>
        <button 
          onClick={onBack}
          className="px-4 py-2 text-gray-800 dark:text-gray-200 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Back
        </button>
      </div>
      <div className="grid gap-4">
        {songs.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 transition-colors">
            <p className="text-gray-500 dark:text-gray-400 font-medium">No songs found.</p>
          </div>
        ) : (
          songs.map(s => (
            <div 
              key={s.id} 
              className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center hover:shadow-md transition-shadow group"
            >
              <div 
                className="text-left flex-1 cursor-pointer min-w-0 mr-4"
                onClick={() => onSelectSong(s.id)}
              >
                <p className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{s.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.authors} - Created: {new Date(s.createdAt).toLocaleDateString()} - {s.body.length} chars - key: {s.key} - tempo: {s.tempo > 0 ? s.tempo : 'N/A'} - Owner: {(!s.ownerId || s.ownerId === 'Unknown') ? 'Unknown' : ownerNames[s.ownerId] || 'Loading...'}</p>
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
                  onClick={(e) => { e.stopPropagation(); onDeleteSong(s); }}
                  className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                  title="Delete Song"
                >
                  <i className="fa-solid fa-trash"></i>
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
          ))
        )}
      </div>
    </div>
  );
};

export default RecentSongsView;