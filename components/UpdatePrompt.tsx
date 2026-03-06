import React from 'react';

interface UpdatePromptProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

const UpdatePrompt: React.FC<UpdatePromptProps> = ({ onUpdate, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 max-w-sm animate-slideInUp">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <i className="fa-solid fa-cloud-arrow-down text-blue-500 text-2xl"></i>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">New Version Available</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            A new version of CloudSongBook has been downloaded. Refresh to get the latest features.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onDismiss}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 text-sm font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Not Now
        </button>
        <button 
          onClick={onUpdate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;