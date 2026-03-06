import React from 'react';

interface OfflineReadyToastProps {
  onDismiss: () => void;
}

const OfflineReadyToast: React.FC<OfflineReadyToastProps> = ({ onDismiss }) => {
  return (
    <div className="fixed bottom-4 left-4 z-50 bg-green-600 text-white rounded-xl shadow-2xl p-4 max-w-sm animate-slideInUp flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <i className="fa-solid fa-circle-check text-xl"></i>
        <p className="text-sm font-bold">App is ready to work offline.</p>
      </div>
      <button title="Dismiss" onClick={onDismiss} className="text-white/70 hover:text-white transition-colors">
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
};

export default OfflineReadyToast;