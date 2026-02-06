
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Song, UserRole, ViewState, UserSettings } from './types';
import { MOCK_USER, MOCK_SONGS } from './constants';
import { dbService } from './services/dbService';
import { geminiService } from './services/geminiService';
import SongViewer from './components/SongViewer';
import SongForm from './components/SongForm';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [view, setView] = useState<ViewState>('SONG_VIEW');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);

  // Initialize App
  useEffect(() => {
    const init = async () => {
      // Check auth (mock)
      const storedUser = localStorage.getItem('cloudsong_user');
      if (storedUser) setUser(JSON.parse(storedUser));

      const songs = await dbService.getSongs();
      setAllSongs(songs);

      const recent = dbService.getRecentCache();
      if (recent.length > 0) {
        setCurrentSong(recent[0]);
      } else if (songs.length > 0) {
        setCurrentSong(songs[0]);
      }
    };
    init();
  }, []);

  const handleLogin = (role: UserRole = UserRole.FREE) => {
    const newUser = { ...MOCK_USER, role };
    setUser(newUser);
    localStorage.setItem('cloudsong_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cloudsong_user');
  };

  const selectSong = async (songId: string) => {
    const song = await dbService.getSong(songId);
    if (song) {
      setCurrentSong(song);
      setView('SONG_VIEW');
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleSaveSong = async (songData: Partial<Song>) => {
    const saved = await dbService.saveSong(songData);
    const updatedSongs = await dbService.getSongs();
    setAllSongs(updatedSongs);
    setCurrentSong(saved);
    setView('SONG_VIEW');
  };

  const handleDeleteSong = async () => {
    if (currentSong && window.confirm(`Delete "${currentSong.title}"?`)) {
      await dbService.deleteSong(currentSong.id);
      const songs = await dbService.getSongs();
      setAllSongs(songs);
      setCurrentSong(songs[0] || null);
      setView('SONG_VIEW');
    }
  };

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    if (user) {
      const updatedUser = {
        ...user,
        settings: { ...user.settings, ...newSettings }
      };
      setUser(updatedUser);
      localStorage.setItem('cloudsong_user', JSON.stringify(updatedUser));
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim() === '') {
      setSearchResults([]);
    } else {
      const filtered = allSongs.filter(s => 
        s.title.toLowerCase().includes(q.toLowerCase()) || 
        s.author.toLowerCase().includes(q.toLowerCase())
      );
      setSearchResults(filtered);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
          <div className="mb-6">
            <i className="fa-solid fa-music text-blue-600 text-6xl"></i>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">CloudSongBook</h1>
          <p className="text-gray-500 mb-8">Your digital stage companion</p>
          <div className="space-y-4">
            <button 
              onClick={() => handleLogin(UserRole.PREMIUM)}
              className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-300 py-3 rounded-xl hover:bg-gray-50 transition-all font-semibold"
            >
              <i className="fa-brands fa-google text-red-500"></i>
              <span>Continue with Google</span>
            </button>
            <button 
              onClick={() => handleLogin(UserRole.FREE)}
              className="w-full flex items-center justify-center space-x-3 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all font-semibold"
            >
              <i className="fa-solid fa-envelope"></i>
              <span>Login with Email</span>
            </button>
            <div className="pt-6 border-t border-gray-100 flex justify-between text-xs text-gray-400">
              <a href="#" className="hover:text-blue-600">Privacy Policy</a>
              <a href="#" className="hover:text-blue-600">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 sticky top-0 z-30 flex items-center px-4 md:px-6 shadow-sm">
        <button 
          onClick={() => setMenuOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <i className="fa-solid fa-bars text-xl text-gray-700"></i>
        </button>

        <div className="flex-1 mx-4 flex items-center overflow-hidden">
          {searchOpen ? (
            <div className="relative w-full max-w-lg">
              <input
                autoFocus
                type="text"
                placeholder="Search songs..."
                className="w-full py-2 pl-4 pr-10 rounded-xl bg-gray-100 border-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchQuery}
                onChange={handleSearch}
                onBlur={() => !searchQuery && setSearchOpen(false)}
              />
              <button className="absolute right-3 top-2 text-gray-400">
                <i className="fa-solid fa-magnifying-glass"></i>
              </button>
              {searchResults.length > 0 && (
                <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {searchResults.slice(0, 5).map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectSong(s.id)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 flex flex-col"
                    >
                      <span className="font-bold text-gray-900">{s.title}</span>
                      <span className="text-sm text-gray-500">{s.author}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={() => setSearchOpen(true)}
              className="flex-1 flex items-center justify-between cursor-pointer group"
            >
              <h2 className="text-lg font-semibold text-gray-900 truncate max-w-[200px] md:max-w-md">
                {currentSong?.title || "Select a Song"}
              </h2>
              <i className="fa-solid fa-magnifying-glass text-gray-400 group-hover:text-blue-600 transition-colors ml-4"></i>
            </div>
          )}
        </div>

        {/* Extra Info Area */}
        <div className="hidden md:flex items-center space-x-4 text-xs font-medium text-gray-400">
          <span className="bg-gray-100 px-2 py-1 rounded">KEY: G</span>
          <span className="bg-gray-100 px-2 py-1 rounded">BPM: 120</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {view === 'SONG_VIEW' && currentSong && (
          <SongViewer 
            song={currentSong} 
            settings={user.settings} 
            onUpdateSettings={handleUpdateSettings}
          />
        )}
        {view === 'SONG_FORM' && (
          <SongForm 
            onSave={handleSaveSong} 
            onCancel={() => setView('SONG_VIEW')} 
          />
        )}
        {view === 'RECENT_SONGS' && (
          <div className="max-w-4xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">Recently Added (Last 50)</h2>
            <div className="grid gap-4">
              {allSongs.slice(0, 50).map(s => (
                <button 
                  key={s.id} 
                  onClick={() => selectSong(s.id)}
                  className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center hover:shadow-md transition-shadow"
                >
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{s.title}</p>
                    <p className="text-sm text-gray-500">{s.author}</p>
                  </div>
                  <i className="fa-solid fa-chevron-right text-gray-300"></i>
                </button>
              ))}
            </div>
          </div>
        )}
        {view === 'SETTINGS' && (
          <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-gray-100 mt-8">
            <h2 className="text-2xl font-bold mb-6">User Settings</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Font Size ({user.settings.fontSize}px)</label>
                <input 
                  type="range" min="12" max="32" 
                  value={user.settings.fontSize}
                  onChange={(e) => handleUpdateSettings({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Show Chords</span>
                <button 
                  onClick={() => handleUpdateSettings({ showChords: !user.settings.showChords })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${user.settings.showChords ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform ${user.settings.showChords ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">User ID: {user.id}</p>
                <p className="text-xs text-gray-400">Account Type: <span className="uppercase font-bold text-blue-600">{user.role}</span></p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Burger Menu Sidebar */}
      {menuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setMenuOpen(false)}
          ></div>
          <aside className="fixed inset-y-0 left-0 w-80 bg-white z-50 shadow-2xl transform transition-transform animate-slideInLeft overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 uppercase font-semibold">{user.role} Member</p>
              </div>
            </div>

            <nav className="p-4 space-y-1">
              <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Song Management</p>
              <button 
                onClick={() => { setView('SONG_FORM'); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-plus w-6"></i>
                <span className="font-medium">Add New Song</span>
              </button>
              <button 
                onClick={() => { setView('SONG_FORM'); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-pen-to-square w-6"></i>
                <span className="font-medium">Edit Current Song</span>
              </button>
              <button 
                onClick={() => { handleDeleteSong(); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-trash w-6"></i>
                <span className="font-medium">Delete Current Song</span>
              </button>

              <div className="my-4 border-t border-gray-100" />
              
              <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Playlists</p>
              <button className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors">
                <i className="fa-solid fa-list-ul w-6"></i>
                <span className="font-medium">My Set-Lists</span>
              </button>
              <button 
                onClick={() => { setView('RECENT_SONGS'); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-clock-rotate-left w-6"></i>
                <span className="font-medium">Recent 50 Additions</span>
              </button>

              <div className="my-4 border-t border-gray-100" />

              <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Account</p>
              <button 
                onClick={() => { setView('SETTINGS'); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-user-gear w-6"></i>
                <span className="font-medium">Profile & Settings</span>
              </button>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-right-from-bracket w-6"></i>
                <span className="font-medium">Logout</span>
              </button>
            </nav>
          </aside>
        </>
      )}
    </div>
  );
};

export default App;
