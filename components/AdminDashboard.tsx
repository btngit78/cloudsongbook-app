import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { dbService } from '../services/dbService';

interface AdminDashboardProps {
  currentUser: User;
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  // State for deletion modal
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [contentOption, setContentOption] = useState<'transfer' | 'delete'>('transfer');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      const fetchedUsers = await dbService.getAllUsers();
      setUsers(fetchedUsers);
      setLoading(false);
    };
    loadUsers();
  }, []);

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

      {loading ? (
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-64">Actions</th>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 
                          user.role === UserRole.PREMIUM ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {user.role}
                      </span>
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
