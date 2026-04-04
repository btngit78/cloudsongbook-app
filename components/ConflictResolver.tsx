import React from 'react';
import { Song, SetList, SongChoice } from '../types';

interface ConflictResolverProps {
  type: 'song' | 'setlist';
  local: any;
  remote: any;
  allSongs: Song[];
  onResolve: (version: 'local' | 'remote') => void;
  onCancel: () => void;
}

const ConflictResolver: React.FC<ConflictResolverProps> = ({ type, local, remote, allSongs, onResolve, onCancel }) => {
  const getSongTitle = (id: string) => allSongs.find(s => s.id === id)?.title || 'Unknown Song';

  const renderDiffItem = (label: string, localVal: any, remoteVal: any) => {
    const isDifferent = JSON.stringify(localVal) !== JSON.stringify(remoteVal);
    return (
      <div className={`grid grid-cols-2 gap-4 py-2 border-b border-gray-100 dark:border-gray-700 ${isDifferent ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
        <div className="px-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{String(localVal || '-')}</p>
        </div>
        <div className="px-4 border-l border-gray-100 dark:border-gray-700">
          <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{String(remoteVal || '-')}</p>
        </div>
      </div>
    );
  };

  const renderDiffBody = (text: string, otherText: string, isLocal: boolean) => {
    const lines = text.split('\n');
    const otherLines = new Set(otherText.split('\n'));

    return (
      <div className={`flex-1 text-xs font-mono p-4 overflow-y-auto whitespace-pre ${isLocal ? 'bg-gray-50 dark:bg-gray-900/50' : 'bg-blue-50/30 dark:bg-blue-900/20'}`}>
        {lines.map((line, i) => {
          const isDifferent = !otherLines.has(line);
          const highlightClass = isDifferent 
            ? (isLocal 
                ? 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 -mx-4 px-4 border-l-4 border-green-500' 
                : 'bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100 -mx-4 px-4 border-l-4 border-red-500') 
            : (isLocal ? '' : 'text-blue-800 dark:text-blue-300');
          
          return (
            <div key={i} className={`min-h-[1.25rem] ${highlightClass}`}>
              {line || ' '}
            </div>
          );
        })}
      </div>
    );
  };

  const renderContentDiff = () => {
    if (type === 'song') {
      const sLocal = local as Song;
      const sRemote = remote as Song;
      return (
        <div className="grid grid-cols-2 gap-4 h-[400px]">
          <div className="flex flex-col">
            <p className="text-xs font-bold text-gray-500 mb-2 px-4 uppercase">Your Version (Lyrics)</p>
            {renderDiffBody(sLocal.body, sRemote.body, true)}
          </div>
          <div className="flex flex-col border-l border-gray-200 dark:border-gray-700">
            <p className="text-xs font-bold text-blue-500 mb-2 px-4 uppercase">Database Version (Lyrics)</p>
            {renderDiffBody(sRemote.body, sLocal.body, false)}
          </div>
        </div>
      );
    } else {
      const lLocal = local as SetList;
      const lRemote = remote as SetList;
      const renderList = (choices: SongChoice[], isRemote: boolean) => (
        <div className={`flex-1 overflow-y-auto p-4 ${isRemote ? 'bg-blue-50/30 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
          <p className={`text-xs font-bold mb-4 uppercase ${isRemote ? 'text-blue-500' : 'text-gray-500'}`}>
            {isRemote ? 'Database Version' : 'Your Version'} ({choices.length} songs)
          </p>
          {choices.map((c, i) => (
            <div key={i} className="text-xs py-1 flex gap-2">
              <span className="text-gray-400 w-4">{i + 1}.</span>
              <span className={`font-medium ${isRemote ? 'text-blue-800 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>
                {getSongTitle(c.songId)} {c.key && `[${c.key}]`}
              </span>
            </div>
          ))}
        </div>
      );
      return (
        <div className="grid grid-cols-2 gap-0 h-[400px] border-t border-gray-200 dark:border-gray-700">
          {renderList(lLocal.choices, false)}
          {renderList(lRemote.choices, true)}
        </div>
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-300">
              <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Save Conflict Detected</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Another user updated this {type} while you were editing. Compare the changes below and choose which version to keep.
              </p>
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <div className="overflow-hidden">
          {type === 'song' ? (
            <>
              {renderDiffItem('Title', local.title, remote.title)}
              {renderDiffItem('Authors', local.authors, remote.authors)}
              {renderDiffItem('Key', local.key, remote.key)}
              {renderDiffItem('Tempo', local.tempo, remote.tempo)}
              {renderDiffItem('Language', local.language, remote.language)}
            </>
          ) : (
            renderDiffItem('Setlist Name', local.name, remote.name)
          )}
          {renderContentDiff()}
        </div>

        {/* Actions */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            Cancel & Keep Editing
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={() => onResolve('remote')}
              className="px-6 py-2 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 font-bold rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
            >
              Discard My Changes & Use Database Version
            </button>
            <button
              onClick={() => onResolve('local')}
              className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
            >
              Overwrite Database with My Changes
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-8 px-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 w-2 h-2 rounded-full bg-gray-400"></div>
          <p className="text-xs text-gray-500">
            <strong>Your Version:</strong> Includes all edits you just made in the form.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1 w-2 h-2 rounded-full bg-blue-500"></div>
          <p className="text-xs text-gray-500">
            <strong>Database Version:</strong> The version saved by someone else at{' '}
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {new Date(remote.updatedAt).toLocaleTimeString()}
            </span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;