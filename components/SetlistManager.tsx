import React, { useState, useEffect, useMemo } from 'react';
import { Song, SetList, SongChoice, User, UserRole } from '../types';
import SetlistEditor from './SetlistEditor';
import DualSetlistEditor from './DualSetlistEditor';
import { dbService } from '../services/dbService';
import { getSearchPattern } from '../hooks/useSongSearch';

interface SetlistManagerProps {
  user: User | null;
  setlists: SetList[];
  allSongs: Song[];
  currentSong?: Song;
  onSave: (setlist: SetList) => void;
  onArchive: (id: string) => void;
  onPlay: (setlist: SetList) => void;
  onClose: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  initialEditingId?: string | null;
  initialSearchQuery?: string;
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

type SortKey = 'name' | 'updatedAt' | 'lastUsedAt';

const SetlistManager: React.FC<SetlistManagerProps> = ({ 
  user, setlists, allSongs, currentSong, onSave, onArchive, onPlay, onClose, onDirtyChange, initialEditingId, initialSearchQuery = ''
}) => {
  const [editingId, setEditingId] = useState<string | null>(initialEditingId || null);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [showArchived, setShowArchived] = useState(false);
  const [compareListIds, setCompareListIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  // Fetch owner names for setlists
  useEffect(() => {
    const fetchOwners = async () => {
      const uniqueOwnerIds = Array.from(new Set(setlists.map(s => s.ownerId).filter(id => id && id !== user?.id)));
      const names: Record<string, string> = {};
      
      await Promise.all(uniqueOwnerIds.map(async (id) => {
        // Check cache or fetch
        if (ownerNames[id]) return;
        
        const owner = await dbService.getUser(id);
        if (owner) {
          names[id] = owner.role === UserRole.ADMIN ? 'Admin' : owner.name;
        } else {
          names[id] = 'Unknown';
        }
      }));
      
      if (Object.keys(names).length > 0) {
        setOwnerNames(prev => ({ ...prev, ...names }));
      }
    };
    
    if (setlists.length > 0) fetchOwners();
  }, [setlists, user?.id]);

  const startEdit = (setlist?: SetList) => {
    if (setlist) {
      setEditingId(setlist.id);
    } else {
      setEditingId('new');
    }
  };

  const handleSave = (name: string, choices: SongChoice[], keepOpen: boolean = false) => {
    const isNew = editingId === 'new';
    const targetId = isNew ? Date.now().toString() : editingId!;
    const originalSetlist = isNew ? undefined : setlists.find(s => s.id === editingId);

    const newSetlist: SetList = {
      id: targetId,
      name,
      choices,
      createdAt: originalSetlist?.createdAt || Date.now(),
      updatedAt: Date.now(),
      ownerId: originalSetlist?.ownerId || user?.id || '',
      lastUsedAt: originalSetlist?.lastUsedAt || 0
    };

    onSave(newSetlist);
    
    if (keepOpen) {
      if (isNew) {
        setEditingId(targetId);
      }
    } else {
      setEditingId(null);
    }
  };

  const handleDuplicate = (setlistToCopy: SetList) => {
    const newSetlist: SetList = {
      id: Date.now().toString(),
      name: `${setlistToCopy.name} (Copy)`,
      choices: [...setlistToCopy.choices],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ownerId: user?.id || '', // Duplicate becomes mine
      lastUsedAt: 0
    };
    onSave(newSetlist);
  };

  const handleSelectForCompare = (id: string) => {
    setCompareListIds(prev => {
      const newSelection = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      // Allow only two selections
      if (newSelection.length > 2) {
        return [newSelection[1], newSelection[2]];
      }
      return newSelection;
    });
  };

  const handleSaveCompare = (listA: SetList, listB: SetList) => {
    onSave(listA);
    onSave(listB);
    setIsComparing(false);
    setCompareListIds([]);
  };

  const handleCancelCompare = () => {
    setIsComparing(false);
    // Keep selection for user reference
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc'); // Default to desc for new sort
    }
  };

  const processList = (list: SetList[]) => {
    return [...list].sort((a, b) => {
      let valA: any = a[sortKey] || 0;
      let valB: any = b[sortKey] || 0;
      
      if (sortKey === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
  };

  const isNotAdmin = user?.role !== UserRole.ADMIN;
  const filteredSetlists = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return setlists;
    }

    if (trimmedQuery.startsWith('#owner:')) {
      const ownerId = trimmedQuery.replace('#owner:', '');
      return setlists.filter(s => s.ownerId === ownerId);
    }

    const pattern = getSearchPattern(trimmedQuery);
    const regex = new RegExp(pattern, 'i');
    return setlists.filter(s => regex.test(s.name) || (ownerNames[s.ownerId] && regex.test(ownerNames[s.ownerId])));
  }, [setlists, searchQuery, ownerNames]);

  const visibleSetlists = useMemo(() => {
    return filteredSetlists.filter(s => showArchived ? s.isArchived === true : !s.isArchived);
  }, [filteredSetlists, showArchived]);

  if (editingId) {
    const setlistToEdit = setlists.find(s => s.id === editingId);
    return (
      <SetlistEditor
        initialSetlist={setlistToEdit}
        allSongs={allSongs}
        currentSong={currentSong}
        onSave={handleSave}
        onCancel={() => setEditingId(null)}
        onDirtyChange={onDirtyChange}
      />
    );
  }

  if (isComparing && compareListIds.length === 2) {
    const listA = setlists.find(s => s.id === compareListIds[0]);
    const listB = setlists.find(s => s.id === compareListIds[1]);
    
    if (listA && listB) {
      return (
        <DualSetlistEditor
          initialListA={listA}
          initialListB={listB}
          allSongs={allSongs}
          onSave={handleSaveCompare}
          onCancel={handleCancelCompare}
        />
      );
    }
  }

  const sortedSetlists = processList(visibleSetlists);

  let primaryList: SetList[];
  let secondaryList: SetList[] = [];
  let primaryTitle: string;
  let showOwnerInPrimary: boolean;

  if (isNotAdmin && !showArchived) {
    primaryList = sortedSetlists.filter(s => s.ownerId === user?.id);
    secondaryList = sortedSetlists.filter(s => s.ownerId !== user?.id && !s.isArchived);
    primaryTitle = "My Setlists";
    showOwnerInPrimary = false;
  } else {
    primaryList = sortedSetlists;
    secondaryList = [];
    primaryTitle = "All Setlists";
    showOwnerInPrimary = true;
  }

  const sortButtons = (
    <div className="flex gap-1">
      <button 
        onClick={() => handleSort('name')}
        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 whitespace-nowrap ${sortKey === 'name' ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300' : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'}`}
      >
        Alphabetic {sortKey === 'name' && <i className={`fa-solid fa-arrow-${sortDir === 'asc' ? 'down-a-z' : 'down-z-a'}`}></i>}
      </button>
      <button 
        onClick={() => handleSort('updatedAt')}
        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 whitespace-nowrap ${sortKey === 'updatedAt' ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300' : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'}`}
      >
        Updated {sortKey === 'updatedAt' && <i className={`fa-solid fa-arrow-${sortDir === 'asc' ? 'up' : 'down'}`}></i>}
      </button>
      <button 
        onClick={() => handleSort('lastUsedAt')}
        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 whitespace-nowrap ${sortKey === 'lastUsedAt' ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300' : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'}`}
      >
        Used {sortKey === 'lastUsedAt' && <i className={`fa-solid fa-arrow-${sortDir === 'asc' ? 'up' : 'down'}`}></i>}
      </button>
    </div>
  );

  const renderTable = (list: SetList[], title: string, showOwner: boolean, headerControls?: React.ReactNode) => (
    <div className="mb-8">
      <div className={`flex justify-between items-end mb-3 px-1 ${showArchived ? 'text-amber-600 dark:text-amber-400' : ''}`}>
        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">{title} ({list.length})</h3>
        {headerControls}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 w-12"></th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 w-24 text-center">Songs</th>
                <th className="px-4 py-3 w-32">Updated</th>
                <th className="px-4 py-3 w-32">Last Used</th>
                {showOwner && <th className="px-4 py-3 w-32">Owner</th>}
                <th className="px-4 py-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={showOwner ? 7 : 6} className="px-4 py-8 text-center text-gray-400 italic">
                    No setlists found.
                  </td>
                </tr>
              ) : (
                list.map(setlist => {
                  const ownerName = ownerNames[setlist.ownerId];
                  const displayOwner = showOwner && ownerName && ownerName !== 'Admin';
                  
                  return (
                    <tr key={setlist.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${setlist.isArchived ? 'bg-yellow-50/50 dark:bg-yellow-900/10 opacity-70' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        <input title="Select for Compare"
                          type="checkbox"
                          checked={compareListIds.includes(setlist.id)}
                          onChange={() => handleSelectForCompare(setlist.id)}
                          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <button title="Play"onClick={() => onPlay(setlist)} className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors">
                            <i className="fa-solid fa-play text-xs ml-0.5"></i>
                          </button>
                          <span className="truncate max-w-[200px] md:max-w-xs">{setlist.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{setlist.choices.length}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(setlist.updatedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{setlist.lastUsedAt ? new Date(setlist.lastUsedAt).toLocaleDateString() : '-'}</td>
                      {showOwner && (
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
                          {displayOwner ? ownerName : ''}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Only allow editing/deleting if it's my setlist or I am admin */}
                          {(user?.role === UserRole.ADMIN || setlist.ownerId === user?.id) && (
                            <>
                              <button onClick={() => startEdit(setlist)} title="Edit" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"><i className="fa-solid fa-pen"></i></button>
                              <button onClick={() => onArchive(setlist.id)} title="Archive" className="p-1.5 text-gray-400 hover:text-amber-600 rounded-md hover:bg-amber-50"><i className="fa-solid fa-archive"></i></button>
                            </>
                          )}
                          <button onClick={() => handleDuplicate(setlist)} title="Duplicate" className="p-1.5 text-gray-400 hover:text-green-600 rounded-md hover:bg-green-50"><i className="fa-solid fa-copy"></i></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex-shrink-0">Setlists Available</h2>
        
        <div className="relative flex-1 max-w-md mx-auto">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search setlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
          />
        </div>
        
        <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={() => setShowArchived(!showArchived)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-amber-600 focus:ring-amber-500 bg-white dark:bg-gray-700"
          />
          <span>Show Archived</span>
        </label>

        {compareListIds.length > 0 && (
          <button
            onClick={() => setIsComparing(true)}
            disabled={compareListIds.length !== 2}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 shadow-lg shadow-yellow-200 dark:shadow-none flex items-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-right-left"></i>
            <span>Compare ({compareListIds.length}/2)</span>
          </button>
        )}
        <div className="flex space-x-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Back</button>
          <button onClick={() => startEdit()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none flex items-center space-x-2 transition-all">
            <i className="fa-solid fa-plus"></i>
            <span>Create New</span>
          </button>
        </div>
      </div>

      {renderTable(primaryList, primaryTitle, showOwnerInPrimary, sortButtons)}
      
      {/* Only show community setlists if there are any */}
      {secondaryList.length > 0 && renderTable(secondaryList, "Community Setlists", true)}
    </div>
  );
};

export default SetlistManager;