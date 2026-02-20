import React, { useState, useEffect } from 'react';
import { Song, SetList, SongChoice } from '../types';

interface SetlistEditorProps {
  initialSetlist?: SetList;
  allSongs: Song[];
  onSave: (name: string, choices: SongChoice[]) => void;
  onCancel: () => void;
}

const SetlistEditor: React.FC<SetlistEditorProps> = ({ 
  initialSetlist, allSongs, onSave, onCancel 
}) => {
  const [name, setName] = useState(initialSetlist?.name || '');
  const [choices, setChoices] = useState<SongChoice[]>(initialSetlist?.choices || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Filter available songs
  const availableSongs = allSongs.filter(s => 
    (s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.authors.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddSong = (song: Song) => {
    const newChoice: SongChoice = {
      songId: song.id,
      key: song.key,
      tempo: song.tempo,
      style: '',
      singer: ''
    };
    setChoices([...choices, newChoice]);
    setSearchQuery(''); // Clear search after adding
  };

  const handleRemoveSong = (index: number) => {
    const newChoices = [...choices];
    newChoices.splice(index, 1);
    setChoices(newChoices);
  };

  const handleUpdateChoice = (index: number, field: keyof SongChoice, value: string | number) => {
    const newChoices = [...choices];
    newChoices[index] = { ...newChoices[index], [field]: value };
    setChoices(newChoices);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      // Optional: set drag image
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder immediately on hover (standard sortable list behavior)
    const newChoices = [...choices];
    const [draggedItem] = newChoices.splice(draggedIndex, 1);
    newChoices.splice(index, 0, draggedItem);
    
    setChoices(newChoices);
    setDraggedIndex(index);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedIndex(null);
  };

  const getSong = (id: string) => allSongs.find(s => s.id === id);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-xl mt-4 mb-12 transition-colors">
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {initialSetlist ? 'Edit Setlist' : 'New Setlist'}
        </h2>
        <div className="flex space-x-2">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(name, choices)} 
            disabled={!name.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Save
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Setlist Name */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Setlist Name</label>
          <input 
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="e.g., Sunday Morning Service"
            autoFocus
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Selected Songs List */}
          <div className="lg:col-span-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex justify-between items-center">
              <span>Set Order</span>
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">{choices.length} songs</span>
            </h3>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {choices.length === 0 && (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 italic border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  Drag songs here or click + from the library
                </div>
              )}
              
              {choices.map((choice, idx) => {
                const song = getSong(choice.songId);
                return (
                  <div 
                    key={`${choice.songId}-${idx}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    className={`bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-all ${draggedIndex === idx ? 'opacity-50 ring-2 ring-blue-400' : 'hover:shadow-md'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-2 cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500">
                        <i className="fa-solid fa-grip-vertical"></i>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-xs font-bold text-blue-500 dark:text-blue-400 mr-2">#{idx + 1}</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100">{song?.title || 'Unknown Song'}</span>
                          </div>
                          <button 
                            onClick={() => handleRemoveSong(idx)}
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
                              onChange={(e) => handleUpdateChoice(idx, 'key', e.target.value)}
                              className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                              placeholder={song?.key}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase">Tempo</label>
                            <input 
                              type="number" 
                              value={choice.tempo || ''} 
                              onChange={(e) => handleUpdateChoice(idx, 'tempo', parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                              placeholder={song?.tempo?.toString()}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase">Singer</label>
                            <input 
                              type="text" 
                              value={choice.singer || ''} 
                              onChange={(e) => handleUpdateChoice(idx, 'singer', e.target.value)}
                              className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                              placeholder="Lead"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase">Style</label>
                            <input 
                              type="text" 
                              value={choice.style || ''} 
                              onChange={(e) => handleUpdateChoice(idx, 'style', e.target.value)}
                              className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                              placeholder="Ballad"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Song Library */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-[600px]">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3">Add Songs</h3>
            <input 
              type="text" 
              placeholder="Search library..." 
              className="w-full mb-3 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 placeholder-gray-500 dark:placeholder-gray-400"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {availableSongs.slice(0, 50).map(song => (
                <button 
                  key={song.id}
                  onClick={() => handleAddSong(song)}
                  className="w-full text-left flex items-center justify-between p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg group transition-colors border border-transparent hover:border-blue-100 dark:hover:border-blue-800"
                >
                  <div className="truncate pr-2">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{song.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{song.authors}</p>
                  </div>
                  <i className="fa-solid fa-plus text-gray-300 dark:text-gray-600 group-hover:text-blue-600 dark:group-hover:text-blue-400"></i>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetlistEditor;