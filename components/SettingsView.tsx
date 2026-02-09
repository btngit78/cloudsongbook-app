import React, { useState } from 'react';
import { User, UserSettings } from '../types';

interface SettingsViewProps {
  user: User;
  onSave: (settings: UserSettings) => void;
  onCancel: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onSave, onCancel }) => {
  const [settings, setSettings] = useState<UserSettings>(user.settings);

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-gray-100 mt-8">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">User Settings</h2>
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
          >
            Save
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Font Size ({settings.fontSize}px)</label>
          <input 
            type="range" min="12" max="32" 
            value={settings.fontSize}
            onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Show Chords</span>
          <button 
            onClick={() => setSettings({ ...settings, showChords: !settings.showChords })}
            className={`w-12 h-6 rounded-full transition-colors relative ${settings.showChords ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.showChords ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">User ID: {user.id}</p>
          <p className="text-xs text-gray-400">Account Type: <span className="uppercase font-bold text-blue-600">{user.role}</span></p>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;