import React, { useState } from 'react';
import { Song } from '../types';
import { useDraggable } from '../hooks/useDraggable';

interface FixLinkModalProps {
  song: Song;
  brokenLinkIds: string[];
  validVideoIds: string[];
  onClose: () => void;
  onUpdateSong: (song: Partial<Song>) => void;
  onShowYouTube: () => void;
}

const FixLinkModal: React.FC<FixLinkModalProps> = ({
  song,
  brokenLinkIds,
  validVideoIds,
  onClose,
  onUpdateSong,
  onShowYouTube,
}) => {
  const [fixLinkUrl, setFixLinkUrl] = useState('');
  const { position, modalRef, startDrag } = useDraggable({ x: 20, y: 100 });

  const extractYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const handleRemoveLink = () => {
    const newBody = song.body.split('\n').filter(line => {
      if (!line.trim().startsWith('#')) return true;
      return !brokenLinkIds.some(id => line.includes(id));
    }).join('\n');
    onUpdateSong({ ...song, body: newBody });
    onClose();
  };

  const handleReplaceLink = () => {
    const newId = extractYouTubeId(fixLinkUrl);
    if (newId && brokenLinkIds.length > 0) {
      const oldId = brokenLinkIds[0];
      const newBody = song.body.replace(oldId, newId);
      onUpdateSong({ ...song, body: newBody });
      onClose();
      setFixLinkUrl('');
    } else {
      alert("Invalid YouTube URL");
    }
  };

  const handleIgnoreAndWatch = () => {
    onClose();
    onShowYouTube();
  };

  return (
    <div
      ref={modalRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 md:w-96 animate-fadeIn overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="p-3 border-b border-gray-200 dark:border-gray-700 cursor-move bg-gray-50 dark:bg-gray-700/50 rounded-t-xl flex justify-between items-center"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 select-none">
          <i className="fa-solid fa-wrench text-amber-500"></i>
          Fix Broken Link
        </h3>
        <button
          title="Close"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <p className="mb-2">A YouTube link in this song is unavailable.</p>
          <button
            onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.authors)}`, '_blank')}
            className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-bold flex items-center gap-1"
          >
            <i className="fa-brands fa-youtube"></i> Search for replacement
          </button>
        </div>

        <input
          type="text"
          value={fixLinkUrl}
          onChange={(e) => setFixLinkUrl(e.target.value)}
          placeholder="Paste new YouTube URL here..."
          className="w-full text-sm p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          autoFocus
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={handleRemoveLink}
            className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          >
            Remove Link
          </button>
          <button
            onClick={handleReplaceLink}
            disabled={!fixLinkUrl}
            className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Replace
          </button>
        </div>

        {validVideoIds.length > 0 && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 text-center">
            <button
              onClick={handleIgnoreAndWatch}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Ignore and watch valid videos ({validVideoIds.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FixLinkModal;