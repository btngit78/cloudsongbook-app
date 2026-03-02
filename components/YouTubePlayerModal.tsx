import React, { useState } from 'react';
import { useDraggable } from '../hooks/useDraggable';

interface YouTubePlayerModalProps {
  videoIds: string[];
  onClose: () => void;
}

const YouTubePlayerModal: React.FC<YouTubePlayerModalProps> = ({ videoIds, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const getInitialPosition = () => {
    const width = window.innerWidth;
    const modalWidth = width >= 768 ? 384 : 320;
    return { x: Math.max(20, width - modalWidth - 30), y: 100 };
  };

  const { position, modalRef, startDrag } = useDraggable(getInitialPosition());

  return (
    <div 
      ref={modalRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 md:w-96 animate-fadeIn overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        className="p-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 cursor-move bg-gray-50 dark:bg-gray-700/50 rounded-t-xl"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 ml-2 select-none flex items-center gap-2">
          <i className="fa-brands fa-youtube text-red-600"></i>
          <span>({currentIndex + 1}/{videoIds.length})</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <i className={`fa-solid ${isMinimized ? 'fa-expand' : 'fa-minus'} text-xs`}></i>
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Close"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      </div>
      {!isMinimized && (
        <>
          <div className="aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoIds[currentIndex]}?autoplay=1&rel=0`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>
          {videoIds.length > 1 && (
            <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-1 pointer-events-none">
              <button
                onClick={() => setCurrentIndex(prev => (prev - 1 + videoIds.length) % videoIds.length)}
                className="bg-black/30 text-white w-8 h-8 rounded-full hover:bg-black/50 transition-colors pointer-events-auto flex items-center justify-center"
                title="Previous Video"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <button
                onClick={() => setCurrentIndex(prev => (prev + 1) % videoIds.length)}
                className="bg-black/30 text-white w-8 h-8 rounded-full hover:bg-black/50 transition-colors pointer-events-auto flex items-center justify-center"
                title="Next Video"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default YouTubePlayerModal;