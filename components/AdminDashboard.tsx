import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Song, SetList } from '../types';
import { dbService } from '../services/dbService';
import { storageService } from '../services/storageService';

interface AdminDashboardProps {
  currentUser: User;
  onBack: () => void;
  allSongs: Song[];
  allSetlists: SetList[];
  onNavigate: (query: string, type: 'songs' | 'setlists') => void;
}

interface StorageFile {
  path: string;
  size: number;
  url: string;
  songId: string;
  name: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onBack, allSongs, allSetlists, onNavigate }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  // State for deletion modal
  const [activeTab, setActiveTab] = useState<'users' | 'storage'>('users');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [contentOption, setContentOption] = useState<'transfer' | 'delete'>('transfer');
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteFile = async (filePath: string, fileName: string, fileSize: number) => {
    if (!window.confirm(`Are you sure you want to delete the file "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    setLoadingStorage(true); // Indicate loading while deleting
    try {
      await storageService.deleteFileByPath(filePath);
      setStorageFiles(prevFiles => prevFiles.filter(file => file.path !== filePath));
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

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);

    try {
      // In a real app, this would call your backend service.
      await dbService.deleteUserAndContent(userToDelete.id, contentOption, currentUser.id);

      // IMPORTANT: Deleting a user from Firebase Authentication requires the Admin SDK
      // on a backend server (e.g., Cloud Function). This is a simulation.
      console.log(`Simulating deletion of user ${userToDelete.id} with content option: ${contentOption}`);

      // Optimistically update the UI
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setUserToDelete(null); // Close modal
    } catch (error) {
      console.error("Failed to delete user:", error);
      // In a real app, you might want to revert the optimistic update here.
      alert("An error occurred while deleting the user. See console for details.");
    } finally {
      setIsDeleting(false);
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
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold mr-3">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '-'}
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
                            onClick={() => setUserToDelete(user)}
                            disabled={user.id === currentUser.id || user.role === UserRole.ADMIN}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete User"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
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
            <button onClick={loadStorageDetails} disabled={loadingStorage} className="px-4 py-2 text-sm font-bold text-blue-600 dark:text-blue-300 border border-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-wait transition-colors">
              {loadingStorage ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loadingStorage ? (
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
