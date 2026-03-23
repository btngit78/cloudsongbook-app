import React, { useState, useEffect } from 'react';

interface SongNavigatorProps {
  sectionLabels: string[];
  onScrollToTop: () => void;
  onScrollToChorus: (index: number) => void;
}

const SongNavigator: React.FC<SongNavigatorProps> = ({
  sectionLabels,
  onScrollToTop,
  onScrollToChorus,
}) => {
  const [pulsingIndex, setPulsingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (pulsingIndex !== null) {
      const timer = setTimeout(() => setPulsingIndex(null), 500);
      return () => clearTimeout(timer);
    }
  }, [pulsingIndex]);

  const getIconClass = (label: string | undefined) => {
    const l = label?.toLowerCase() || '';
    if (l.startsWith('coda')) return 'fa-forward';
    if (l.startsWith('verse')) return 'fa-align-left';
    if (l.startsWith('bridge')) return 'fa-link';
    if (l.startsWith('intro')) return 'fa-play';
    if (l.startsWith('pre-chorus')) return 'fa-arrow-turn-up';
    if (l.startsWith('instrumental')) return 'fa-music';
    return 'fa-rotate-left'; // Default / Chorus
  };

  return (
    <div className="fixed right-6 bottom-6 flex flex-col items-end space-y-3 z-40 pointer-events-none">
      {/* Chorus Stack */}
      <div className="flex flex-col items-end space-y-2 pointer-events-auto">
        {sectionLabels.map((_, index) => {
          const isPulsing = index === pulsingIndex;
          return (
            <div key={index} className="animate-fadeIn flex">
              <button
                onClick={() => {
                  setPulsingIndex(index);
                  onScrollToChorus(index);
                }}
                className={`bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg transition-all flex items-center ${isPulsing ? 'animate-pulse-custom ring-2 ring-white dark:ring-gray-900' : 'opacity-90 hover:opacity-100'}`}
                title={`Jump to section`}             >
                <i className={`fa-solid ${getIconClass(sectionLabels[index])} mr-2`}></i>
                {sectionLabels[index] || `Chorus ${index + 1}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Back to Top */}
      <button
        onClick={onScrollToTop}
        className="bg-gray-800 text-white dark:bg-white dark:text-gray-900 w-12 h-12 rounded-full shadow-xl hover:bg-gray-900 dark:hover:bg-gray-200 transition-all flex items-center justify-center pointer-events-auto animate-fadeIn"
        title="Back to Top"
      >
        <i className="fa-solid fa-chevron-up text-xl"></i>
      </button>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseCustom {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.15); filter: brightness(1.2); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .animate-pulse-custom {
          animation: pulseCustom 0.25s ease-in-out 2;
          animation: pulseCustom 0.25s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default SongNavigator;