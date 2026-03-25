import React, { useState, useEffect, useRef } from 'react';
import { calculateLinesPer10Seconds } from '../utils/scrollUtils';

interface SongNavigatorProps {
  sectionLabels: string[];
  onScrollToTop: () => void;
  onScrollToLabel: (label: string) => void;
  isScrolling: boolean;
  onToggleScroll: () => void;
  scrollSpeedValue: number;
  onScrollSpeedChange: (value: number) => void;
}

const SongNavigator: React.FC<SongNavigatorProps> = ({
  sectionLabels,
  onScrollToTop,
  onScrollToLabel,
  isScrolling,
  onToggleScroll,
  scrollSpeedValue,
  onScrollSpeedChange,
}) => {
  const [pulsingIndex, setPulsingIndex] = useState<number | null>(null);
  const resumeScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pulsingIndex !== null) {
      const timer = setTimeout(() => setPulsingIndex(null), 500);
      return () => clearTimeout(timer);
    }
  }, [pulsingIndex]);

  useEffect(() => {
    return () => {
      if (resumeScrollTimerRef.current) clearTimeout(resumeScrollTimerRef.current);
    };
  }, []);

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

  const getFormattedSpeed = (sliderValue: number) => {
    return calculateLinesPer10Seconds(sliderValue).toFixed(1);
  };

  const handleSectionClick = (label: string, index: number) => {
    setPulsingIndex(index);
    
    if (isScrolling) {
      onToggleScroll(); // Pause scrolling
      onScrollToLabel(label); // Jump to section
      
      if (resumeScrollTimerRef.current) clearTimeout(resumeScrollTimerRef.current);
      // Resume scrolling after 1 second (approx time for smooth scroll to settle)
      resumeScrollTimerRef.current = setTimeout(() => {
        onToggleScroll();
        resumeScrollTimerRef.current = null;
      }, 1000);
    } else {
      onScrollToLabel(label);
    }
  };

  const handleBackToTop = () => {
    if (isScrolling) {
      onToggleScroll(); // Pause scrolling
      onScrollToTop(); // Jump to top
      
      if (resumeScrollTimerRef.current) clearTimeout(resumeScrollTimerRef.current);
      // Resume scrolling after 1 second
      resumeScrollTimerRef.current = setTimeout(() => {
        onToggleScroll();
        resumeScrollTimerRef.current = null;
      }, 1000);
    } else {
      onScrollToTop();
    }
  };

  return (
    <div className="fixed right-6 bottom-6 flex flex-col items-end space-y-3 z-40 pointer-events-none">
      {/* Scroll Controls */}
      <div className="pointer-events-auto flex flex-col items-center gap-1 p-2 bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 animate-fadeIn">
        {isScrolling && (
          <div className="h-28 w-6 flex items-center justify-center mb-1 animate-in slide-in-from-bottom-2 fade-in duration-200 relative group">
            <div className="absolute right-full mr-2 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {getFormattedSpeed(scrollSpeedValue)} lines/10s
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={scrollSpeedValue}
              onChange={(e) => onScrollSpeedChange(parseInt(e.target.value))}
              className="w-24 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer -rotate-90 origin-center accent-blue-600 hover:accent-blue-500 focus:outline-none"
              title={`Adjust speed (${getFormattedSpeed(scrollSpeedValue)} lines/10s)`}
            />
          </div>
        )}
        <button
          onClick={onToggleScroll}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${isScrolling ? 'bg-green-500 text-white shadow-green-500/30' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
          title={isScrolling ? "Stop Auto-Scroll (Space)" : "Start Auto-Scroll (Space)"}
        >
          <i className={`fa-solid ${isScrolling ? 'fa-pause' : 'fa-play'} text-sm`}></i>
        </button>
      </div>

      {/* Section Stack */}
      <div className="flex flex-col items-end space-y-2 pointer-events-auto">
        {sectionLabels.map((el, index) => {
          const isChorus = el.toLowerCase().startsWith('chorus');
          const isPulsing = index === pulsingIndex;
          return (
            <div key={index} className="animate-fadeIn flex">
              <button
                onClick={() => handleSectionClick(el, index)}
                className={`bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg transition-all flex items-center ${isPulsing ? 'animate-pulse-custom ring-2 ring-white dark:ring-gray-900' : 'opacity-90 hover:opacity-100'}`}
                title={`Jump to ` +  el}
              >
                <i className={`fa-solid ${getIconClass(el)} mr-2`}></i>
                  {el}
              </button>
            </div>
          );
        })}
      </div>

      {/* Back to Top */}
      <button
        onClick={handleBackToTop}
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