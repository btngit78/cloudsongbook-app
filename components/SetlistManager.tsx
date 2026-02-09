import React, { useState } from 'react';
import { Song } from '../types';
import { SetList } from '../types';

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
  const [editName, setEditName] = useState('');
  const [editSongIds, setEditSongIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const startEdit = (setlist?: SetList) => {
    if (setlist) {
      setEditingId(setlist.id);
      setEditName(setlist.name);
      setEditSongIds([...setlist.songIds]);
    } else {
      setEditingId('new');
      setEditName('');
      setEditSongIds([]);
    }
    setSearchQuery('');
  };

  const handleSave = () => {
    if (!editName.trim()) return;
    
    const newSetlist: SetList = {
      id: editingId === 'new' ? Date.now().toString() : editingId!,
      name: editName,
      songIds: editSongIds,
      createdAt: editingId === 'new' ? Date.now() : (setlists.find(s => s.id === editingId)?.createdAt || Date.now()),
      updatedAt: Date.now(),
      ownerId: ''
    };

    onSave(newSetlist);
    setEditingId(null);
  };

  const toggleSong = (songId: string) => {
    if (editSongIds.includes(songId)) {
      setEditSongIds(editSongIds.filter(id => id !== songId));
    } else {
      setEditSongIds([...editSongIds, songId]);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newIds = [...editSongIds];
    const [draggedItem] = newIds.splice(draggedIndex, 1);
    newIds.splice(dropIndex, 0, draggedItem);
    
    setEditSongIds(newIds);
    setDraggedIndex(null);
  };

  const handleDuplicate = (setlistToCopy: SetList) => {
    const newSetlist: SetList = {
      id: Date.now().toString(),
      name: `${setlistToCopy.name} (Copy)`,
      songIds: [...setlistToCopy.songIds],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ownerId: setlistToCopy.ownerId
    };
    onSave(newSetlist);
  };

  const getSongTitle = (id: string) => allSongs.find(s => s.id === id)?.title || 'Unknown Song';

  const sortedSetlists = [...setlists].sort((a, b) => a.name.localeCompare(b.name));

  if (editingId) {
    const availableSongs = allSongs.filter(s => 
      !editSongIds.includes(s.id) && 
      (s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.author.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 bg-white rounded-3xl shadow-xl mt-4 mb-12">
        <div className="flex items-center justify-between mb-6 border-b pb-4">
          <h2 className="text-2xl font-bold text-gray-900">{editingId === 'new' ? 'New Setlist' : 'Edit Setlist'}</h2>
          <div className="flex space-x-2">
            <button onClick={() => setEditingId(null)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg">Save</button>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Setlist Name</label>
            <input 
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full rounded-xl border-gray-200 shadow-sm border p-3 focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Sunday Morning Service"
              autoFocus
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Selected Songs */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
              <h3 className="font-bold text-gray-700 mb-3 flex justify-between">
                <span>Selected Songs</span>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{editSongIds.length}</span>
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {editSongIds.length === 0 && <p className="text-sm text-gray-400 italic">No songs selected.</p>}
                {editSongIds.map((id, idx) => (
                  <div 
                    key={id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={`flex items-center justify-between bg-white p-2 rounded-lg shadow-sm border border-gray-100 cursor-move transition-opacity ${draggedIndex === idx ? 'opacity-50 border-blue-300' : ''}`}
                  >
                    <span className="text-sm font-medium truncate flex-1 mr-2 flex items-center">
                      <i className="fa-solid fa-grip-lines text-gray-300 mr-3 cursor-grab"></i>
                      {idx + 1}. {getSongTitle(id)}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button onClick={() => toggleSong(id)} className="p-1 text-red-400 hover:text-red-600"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Available Songs */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200">
              <h3 className="font-bold text-gray-700 mb-3">Add Songs</h3>
              <input 
                type="text" 
                placeholder="Search library..." 
                className="w-full mb-3 px-3 py-2 rounded-lg bg-gray-100 border-none text-sm focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {availableSongs.slice(0, 20).map(song => (
                  <button 
                    key={song.id}
                    onClick={() => toggleSong(song.id)}
                    className="w-full text-left flex items-center justify-between p-2 hover:bg-blue-50 rounded-lg group transition-colors"
                  >
                    <div className="truncate">
                      <p className="text-sm font-bold text-gray-800 truncate">{song.title}</p>
                      <p className="text-xs text-gray-500 truncate">{song.author}</p>
                    </div>
                    <i className="fa-solid fa-plus text-gray-300 group-hover:text-blue-600"></i>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">My Setlists</h2>
        <div className="flex space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Back</button>
          <button onClick={() => startEdit()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg flex items-center space-x-2">
            <i className="fa-solid fa-plus"></i>
            <span>Create New</span>
          </button>
        </div>
      </div>

      <div className={sortedSetlists.length > 10 ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col gap-4"}>
        {setlists.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-300">
            <i className="fa-solid fa-list-ul text-4xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 font-medium">No setlists created yet.</p>
          </div>
        )}
        {sortedSetlists.map(setlist => (
          <div key={setlist.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
            {/* Play Button */}
            <button 
              onClick={() => onPlay(setlist)}
              className="w-12 h-12 flex-shrink-0 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors shadow-sm"
              title="Perform Set"
            >
              <i className="fa-solid fa-play ml-1 text-lg"></i>
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate text-lg">{setlist.name}</h3>
              <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="font-medium bg-gray-100 px-2 py-0.5 rounded-md">{setlist.songIds.length} songs</span>
                <span>Created: {new Date(setlist.createdAt).toLocaleDateString()}</span>
                <span>Last used: {new Date(setlist.updatedAt || setlist.createdAt).toLocaleDateString()}</span>
                <span className="text-gray-400">|</span>
                <span className="text-blue-600 font-medium" title="Lifespan (Last used - Created)">{getFriendlyDuration(setlist.createdAt, setlist.updatedAt || setlist.createdAt)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button onClick={() => handleDuplicate(setlist)} title="Duplicate Setlist" className="p-2 text-gray-400 hover:text-green-600 rounded-full hover:bg-green-50">
                <i className="fa-solid fa-copy"></i>
              </button>
              <button onClick={() => startEdit(setlist)} title="Edit Setlist" className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50">
                <i className="fa-solid fa-pen"></i>
              </button>
              <button onClick={() => { if(window.confirm('Delete this setlist?')) onDelete(setlist.id); }} title="Delete Setlist" className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50">
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