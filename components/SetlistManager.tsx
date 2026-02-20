import React, { useState } from 'react';
import { Song, SetList, SongChoice } from '../types';
import SetlistEditor from './SetlistEditor';

interface SetlistManagerProps {
  setlists: SetList[];
  allSongs: Song[];
  onSave: (setlist: SetList) => void;
  onDelete: (id: string) => void;
  onPlay: (setlist: SetList) => void;
  onClose: () => void;
}

const getFriendlyDuration = (start: number, end: number) => {
  const diff = Math.max(0, end - start);
  if (diff < 1000 * 60) return 'New';
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} yr${years > 1 ? 's' : ''}`;
  if (months > 0) return `${months} mo${months > 1 ? 's' : ''}`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${minutes} min${minutes > 1 ? 's' : ''}`;
};

const SetlistManager: React.FC<SetlistManagerProps> = ({ 
  setlists, allSongs, onSave, onDelete, onPlay, onClose 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (setlist?: SetList) => {
    if (setlist) {
      setEditingId(setlist.id);
    } else {
      setEditingId('new');
    }
  };

  const handleSave = (name: string, choices: SongChoice[]) => {
    const newSetlist: SetList = {
      id: editingId === 'new' ? Date.now().toString() : editingId!,
      name,
      choices,
      createdAt: editingId === 'new' ? Date.now() : (setlists.find(s => s.id === editingId)?.createdAt || Date.now()),
      updatedAt: Date.now(),
      ownerId: ''
    };

    onSave(newSetlist);
    setEditingId(null);
  };

  const handleDuplicate = (setlistToCopy: SetList) => {
    const newSetlist: SetList = {
      id: Date.now().toString(),
      name: `${setlistToCopy.name} (Copy)`,
      choices: [...setlistToCopy.choices],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ownerId: setlistToCopy.ownerId
    };
    onSave(newSetlist);
  };

  const sortedSetlists = [...setlists].sort((a, b) => a.name.localeCompare(b.name));

  if (editingId) {
    const setlistToEdit = setlists.find(s => s.id === editingId);
    return (
      <SetlistEditor
        initialSetlist={setlistToEdit}
        allSongs={allSongs}
        onSave={handleSave}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Setlists</h2>
        <div className="flex space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Back</button>
          <button onClick={() => startEdit()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none flex items-center space-x-2 transition-all">
            <i className="fa-solid fa-plus"></i>
            <span>Create New</span>
          </button>
        </div>
      </div>

      <div className={sortedSetlists.length > 10 ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col gap-4"}>
        {setlists.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 transition-colors">
            <i className="fa-solid fa-list-ul text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No setlists created yet.</p>
          </div>
        )}
        {sortedSetlists.map(setlist => (
          <div key={setlist.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
            {/* Play Button */}
            <button 
              onClick={() => onPlay(setlist)}
              className="w-12 h-12 flex-shrink-0 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-colors shadow-sm"
              title="Perform Set"
            >
              <i className="fa-solid fa-play ml-1 text-lg"></i>
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 dark:text-white truncate text-lg">{setlist.name}</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="font-medium bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">{setlist.choices.length} songs</span>
                <span>Created: {new Date(setlist.createdAt).toLocaleDateString()}</span>
                <span>Last used: {new Date(setlist.updatedAt || setlist.createdAt).toLocaleDateString()}</span>
                <span className="text-gray-400">|</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium" title="Lifespan (Last used - Created)">{getFriendlyDuration(setlist.createdAt, setlist.updatedAt || setlist.createdAt)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button onClick={() => startEdit(setlist)} title="Edit Setlist" className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                <i className="fa-solid fa-pen"></i>
              </button>
              <button onClick={() => handleDuplicate(setlist)} title="Duplicate Setlist" className="p-2 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 rounded-full hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors">
                <i className="fa-solid fa-copy"></i>
              </button>
              <button onClick={() => { if(window.confirm('Delete this setlist?')) onDelete(setlist.id); }} title="Delete Setlist" className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SetlistManager;