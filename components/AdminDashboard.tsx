import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole, Song, SetList } from '../types';
import { dbService } from '../services/dbService';
import { storageService } from '../services/storageService';

interface AdminDashboardProps {
  currentUser: User;
  onBack: () => void;
  allSongs: Song[];
  allSetlists: SetList[];
  onNavigate: (query: string, type: 'songs' | 'setlists') => void;
  onSaveSong: (song: Partial<Song>) => void;
  onSaveSetlist: (setlist: SetList) => void;
  onDeleteSong: (song: Song) => void;
  onDeleteSetlist: (id: string) => void;
}

interface StorageFile {
  path: string;
  size: number;
  url: string;
  songId: string;
  name: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onBack, allSongs, allSetlists, onNavigate, onSaveSong, onSaveSetlist, onDeleteSong, onDeleteSetlist }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  // State for deletion modal
  const [activeTab, setActiveTab] = useState<'users' | 'storage' | 'data' | 'archive'>('users');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [contentOption, setContentOption] = useState<'transfer' | 'delete'>('transfer');
  const [isDeleting, setIsDeleting] = useState(false);
  // State for orphaned files
  const [sendingWelcomeEmail, setSendingWelcomeEmail] = useState<string | null>(null);
  const [orphanedFiles, setOrphanedFiles] = useState<StorageFile[]>([]);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
  // State for Data Management
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // State for Settings Backup
  const [isBackingUpSettings, setIsBackingUpSettings] = useState(false);
  const [isRestoringSettings, setIsRestoringSettings] = useState(false);
  const settingsFileInputRef = useRef<HTMLInputElement>(null);

  const userContentCounts = useMemo(() => {
    const counts: Record<string, { songs: number, setlists: number }> = {};
    if (!allSongs || !allSetlists) return counts;

    for (const user of users) {
        counts[user.id] = {
            songs: allSongs.filter(s => s.ownerId === user.id).length,
            setlists: allSetlists.filter(s => s.ownerId === user.id).length,
        };
    }
    return counts;
  }, [users, allSongs, allSetlists]);

  const archivedSongs = useMemo(() => {
    return allSongs.filter(s => s.isArchived).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [allSongs]);

  const archivedSetlists = useMemo(() => {
    return allSetlists.filter(s => s.isArchived).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [allSetlists]);

  const handleUnarchiveSong = (song: Song) => onSaveSong({ ...song, isArchived: false });
  const handleUnarchiveSetlist = (setlist: SetList) => onSaveSetlist({ ...setlist, isArchived: false });


  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      const fetchedUsers = await dbService.getAllUsers();
      setUsers(fetchedUsers);
      setLoading(false);
    };
    loadUsers();
  }, []);

  const [storageFiles, setStorageFiles] = useState<StorageFile[]>([]);
  const [totalStorageSize, setTotalStorageSize] = useState(0);
  const [loadingStorage, setLoadingStorage] = useState(false);

  const loadStorageDetails = async () => {
    setLoadingStorage(true);
    try {
      const { totalSize, files } = await storageService.getStorageUsageDetails();
      setTotalStorageSize(totalSize);
      setStorageFiles(files);
    } catch (error) {
      console.error("Failed to load storage details", error);
      alert("Failed to load storage details. See console for more info.");
    } finally {
      setLoadingStorage(false);
    }
  };

  // Load storage details when tab is switched for the first time
  useEffect(() => {
    if (activeTab === 'storage' && storageFiles.length === 0) {
      loadStorageDetails();
    }
  }, [activeTab]);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleFindOrphans = async () => {
    setLoadingOrphans(true);
    setOrphanedFiles([]); // Clear previous results
    try {
      const orphans = await storageService.findOrphanedPdfs(allSongs);
      setOrphanedFiles(orphans);
      if (orphans.length === 0) {
        alert("No orphaned files found!");
      }
    } catch (error) {
      console.error("Failed to find orphaned files", error);
      alert("An error occurred while searching for orphaned files. See console for details.");
    } finally {
      setLoadingOrphans(false);
    }
  };

  const handleDeleteAllOrphans = async () => {
    const filesToDelete = [...orphanedFiles];
    if (filesToDelete.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete all ${filesToDelete.length} orphaned files? This action is permanent.`)) {
      return;
    }

    setLoadingOrphans(true);
    let deletedCount = 0;
    let failedCount = 0;
    let spaceFreed = 0;

    const deletionPromises = filesToDelete.map(file =>
      storageService.deleteFileByPath(file.path)
        .then(() => {
          deletedCount++;
          spaceFreed += file.size;
        })
        .catch(error => {
          console.error(`Failed to delete orphan ${file.path}`, error);
          failedCount++;
        })
    );

    await Promise.all(deletionPromises);

    // Update state after all operations
    setOrphanedFiles([]); // All attempted, so clear the list
    setStorageFiles(prev => prev.filter(f => !filesToDelete.some(deleted => deleted.path === f.path)));
    setTotalStorageSize(prev => prev - spaceFreed);

    setLoadingOrphans(false);
    alert(`${deletedCount} orphaned files deleted. ${failedCount > 0 ? `${failedCount} failed.` : ''}`);
  };

  const handleDeleteFile = async (filePath: string, fileName: string, fileSize: number) => {
    if (!window.confirm(`Are you sure you want to delete the file "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    setLoadingStorage(true); // Indicate loading while deleting
    try {
      await storageService.deleteFileByPath(filePath);
      setStorageFiles(prevFiles => prevFiles.filter(file => file.path !== filePath));
      setOrphanedFiles(prevFiles => prevFiles.filter(file => file.path !== filePath)); // Also remove from orphans if it's there
      setTotalStorageSize(prevSize => prevSize - fileSize);
      alert(`File "${fileName}" deleted successfully.`);
    } catch (error) {
      console.error("Error deleting file:", error);
      alert(`Failed to delete file "${fileName}". Please try again.`);
    } finally {
      setLoadingStorage(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser.id) return;
    
    // Optimistic update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    
    try {
      await dbService.updateUserRole(userId, newRole);
    } catch (error) {
      console.error("Failed to update role", error);
      // Revert on failure
      const fetchedUsers = await dbService.getAllUsers();
      setUsers(fetchedUsers);
    }
  };

  const handleSendWelcomeEmail = async (user: User) => {
    if (!window.confirm(`Are you sure you want to send a welcome email to ${user.name}?`)) {
        return;
    }
    setSendingWelcomeEmail(user.id);
    try {
        const result = await dbService.sendWelcomeEmail(user.id);
        alert(result.message);
        // Optimistically update the user in the state to reflect that the email was sent
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, welcomeEmailSentAt: Date.now() } : u));
    } catch (error: any) {
        alert(`Failed to send welcome email: ${error.message || 'See console for details.'}`);
    } finally {
        setSendingWelcomeEmail(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);

    try {
      // This now calls the secure cloud function.
      await dbService.deleteUserAndContent(userToDelete.id, contentOption);

      // The cloud function handles Auth and Firestore deletion.
      console.log(`Successfully initiated deletion for user ${userToDelete.id}`);

      // Optimistically update the UI
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setUserToDelete(null); // Close modal
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      // The callable function throws an HttpsError which has a message.
      alert(`An error occurred while deleting the user: ${error.message || 'See console for details.'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      // For Admin, we backup ALL songs and setlists in the system
      const allSongs = await dbService.getSongs();
      const allSetlists = await dbService.getSetlists();
      
      const backupData = {
        version: 1,
        timestamp: Date.now(),
        type: 'full_system_backup',
        songs: allSongs,
        setlists: allSetlists,
        createdBy: currentUser.name
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cloudsongbook-FULL-BACKUP-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Backup failed", error);
      alert("Failed to create backup.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("WARNING: Restore will overwrite existing songs and setlists with matching IDs. This action affects the entire database. Continue?")) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Restore Songs
      let songsCount = 0;
      if (Array.isArray(data.songs)) {
        for (const song of data.songs) {
          // Preserve original ownerId if present, otherwise default to admin
          await dbService.saveSong({ ...song, ownerId: song.ownerId || currentUser.id });
          songsCount++;
        }
      }

      // Restore Setlists
      let setlistsCount = 0;
      if (Array.isArray(data.setlists)) {
        for (const setlist of data.setlists) {
          await dbService.saveSetlist({ ...setlist, ownerId: setlist.ownerId || currentUser.id });
          setlistsCount++;
        }
      }

      await dbService.refreshCache();
      alert(`Restore completed! Processed ${songsCount} songs and ${setlistsCount} setlists.`);
    } catch (error) {
      console.error("Restore failed", error);
      alert("Failed to restore data. Invalid file format.");
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBackupSettings = async () => {
    setIsBackingUpSettings(true);
    try {
      const allUsers = await dbService.getAllUsers();
      
      const backupData = {
        version: 1,
        timestamp: Date.now(),
        type: 'users_settings_backup',
        users: allUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          settings: u.settings
        })),
        createdBy: currentUser.name
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cloudsongbook-SETTINGS-BACKUP-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Settings backup failed", error);
      alert("Failed to create settings backup.");
    } finally {
      setIsBackingUpSettings(false);
    }
  };

  const handleRestoreSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("WARNING: This will overwrite settings for all matched users in the backup file. Continue?")) {
      e.target.value = '';
      return;
    }

    setIsRestoringSettings(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.type !== 'users_settings_backup' || !Array.isArray(data.users)) {
        throw new Error("Invalid backup file format.");
      }

      let count = 0;
      for (const userBackup of data.users) {
        if (userBackup.id && userBackup.settings) {
          await dbService.updateUserSettings(userBackup.id, userBackup.settings);
          count++;
        }
      }

      alert(`Settings restore completed! Updated settings for ${count} users.`);
      
      // Refresh users list to ensure consistency if we switch tabs
      const fetchedUsers = await dbService.getAllUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Settings restore failed", error);
      alert("Failed to restore settings. Invalid file format.");
    } finally {
      setIsRestoringSettings(false);
      if (settingsFileInputRef.current) settingsFileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h2>
        <button 
          onClick={onBack}
          className="px-4 py-2 text-gray-800 dark:text-gray-200 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Back
        </button>
      </div>

      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('users')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'users' ? 'border-blue-500 text-blue-600 dark:text-blue-300' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'storage' ? 'border-blue-500 text-blue-600 dark:text-blue-300' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}
          >
            Storage Management
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'data' ? 'border-blue-500 text-blue-600 dark:text-blue-300' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}
          >
            Data Management
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'archive' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}
          >
            Archive
          </button>
        </nav>
      </div>

      {activeTab === 'users' && (
        loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading users...</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Content</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-48">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">{(() => {
                      const isNewUser = user.createdAt && (Date.now() - user.createdAt < 7 * 24 * 60 * 60 * 1000); // 7 days
                      return (
                        <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold mr-3">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                            {isNewUser && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">New</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {user.createdAt ? (
                          <div>
                            <div>{new Date(user.createdAt).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-400">{new Date(user.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {user.lastLoginAt ? (
                          <div>
                            <div>{new Date(user.lastLoginAt).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-400">{new Date(user.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 
                            user.role === UserRole.PREMIUM ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => onNavigate(`#owner:${user.id}`, 'songs')} className="font-medium text-blue-600 dark:text-blue-400 hover:underline" title="View user's songs">
                            {userContentCounts[user.id]?.songs ?? 0}
                          </button>
                          <span className="text-gray-400 dark:text-gray-500">/</span>
                          <button onClick={() => onNavigate(`#owner:${user.id}`, 'setlists')} className="font-medium text-blue-600 dark:text-blue-400 hover:underline" title="View user's setlists">
                            {userContentCounts[user.id]?.setlists ?? 0}
                          </button>
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500">
                          Songs / Setlists
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-2">
                          <select
                            aria-label="User Role"
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            disabled={user.id === currentUser.id}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50"
                          >
                            <option value={UserRole.FREE}>FREE</option>
                            <option value={UserRole.PREMIUM}>PREMIUM</option>
                            <option value={UserRole.ADMIN}>ADMIN</option>
                          </select>
                          <button
                            onClick={() => handleSendWelcomeEmail(user)}
                            disabled={!!user.welcomeEmailSentAt || sendingWelcomeEmail === user.id}
                            className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={user.welcomeEmailSentAt ? `Welcome email sent on ${new Date(user.welcomeEmailSentAt).toLocaleDateString()}` : 'Send Welcome Email'}
                          >
                            {sendingWelcomeEmail === user.id ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                          </button>
                          <button
                            onClick={() => setUserToDelete(user)}
                            disabled={user.id === currentUser.id || user.role === UserRole.ADMIN}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete User"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                        </>
                      );
                    })()}
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {activeTab === 'storage' && (
        <div>
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200">Total Storage Used</h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{loadingStorage ? '...' : formatBytes(totalStorageSize)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{loadingStorage ? '...' : `${storageFiles.length} files`}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleFindOrphans} disabled={loadingOrphans || loadingStorage} className="px-4 py-2 text-sm font-bold text-yellow-600 dark:text-yellow-300 border border-yellow-500 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 disabled:opacity-50 disabled:cursor-wait transition-colors">
                {loadingOrphans ? 'Scanning...' : 'Find Orphans'}
              </button>
              <button onClick={loadStorageDetails} disabled={loadingStorage || loadingOrphans} className="px-4 py-2 text-sm font-bold text-blue-600 dark:text-blue-300 border border-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-wait transition-colors">
                {loadingStorage ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Orphaned Files Section */}
          {(loadingOrphans || orphanedFiles.length > 0) && (
            <div className="mb-8">
              <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200">Orphaned Files ({orphanedFiles.length})</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      These are PDF files in storage that are not linked to any song. They can be safely deleted.
                    </p>
                  </div>
                  {orphanedFiles.length > 0 && !loadingOrphans && (
                    <button
                      onClick={handleDeleteAllOrphans}
                      disabled={loadingOrphans}
                      className="px-4 py-2 text-sm font-bold text-red-600 dark:text-red-300 border border-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      Delete All
                    </button>
                  )}
                </div>
              </div>

              {loadingOrphans ? (
                <div className="text-center py-12"><p className="text-gray-500 dark:text-gray-400">Scanning for orphaned files...</p></div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border border-gray-200 dark:border-gray-700">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">File Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Original Song ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Size</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {orphanedFiles.map((file) => (
                          <tr key={file.path} className="hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">{file.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">{file.songId}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatBytes(file.size)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                              <button onClick={() => handleDeleteFile(file.path, file.name, file.size)} className="font-medium text-red-600 dark:text-red-400 hover:underline">
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {loadingStorage && storageFiles.length === 0 ? (
            <div className="text-center py-12"><p className="text-gray-500 dark:text-gray-400">Loading storage details...</p></div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">File Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Song ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Link</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {storageFiles.map((file) => (
                      <tr key={file.path} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">{file.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">{file.songId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatBytes(file.size)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200">
                            Open
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() => handleDeleteFile(file.path, file.name, file.size)}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete File"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'data' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Content Backup (Songs & Setlists)</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Create a full JSON backup of all songs and setlists in the database, or restore data from a previous backup file. 
            <br/><span className="font-bold text-amber-600 dark:text-amber-400">Warning:</span> Restoring data will overwrite existing entries if IDs match.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mb-10">
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className="flex items-center justify-center px-6 py-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-base font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-400 transition-all disabled:opacity-50"
            >
              {isBackingUp ? <i className="fa-solid fa-spinner fa-spin mr-3 text-xl"></i> : <i className="fa-solid fa-download mr-3 text-xl text-blue-500"></i>}
              Download Full Backup
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRestoring}
              className="flex items-center justify-center px-6 py-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-base font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-green-400 transition-all disabled:opacity-50"
            >
              {isRestoring ? <i className="fa-solid fa-spinner fa-spin mr-3 text-xl"></i> : <i className="fa-solid fa-upload mr-3 text-xl text-green-500"></i>}
              Restore from Backup
            </button>
            <input
              title="Select backup JSON file"
              type="file"
              ref={fileInputRef}
              onChange={handleRestore}
              accept=".json"
              className="hidden"
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Users Settings Backup</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Backup and restore individual user preferences (theme, font size, etc.). Useful for migrating user configurations.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              <button
                onClick={handleBackupSettings}
                disabled={isBackingUpSettings}
                className="flex items-center justify-center px-6 py-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-base font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-purple-400 transition-all disabled:opacity-50"
              >
                {isBackingUpSettings ? <i className="fa-solid fa-spinner fa-spin mr-3 text-xl"></i> : <i className="fa-solid fa-user-gear mr-3 text-xl text-purple-500"></i>}
                Backup User Settings
              </button>
              
              <button
                onClick={() => settingsFileInputRef.current?.click()}
                disabled={isRestoringSettings}
                className="flex items-center justify-center px-6 py-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-base font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-purple-400 transition-all disabled:opacity-50"
              >
                {isRestoringSettings ? <i className="fa-solid fa-spinner fa-spin mr-3 text-xl"></i> : <i className="fa-solid fa-file-import mr-3 text-xl text-purple-500"></i>}
                Restore User Settings
              </button>
              <input
                title="Select settings backup JSON file"
                type="file"
                ref={settingsFileInputRef}
                onChange={handleRestoreSettings}
                accept=".json"
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="space-y-8">
          {/* Archived Songs */}
          <div>
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3">Archived Songs ({archivedSongs.length})</h3>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Song</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Archived On</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {archivedSongs.map(song => (
                      <tr key={song.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{song.title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{song.authors}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {song.updatedAt ? new Date(song.updatedAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleUnarchiveSong(song)} className="px-3 py-1 text-xs font-bold text-green-600 border border-green-500 rounded-full hover:bg-green-50">Unarchive</button>
                            <button 
                              onClick={() => {
                                if (window.confirm(`PERMANENTLY DELETE "${song.title}"? This cannot be undone.`)) {
                                  onDeleteSong(song);
                                }
                              }} 
                              className="px-3 py-1 text-xs font-bold text-red-600 border border-red-500 rounded-full hover:bg-red-50">
                              Delete Permanently
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Archived Setlists */}
          <div>
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3">Archived Setlists ({archivedSetlists.length})</h3>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Setlist</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Archived On</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {archivedSetlists.map(setlist => (
                      <tr key={setlist.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{setlist.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{setlist.choices.length} songs</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {setlist.updatedAt ? new Date(setlist.updatedAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleUnarchiveSetlist(setlist)} className="px-3 py-1 text-xs font-bold text-green-600 border border-green-500 rounded-full hover:bg-green-50">Unarchive</button>
                            <button 
                              onClick={() => {
                                if (window.confirm(`PERMANENTLY DELETE setlist "${setlist.name}"? This cannot be undone.`)) {
                                  onDeleteSetlist(setlist.id);
                                }
                              }} 
                              className="px-3 py-1 text-xs font-bold text-red-600 border border-red-500 rounded-full hover:bg-red-50">
                              Delete Permanently
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete User</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              You are about to permanently delete the user{' '}
              <strong className="text-red-600 dark:text-red-400">{userToDelete.name} ({userToDelete.email})</strong>.
              This action cannot be undone.
            </p>

            <div className="mt-6">
              <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Handle User's Content</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Choose what to do with songs and setlists owned by this user.</p>
              <div className="space-y-3">
                <label className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="content-option" 
                    value="transfer"
                    checked={contentOption === 'transfer'}
                    onChange={() => setContentOption('transfer')}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3 text-sm">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Transfer content to me (Admin)</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">All songs and setlists will be reassigned to your account.</p>
                  </div>
                </label>
                <label className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="content-option" 
                    value="delete"
                    checked={contentOption === 'delete'}
                    onChange={() => setContentOption('delete')}
                    className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <div className="ml-3 text-sm">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Delete all content</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">All songs and setlists owned by this user will be permanently deleted.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button onClick={() => setUserToDelete(null)} disabled={isDeleting} className="px-4 py-2 text-gray-700 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleDeleteUser} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none transition-all disabled:bg-red-400 disabled:cursor-wait">
                {isDeleting ? 'Deleting...' : `Delete ${userToDelete.name}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
