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
    <div className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mt-8 transition-colors">
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Settings</h2>
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
          >
            Save
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Chords</span>
          <button 
            onClick={() => setSettings({ ...settings, showChords: !settings.showChords })}
            className={`w-12 h-6 rounded-full transition-colors relative ${settings.showChords ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.showChords ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Font Size ({settings.fontSize}px)</label>
          <input 
            type="range" min="12" max="32" 
            value={settings.fontSize}
            onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer" 
          />
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">App Theme</span>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setSettings({ ...settings, theme: 'light', chordColor: '', sectionColor: '' })}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${settings.theme === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <i className="fa-solid fa-sun mr-2"></i>Light
            </button>
            <button
              onClick={() => setSettings({ ...settings, theme: 'dark', chordColor: 'amber', sectionColor: 'purple' })}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${settings.theme === 'dark' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <i className="fa-solid fa-moon mr-2"></i>Dark
            </button>
            <button
              onClick={() => setSettings({ ...settings, theme: 'system' })}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${settings.theme === 'system' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <i className="fa-solid fa-desktop mr-2"></i>System
            </button>
          </div>
        </div>

        {settings.theme === 'dark' && (
          <div className="grid grid-cols-2 gap-4 animate-fadeIn">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chord Color</label>
              <select
                value={settings.chordColor || 'amber'}
                onChange={(e) => setSettings({ ...settings, chordColor: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="amber">Amber (Default)</option>
                <option value="blue">Blue</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Section Label Color</label>
              <select
                value={settings.sectionColor || 'purple'}
                onChange={(e) => setSettings({ ...settings, sectionColor: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="purple">Purple (Default)</option>
                <option value="teal">Teal</option>
              </select>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">User ID: {user.id}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Account Type: <span className="uppercase font-bold text-blue-600 dark:text-blue-400">{user.role}</span></p>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;