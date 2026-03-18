import React, { useState, useCallback, useRef } from 'react';
import { SetList, Song, SongChoice } from '../types';
import { SetlistSongRow } from './SetlistSongRow';

interface DualSetlistEditorProps {
  initialListA: SetList;
  initialListB: SetList;
  allSongs: Song[];
  onSave: (listA: SetList, listB: SetList) => void;
  onCancel: () => void;
}

const DualSetlistEditor: React.FC<DualSetlistEditorProps> = ({ initialListA, initialListB, allSongs, onSave, onCancel }) => {
  const [listA, setListA] = useState<SetList>(initialListA);
  const [listB, setListB] = useState<SetList>(initialListB);
  const [draggedItem, setDraggedItem] = useState<{ from: 'A' | 'B', index: number, choice: SongChoice } | null>(null);

  const getSong = (id: string) => allSongs.find(s => s.id === id);

  const handleUpdateChoice = useCallback((listId: 'A' | 'B', index: number, field: keyof SongChoice, value: any) => {
    const setListFn = listId === 'A' ? setListA : setListB;
    setListFn(currentList => {
        const newChoices = [...currentList.choices];
        newChoices[index] = { ...newChoices[index], [field]: value };
        return { ...currentList, choices: newChoices };
    });
  }, []);

  const handleRemove = (listId: 'A' | 'B', index: number) => {
    const setListFn = listId === 'A' ? setListA : setListB;
    setListFn(currentList => {
        const newChoices = [...currentList.choices];
        newChoices.splice(index, 1);
        return { ...currentList, choices: newChoices };
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number, from: 'A' | 'B') => {
    const choice = (from === 'A' ? listA : listB).choices[index];
    setDraggedItem({ from, index, choice });
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number, overListId: 'A' | 'B') => {
    e.preventDefault();
    if (!draggedItem || (draggedItem.from === overListId && draggedItem.index === index)) {
      return;
    }

    const { from: fromListId, choice } = draggedItem;

    let newChoicesA = [...listA.choices];
    let newChoicesB = [...listB.choices];

    // Remove from source
    if (fromListId === 'A') {
      newChoicesA.splice(draggedItem.index, 1);
    } else {
      newChoicesB.splice(draggedItem.index, 1);
    }

    // Add to destination
    if (overListId === 'A') {
      newChoicesA.splice(index, 0, choice);
    } else {
      newChoicesB.splice(index, 0, choice);
    }

    setListA({ ...listA, choices: newChoicesA });
    setListB({ ...listB, choices: newChoicesB });

    setDraggedItem({ from: overListId, index, choice });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedItem(null);
  };

  const renderList = (list: SetList, identifier: 'A' | 'B') => (
    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
      <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex justify-between items-center">
        <span className="truncate">{list.name}</span>
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">{list.choices.length} songs</span>
      </h3>
      <div 
        className="space-y-2 min-h-[400px] max-h-[600px] overflow-y-auto pr-1"
        onDragOver={(e) => { if (list.choices.length === 0) handleDragOver(e, 0, identifier); }}
        onDrop={handleDrop}
      >
        {list.choices.map((choice, idx) => (
          <SetlistSongRow
            key={`${choice.songId}-${idx}`}
            ref={null}
            index={idx}
            choice={choice}
            song={getSong(choice.songId)}
            draggedIndex={draggedItem?.from === identifier ? draggedItem.index : null}
            isMetronomeActive={false}
            beatFlash={false}
            onUpdate={(...args) => handleUpdateChoice(identifier, ...args)}
            onRemove={() => handleRemove(identifier, idx)}
            onToggleMetronome={() => {}}
            onTapTempo={() => {}}
            onDragStart={(e) => handleDragStart(e, idx, identifier)}
            onDragOver={(e) => handleDragOver(e, idx, identifier)}
            onDrop={handleDrop}
            onKeyDown={() => {}}
          />
        ))}
        {list.choices.length === 0 && (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500 italic border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl h-full flex items-center justify-center">
                Drag songs here
            </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-xl mt-4 mb-12 transition-colors">
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Compare & Edit Setlists</h2>
        <div className="flex space-x-2">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => onSave(listA, listB)} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all">
            Save Changes
          </button>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {renderList(listA, 'A')}
        {renderList(listB, 'B')}
      </div>
    </div>
  );
};

export default DualSetlistEditor;