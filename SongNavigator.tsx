import React from 'react';

interface SongNavigatorProps {
  showBackToTop: boolean;
  passedChoruses: number[];
  onScrollToTop: () => void;
  onScrollToChorus: (index: number) => void;
}

const SongNavigator: React.FC<SongNavigatorProps> = ({
  showBackToTop,
  passedChoruses,
  onScrollToTop,
  onScrollToChorus,
}) => {
  if (!showBackToTop && passedChoruses.length === 0) return null;

  return (
    <div className="fixed right-6 bottom-6 flex flex-col items-end space-y-3 z-40 pointer-events-none">
      {/* Chorus Stack */}
      <div className="flex flex-col items-end space-y-2 pointer-events-auto">
        {[...passedChoruses].reverse().map((index) => (
          <button
            key={index}
            onClick={() => onScrollToChorus(index)}
            className="bg-indigo-600 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg hover:bg-indigo-700 transition-all opacity-90 hover:opacity-100 flex items-center animate-fadeIn"
            title={`Jump back to Chorus ${index + 1}`}
          >
            <i className="fa-solid fa-rotate-left mr-2"></i>
            Chorus {index + 1}
          </button>
        ))}
      </div>

      {/* Back to Top */}
      {showBackToTop && (
        <button
          onClick={onScrollToTop}
          className="bg-gray-800 text-white w-12 h-12 rounded-full shadow-xl hover:bg-gray-900 transition-all flex items-center justify-center pointer-events-auto"
          title="Back to Top"
        >
          <i className="fa-solid fa-arrow-up"></i>
        </button>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 0.9; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default SongNavigator;