import React, { useState, useEffect } from 'react';
import { Song, SetList, SongChoice } from '../types';

interface AddToSetlistModalProps {
  song: Song;
  availableSetlists: SetList[];
  onClose: () => void;
  onConfirm: (setlistId: string | null, newName: string | null, songChoice: SongChoice) => void;
}

const AddToSetlistModal: React.FC<AddToSetlistModalProps> = ({
  song,
  availableSetlists,
  onClose,
  onConfirm
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>(availableSetlists.length > 0 ? 'existing' : 'new');
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>(availableSetlists[0]?.id || '');
  const [newSetlistName, setNewSetlistName] = useState('');
  
  // Song Choice Fields
  const [choiceKey, setChoiceKey] = useState(song.key || '');
  const [choiceTempo, setChoiceTempo] = useState<number | undefined>(song.tempo);
  const [choiceStyle, setChoiceStyle] = useState('');
  const [choiceSinger, setChoiceSinger] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'new' && !newSetlistName.trim()) {
      alert('Please enter a name for the new setlist.');
      return;
    }

    if (mode === 'new' && availableSetlists.some(s => s.name.trim().toLowerCase() === newSetlistName.trim().toLowerCase())) {
      alert(`A setlist named "${newSetlistName.trim()}" already exists. Please choose a unique name.`);
      return;
    }

    if (mode === 'existing' && !selectedSetlistId) {
      alert('Please select a setlist.');
      return;
    }

    const choice: SongChoice = {
      songId: song.id,
      key: choiceKey,
      tempo: choiceTempo,
      style: choiceStyle,
      singer: choiceSinger
    };

    onConfirm(
      mode === 'existing' ? selectedSetlistId : null,
      mode === 'new' ? newSetlistName : null,
      choice
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add to Setlist</h3>
          <button title="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Setlist Selection */}
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
            {availableSetlists.length > 0 && (
              <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                  type="radio" 
                  checked={mode === 'existing'} 
                  onChange={() => setMode('existing')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Existing Setlist</span>
              </label>
            )}
            
            {mode === 'existing' && availableSetlists.length > 0 && (
              <select title="Select Setlist"
                value={selectedSetlistId}
                onChange={(e) => setSelectedSetlistId(e.target.value)}
                className="w-full mt-2 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2.5"
              >
                {availableSetlists.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}

            <label className="flex items-center space-x-3 cursor-pointer mt-2">
              <input 
                type="radio" 
                checked={mode === 'new'} 
                onChange={() => setMode('new')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Create New Setlist</span>
            </label>

            {mode === 'new' && (
              <input 
                type="text"
                placeholder="Setlist Name (e.g. Sunday Service)"
                value={newSetlistName}
                onChange={(e) => setNewSetlistName(e.target.value)}
                className="w-full mt-2 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2.5"
                autoFocus
              />
            )}
          </div>

          {/* Song Details Overrides */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Key</label>
              <input type="text" value={choiceKey} onChange={e => setChoiceKey(e.target.value)} className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2" placeholder={song.key} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Tempo</label>
              <input type="number" value={choiceTempo || ''} onChange={e => setChoiceTempo(e.target.value ? parseInt(e.target.value) : undefined)} className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2" placeholder={song.tempo?.toString()} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Singer</label>
              <input type="text" value={choiceSinger} onChange={e => setChoiceSinger(e.target.value)} className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Style</label>
              <input type="text" value={choiceStyle} onChange={e => setChoiceStyle(e.target.value)} className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2" placeholder="Optional" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all">Add to Setlist</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddToSetlistModal;