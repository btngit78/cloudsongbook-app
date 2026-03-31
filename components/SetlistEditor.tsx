import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Song, SetList, SongChoice, User } from '../types';
import { useFilteredSongs } from '../hooks/useSongSearch';
import { useMetronome } from '../hooks/useMetronome';
import { normalizeText } from '../utils/searchUtils';
import { SetlistSongRow } from './SetlistSongRow';

interface SetlistEditorProps {
  initialSetlist?: SetList;
  allSongs: Song[];
  currentSong?: Song;
  user: User | null;
  onSaveSong: (song: Partial<Song>) => Promise<Song>;
  onDeleteSong: (song: Song) => Promise<void>;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onSave: (name: string, choices: SongChoice[], keepOpen?: boolean) => Promise<void> | void;
  onCancel: () => void;
  batchCount?: number;
  onQuitBatch?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const SetlistEditor: React.FC<SetlistEditorProps> = ({ 
  initialSetlist, allSongs, currentSong, user, onSaveSong, onDeleteSong, isFavorite, onToggleFavorite, onSave, onCancel, onDirtyChange, batchCount, onQuitBatch
}) => {
  const [name, setName] = useState(initialSetlist?.name || '');
  const [choices, setChoices] = useState<SongChoice[]>(initialSetlist?.choices || []);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [sortKeys, setSortKeys] = useState<('language' | 'title')[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [autoAddedSongs, setAutoAddedSongs] = useState<Song[]>([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [initialData, setInitialData] = useState({ name: initialSetlist?.name || '', choices: initialSetlist?.choices || [] });
  const dragCounter = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false); // New state for drag-over visual feedback
  
  // Metronome integration
  const [metronomeIndex, setMetronomeIndex] = useState<number | null>(null);
  const metronome = useMetronome(metronomeIndex !== null ? choices[metronomeIndex]?.tempo : undefined);

  const handleUpdateChoice = useCallback((index: number, field: keyof SongChoice, value: string | number | undefined) => {
    setChoices(currentChoices => {
      const newChoices = [...currentChoices];
      newChoices[index] = { ...newChoices[index], [field]: value } as SongChoice;
      return newChoices;
    });
  }, []); // setChoices is stable

  // Sync tapped tempo back to the choice
  useEffect(() => {
    if (metronomeIndex !== null && metronome.tempo !== undefined && choices[metronomeIndex] && metronome.tempo !== choices[metronomeIndex].tempo) {
      handleUpdateChoice(metronomeIndex, 'tempo', metronome.tempo);
    }
  }, [metronome.tempo, metronomeIndex, choices, handleUpdateChoice]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Restore focus after reordering
  useEffect(() => {
    if (focusedIndex !== null && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
      setFocusedIndex(null);
    }
  }, [choices, focusedIndex]);

  // Sync state when initialSetlist changes (e.g. after save)
  useEffect(() => {
    if (initialSetlist) {
      setName(initialSetlist.name);
      setChoices(initialSetlist.choices);
      setInitialData({
        name: initialSetlist.name,
        choices: initialSetlist.choices
      });
    }
  }, [initialSetlist]);

  // Calculate dirty state
  const isDirty = useMemo(() => {
    const initName = initialSetlist?.name || '';
    const initChoices = initialSetlist?.choices || [];
    
    if (name !== initName) return true;
    if (choices.length !== initChoices.length) return true;
    
    // Simple deep comparison for choices
    return JSON.stringify(choices) !== JSON.stringify(initChoices);
  }, [name, choices, initialSetlist]);

  // Notify parent of dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  // Filter available songs using smart regex
  const availableSongs = useFilteredSongs(allSongs, searchQuery, 'relevance', 'asc');

  const librarySongs = useMemo(() => {
    if (searchQuery.trim().length >= 2) return availableSongs;
    return [...allSongs]
      .filter(s => !s.isArchived)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 50);
  }, [searchQuery, availableSongs, allSongs]);

  const existingSongIds = useMemo(() => new Set(choices.map(c => c.songId)), [choices]);

  const handleSort = (key: 'language' | 'title') => {
    const newSortKeys = [key, ...sortKeys.filter(k => k !== key)].slice(0, 2);
    setSortKeys(newSortKeys);

    const sorted = [...choices].sort((choiceA, choiceB) => {
      const songA = getSong(choiceA.songId);
      const songB = getSong(choiceB.songId);

      if (!songA || !songB) return 0;

      for (const sortKey of newSortKeys) {
        let comparison = 0;
        if (sortKey === 'title') {
          comparison = songA.title.localeCompare(songB.title);
        } else if (sortKey === 'language') {
         comparison = (songA.language || '').localeCompare(songB.language || '');


        }
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
    setChoices(sorted);
  };

  const handleAddSong = useCallback((song: Song) => {
    if (existingSongIds.has(song.id)) {

      // Silently ignore if already present
      return;
    }

    const newChoice: SongChoice = {
      songId: song.id,
      key: song.key,
      tempo: song.tempo,
      style: '',
      singer: ''
    };
    setChoices([...choices, newChoice]);
  }, [choices, existingSongIds]);

  const handleAddCurrentSong = () => {
    if (currentSong) {
      handleAddSong(currentSong);
    }
  };

  const handleAddAll = () => {
    const newChoices = availableSongs
      .filter(song => !existingSongIds.has(song.id))
      .map(song => ({
        songId: song.id,
        key: song.key,
        tempo: song.tempo,
        style: '',
        singer: ''
      }));
    if (newChoices.length > 0) { // Use functional update
      setChoices(prevChoices => [...prevChoices, ...newChoices]);
    }
    setInputValue('');
    setSearchQuery('');
  };

  const handleRemoveSong = (index: number) => {
    const newChoices = [...choices];
    newChoices.splice(index, 1);
    setChoices(newChoices);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to remove all songs from this setlist?')) {
      setChoices([]);
    }
  };

  const toggleMetronomeForRow = (index: number) => {
    if (metronomeIndex === index) {
      metronome.toggle();
    } else {
      setMetronomeIndex(index);
      // The hook will pick up the new tempo via the prop update in the next render
      if (!metronome.active) metronome.toggle();
    }
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

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    // Allow reordering with Ctrl+ArrowUp/Down
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (index > 0) {
          const newChoices = [...choices];
          [newChoices[index], newChoices[index - 1]] = [newChoices[index - 1], newChoices[index]];
          setChoices(newChoices);
          setFocusedIndex(index - 1);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (index < choices.length - 1) {
          const newChoices = [...choices];
          [newChoices[index], newChoices[index + 1]] = [newChoices[index + 1], newChoices[index]];
          setChoices(newChoices);
          setFocusedIndex(index + 1);
        }
      }
    }
  };

  const getSong = (id: string) => allSongs.find(s => s.id === id);

  const handleSave = async (keepOpen: boolean) => {
    const highTempoChoice = choices.find(c => c.tempo && c.tempo > 300);
    if (highTempoChoice) {
      const song = getSong(highTempoChoice.songId);
      if (!window.confirm(`Warning: The song "${song?.title || 'Unknown'}" has a tempo of ${highTempoChoice.tempo} BPM, which is unusually high (> 300).\n\nDo you want to save anyway?`)) {
        return;
      }
    }
    
    setIsSaving(true);
    try {
      await onSave(name, choices, keepOpen);
      if (keepOpen) {
        setInitialData({ name, choices });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const closeExportModal = () => {
    setShowExportModal(false);
  };

  const renderSortButton = (key: 'language' | 'title', label: string) => {
    const index = sortKeys.indexOf(key);
    const isPrimary = index === 0;
    const isSecondary = index === 1;

    let baseStyle = 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600';
    if (isPrimary) {
      baseStyle = 'bg-blue-600 border-blue-700 text-white shadow-inner';
    } else if (isSecondary) {
      baseStyle = 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-inner';
    }

    return (
      <button
        onClick={() => handleSort(key)}
        className={`relative text-xs font-bold px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${baseStyle}`}
        title={isPrimary ? `Primary sort: by ${label}` : isSecondary ? `Secondary sort: by ${label}` : `Sort by ${label}`}
      >
        {label}
        {index > -1 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-800 dark:bg-gray-900 text-white text-[10px] font-bold ring-2 ring-white dark:ring-gray-800">
            {index + 1}
          </span>
        )}
      </button>
    );
  };

  const handleExportAsCsv = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + choices.map(choice => {
        const song = getSong(choice.songId);
        return [
          song?.title,
          song?.authors,
          choice.key,
          choice.tempo,
          choice.singer,
          choice.style
        ].join(",");
      }).join("\n");
  
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'setlist'}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  
    closeExportModal();
  };
  
  const handleExportAsJson = () => {
    const jsonContent = JSON.stringify(choices.map(choice => {
      const song = getSong(choice.songId);
      return {
        title: song?.title,
        authors: song?.authors,
        key: choice.key,
        tempo: choice.tempo,
        singer: choice.singer,
        style: choice.style
      };
    }), null, 2);
  
    const blob = new Blob([jsonContent], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'setlist'}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    closeExportModal();
  };

  // --- Drag and Drop for File Import ---
  // We handle dragEnter, dragOver, and drop to prevent the browser 
  // from opening the file in a new tab.
  const handleDragEnterFile = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if it's a file drag to avoid triggering on internal element drags
    if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
      dragCounter.current++;
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragOverFile = useCallback((e: React.DragEvent) => {
    // Required to allow the drop event to fire
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeaveFile = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
      dragCounter.current--;
      // Only hide the overlay when the counter returns to zero (actually leaving the container)
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDraggingOver(false);
      }
    }
  }, []);

  const handleDropFile = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;

    // Helper function for fuzzy matching
    const getSimilarity = (s1: string, s2: string) => {
      const len1 = s1.length;
      const len2 = s2.length;
      const matrix: number[][] = [];
      for (let i = 0; i <= len1; i++) matrix[i] = [i];
      for (let j = 0; j <= len2; j++) matrix[0][j] = j;
      for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
          const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
      }
      const distance = matrix[len1][len2];
      const maxLen = Math.max(len1, len2);
      return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
    };

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const isJson = file.name.endsWith('.json');
      const isText = file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv');

      if (isJson || isText) {
        try {
          const text = await file.text();
          let importData: any[] = [];
          
          if (isJson) {
            importData = JSON.parse(text);
            if (!Array.isArray(importData)) importData = [importData];
          } else {
            importData = text.split(/,|\n/).map(name => ({ title: name.trim() })).filter(item => item.title);
          }

          const newlyCreatedTracker: Song[] = [];
          const choicesToSet: SongChoice[] = [];
          const missingFromDb: any[] = [];

          // First Pass: Find exact/fuzzy matches
          for (const item of importData) {
            const itemTitle = item.title || item.name || '';
            const normalizedInputName = normalizeText(itemTitle);
            
            const exactMatch = allSongs.find(s => normalizeText(s.title) === normalizedInputName);
            
            if (exactMatch) {
              choicesToSet.push({
                songId: exactMatch.id,
                key: item.key || exactMatch.key,
                tempo: item.tempo || exactMatch.tempo,
                style: item.style || '',
                singer: item.singer || ''
              });
            } else {
              // Attempt Fuzzy Match
              let bestMatch: Song | null = null;
              let maxSimilarity = 0;
              const FUZZY_THRESHOLD = 0.75;

              allSongs.forEach(song => {
                const similarity = getSimilarity(normalizedInputName, normalizeText(song.title));
                if (similarity > maxSimilarity) {
                  maxSimilarity = similarity;
                  bestMatch = song;
                }
              });

              if (bestMatch && maxSimilarity >= FUZZY_THRESHOLD) {
                choicesToSet.push({
                  songId: (bestMatch as Song).id,
                  key: item.key || (bestMatch as Song).key,
                  tempo: item.tempo || (bestMatch as Song).tempo,
                  style: item.style || '',
                  singer: item.singer || ''
                });
              } else {
                missingFromDb.push(item);
              }
            }
          }

          // Second Pass: Handle missing songs
          if (missingFromDb.length > 0) {
            const confirmMsg = `${missingFromDb.length} song(s) were not found in your database.\n\nWould you like to create them automatically using the placeholder text "(to be done)"?`;
            
            if (window.confirm(confirmMsg)) {
              for (const item of missingFromDb) {
                const songData: Partial<Song> = {
                  title: item.title || item.name || 'Untitled Song',
                  authors: item.authors || '',
                  key: item.key || '',
                  tempo: item.tempo,
                  body: `(to be done - added: ${new Date().toLocaleDateString()})`,
                  ownerId: user?.id || '',
                  language: 'English',
                  isArchived: false
                };
                
                try {
                  const savedSong = await onSaveSong(songData);
                  newlyCreatedTracker.push(savedSong);
                  choicesToSet.push({
                    songId: savedSong.id,
                    key: item.key || savedSong.key,
                    tempo: item.tempo || savedSong.tempo,
                    style: item.style || '',
                    singer: item.singer || ''
                  });
                } catch (err) {
                  console.error("Failed to auto-create song", err);
                }
              }
            }
          }

          setChoices(prev => {
            const existingIds = new Set(prev.map(c => c.songId));
            const uniqueNew = choicesToSet.filter(c => !existingIds.has(c.songId));
            return [...prev, ...uniqueNew];
          });

          if (newlyCreatedTracker.length > 0) {
            setAutoAddedSongs(newlyCreatedTracker.slice(0, 20));
            setShowSummaryModal(true);
          }
        } catch (error) {
          console.error("Error reading dropped file:", error);
          alert("Failed to read file. Please ensure it's a valid text or JSON file.");
        }
      } else {
        alert("Only text (.txt, .csv) or .json files are supported.");
      }
    }
  }, [allSongs, user, onSaveSong]);

  const handleCleanupAutoAdded = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) {
      setShowSummaryModal(false);
      return;
    }

    if (window.confirm(`Permanently delete ${idsToDelete.length} newly created songs?`)) {
      try {
        for (const id of idsToDelete) {
          const song = autoAddedSongs.find(s => s.id === id);
          if (song) {
            await onDeleteSong(song);
            setChoices(prev => prev.filter(c => c.songId !== id));
          }
        }
        setShowSummaryModal(false);
      } catch (err) {
        console.error("Cleanup failed", err);
      }
    }
  };


  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-xl mt-4 mb-12 transition-colors">
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {initialSetlist ? 'Edit Setlist' : 'New Setlist'}
          </h2>
          {initialSetlist && onToggleFavorite && (
            <button 
              onClick={() => onToggleFavorite(initialSetlist.id)}
              className={`text-xl transition-all hover:scale-110 ${isFavorite ? 'text-red-500' : 'text-gray-300 dark:text-gray-600'}`}
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            >
              <i className={`fa-solid fa-heart ${isFavorite ? 'animate-pulse' : ''}`}></i>
            </button>
          )}
        </div>
        <div className="flex space-x-2">
          {batchCount !== undefined && batchCount > 0 && onQuitBatch && (
            <button
              onClick={onQuitBatch}
              className="px-4 py-2 text-red-600 dark:text-red-400 font-bold border border-red-300 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Quit Batch
            </button>
          )}
          <button 
            onClick={onCancel} 
            className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {batchCount && batchCount > 0 ? 'Skip' : (isDirty ? 'Cancel' : 'Back')}
          </button>
          <button 
            onClick={() => handleSave(true)} 
            disabled={!name.trim() || !isDirty || isSaving}
            className={`px-4 py-2 rounded-lg font-bold transition-all border ${
              !name.trim() || !isDirty || isSaving ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-white dark:bg-gray-800 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={() => handleSave(false)} 
            disabled={!name.trim() || !isDirty || isSaving}
            className={`px-4 md:px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all ${
              !name.trim() || !isDirty || isSaving ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSaving ? 'Saving...' : (batchCount && batchCount > 0 ? `Save & Next (${batchCount})` : 'Save & Exit')}
          </button>
          <button 
            onClick={handleExport}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Export
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
          <div 
            className={`lg:col-span-2 relative bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border transition-all ${isDraggingOver ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-700'}`}
            onDragEnter={handleDragEnterFile}
            onDragOver={handleDragOverFile}
            onDragLeave={handleDragLeaveFile}
            onDrop={handleDropFile}
          >
            {isDraggingOver && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px] pointer-events-none border-2 border-dashed border-blue-500 rounded-2xl">
                <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-xl shadow-xl flex items-center gap-3">
                  <i className="fa-solid fa-file-import text-blue-500 text-xl"></i>
                  <span className="font-bold text-gray-900 dark:text-white">Drop to import song list</span>
                </div>
              </div>
            )}
            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>Set Order</span>
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">{choices.length} songs</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Sort by:</span>
                {renderSortButton('language', 'Language')}
                {renderSortButton('title', 'Title')}
                {sortKeys.length > 0 && (
                  <button onClick={() => setSortKeys([])} title="Clear Sort" className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                )}
                {choices.length > 1 && (
                  <button 
                    onClick={handleClearAll}
                    className="text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </h3>
            {/* Added ref to itemRefs for SetlistSongRow */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {choices.length === 0 && (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 italic border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl h-full flex items-center justify-center">
                  Drag songs here or click + from the library
                </div>
              )}
              
              {choices.map((choice, idx) => {
                const song = getSong(choice.songId);
                return (
                  <SetlistSongRow
                    key={`${choice.songId}-${idx}`}
                    ref={el => { itemRefs.current[idx] = el; }}
                    index={idx}
                    choice={choice}
                    song={song}
                    draggedIndex={draggedIndex}
                    isMetronomeActive={metronomeIndex === idx && metronome.active}
                    beatFlash={metronome.beatFlash}
                    onUpdate={handleUpdateChoice}
                    onRemove={handleRemoveSong}
                    onToggleMetronome={toggleMetronomeForRow}
                    onTapTempo={metronome.tap}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onKeyDown={handleKeyDown}
                  />
                );
              })}
            </div>
          </div>

          {/* Song Library */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-[600px]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-700 dark:text-gray-300">
                {searchQuery.trim().length >= 2 ? 'Search Results' : 'Recent Additions'}
              </h3>
              <div className="flex gap-2">
                {currentSong && (
                  <button 
                    onClick={handleAddCurrentSong}
                    disabled={existingSongIds.has(currentSong.id)}
                    className="text-xs font-bold px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-400 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                    title={existingSongIds.has(currentSong.id) ? `${currentSong.title} is already in the setlist` : `Add ${currentSong.title}`}
                  >
                    {existingSongIds.has(currentSong.id) ? 'Added' : '+ Current Song'}
                  </button>
                )}
                {availableSongs.length > 0 && searchQuery.length > 0 && (
                  <button 
                    onClick={handleAddAll}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded transition-colors"
                  >
                    Add All ({availableSongs.length})
                  </button>
                )}
              </div>
            </div>
            <div className="relative mb-3">
              <input 
                type="text" 
                placeholder="Search library..." 
                className="w-full px-3 py-2 pr-8 rounded-lg bg-gray-100 dark:bg-gray-700 border-none text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 placeholder-gray-500 dark:placeholder-gray-400"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
              />
              {inputValue && (
                <button 
                  onClick={() => {
                    setInputValue('');
                    setSearchQuery('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 flex items-center justify-center rounded-full"
                  title="Clear search"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {librarySongs.slice(0, 50).map(song => {
                const isAdded = existingSongIds.has(song.id);
                return (
                  <button 
                    key={song.id}
                    onClick={() => handleAddSong(song)}
                    disabled={isAdded}
                    className={`w-full text-left flex items-center justify-between p-2 rounded-lg group transition-colors border border-transparent ${
                      isAdded 
                        ? 'bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed' 
                        : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-100 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className={`text-sm font-bold truncate ${isAdded ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>{song.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{song.authors}</p>
                    </div>
                    {isAdded ? (
                      <i className="fa-solid fa-check text-green-500 dark:text-green-400"></i>
                    ) : (
                      <i className="fa-solid fa-plus text-gray-300 dark:text-gray-600 group-hover:text-blue-600 dark:group-hover:text-blue-400"></i>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    
      {/* Export Setlist Modal */}  
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Export Setlist</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Choose the format to export the setlist:
            </p>
            
            <div className="flex justify-center gap-4">
              <button 
                onClick={handleExportAsCsv}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
              >
                Export as CSV
              </button>
              <button
                onClick={handleExportAsJson}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg shadow-green-200 dark:shadow-none transition-all"
              >
                Export as JSON
              </button>
            </div>

            <div className="mt-8 flex justify-end">
              <button onClick={closeExportModal} className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Added Songs Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Import Summary</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              The following songs were automatically added to your library. Uncheck any you wish to keep, or select those you want to delete now.
            </p>
            
            <div className="max-h-60 overflow-y-auto border rounded-xl mb-6 divide-y dark:divide-gray-700">
              {autoAddedSongs.map(song => (
                <label key={song.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <input 
                    type="checkbox" 
                    defaultChecked={false}
                    id={`cleanup-${song.id}`}
                    className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 mr-3"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{song.title}</p>
                    <p className="text-xs text-gray-500 italic">Added as placeholder</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  const selected = autoAddedSongs
                    .filter(s => (document.getElementById(`cleanup-${s.id}`) as HTMLInputElement)?.checked)
                    .map(s => s.id);
                  handleCleanupAutoAdded(selected);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
              >
                Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default SetlistEditor;