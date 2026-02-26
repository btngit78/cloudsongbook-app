
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, Song, UserRole, ViewState, UserSettings } from './types';
import { SetList } from './types';
import { MOCK_USER, MOCK_SONGS } from './constants';
import { dbService } from './services/dbService';
import { geminiService } from './services/geminiService';
import SongViewer from './components/SongViewer';
import SongForm from './components/SongForm';
import SettingsView from './components/SettingsView';
import SetlistManager from './components/SetlistManager';
import SongNavigator from './components/SongNavigator';
import { useTheme } from './hooks/useTheme';
import RecentSongsView from './components/RecentSongsView';
import AdminDashboard from './components/AdminDashboard';
import { useAuth } from './hooks/useAuth';
import { useSongs } from './hooks/useSong';
import { useSetlists } from './hooks/useSetlists';
import { useScroll } from './hooks/useScroll';
import { useTranspose } from './hooks/useTranspose';
import { Header } from './components/Header';
import { SongList } from './components/SongList';
import { useSongSearch } from './hooks/useSongSearch';

const App: React.FC = () => {
  const { 
    user, 
    showEmailForm, setShowEmailForm,
    email, setEmail,
    password, setPassword,
    isSignUp, setIsSignUp,
    authError,
    resetSent,
    verificationSent,
    handleEmailAuth,
    handleGoogleLogin,
    handleLogout,
    handlePasswordReset,
    handleUpdateSettings
  } = useAuth();

  const {
    allSongs,
    currentSong,
    selectSong,
    handleSearch,
    saveSong,
    deleteSong,
    deleteSpecificSong
  } = useSongs();

  const { searchQuery, setSearchQuery, filteredSongs } = useSongSearch(allSongs);

  const [view, setView] = useState<ViewState | 'SETLIST_MANAGER' | 'ADMIN_DASHBOARD'>('SONG_VIEW');
  const [menuOpen, setMenuOpen] = useState(false);
  const [songToEdit, setSongToEdit] = useState<Song | undefined>(undefined);
  const [isHeaderSearchActive, setIsHeaderSearchActive] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const transposeHandledRef = useRef<string>('');

  // Sync theme
  const { setTheme } = useTheme();

  const handleNavigation = (targetView: typeof view, callback?: () => void) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        return;
      }
      setHasUnsavedChanges(false);
    }
    if (callback) callback();
    setView(targetView);
    setMenuOpen(false);
  };

  const handleSelectSong = useCallback(async (songId: string) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to discard them?')) return null;
      setHasUnsavedChanges(false);
    }
    const song = await selectSong(songId);
    if (song) {
      setView('SONG_VIEW');
      setSearchQuery('');
      setIsHeaderSearchActive(false);
      return song;
    }
    return null;
  }, [selectSong, hasUnsavedChanges]);

  // Reset selection when search query changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery]);

  const {
    setlists,
    activeSetlist,
    activeSetlistIndex,
    saveSetlist,
    deleteSetlist,
    playSetlist,
    navigateSetlist,
    exitSetlist
  } = useSetlists(user, handleSelectSong);

  const handleUserSongSelect = async (songId: string) => {
    if (activeSetlist) {
      const index = activeSetlist.choices.findIndex(c => c.songId === songId);
      if (index !== -1) {
        navigateSetlist(index);
      } else {
        const result = await handleSelectSong(songId);
        if (result) {
          exitSetlist();
        }
      }
    } else {
      handleSelectSong(songId);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchQuery.length < 2) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredSongs.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && filteredSongs[selectedIndex]) {
        e.preventDefault();
        handleUserSongSelect(filteredSongs[selectedIndex].id);
      }
    }
  };

  const {
    scrollContainerRef,
    showBackToTop,
    passedChoruses,
    handleScroll,
    scrollToTop,
    scrollToChorus
  } = useScroll(currentSong);

  const {
    transpose,
    setTranspose,
    keyInfo,
    CHROMATIC_SCALE
  } = useTranspose(currentSong);

  // Handle Setlist Transpose Mode
  useEffect(() => {
    if (!currentSong || !activeSetlist || activeSetlistIndex < 0 || !keyInfo) return;
    
    const mode = user?.settings?.setlistTransposeMode || 'off';
    if (mode === 'off') return;

    const choice = activeSetlist.choices[activeSetlistIndex];
    if (!choice || !choice.key) return;

    // Ensure we are looking at the correct song (prevents race condition with setlist index)
    if (choice.songId !== currentSong.id) return;

    const currentContextId = `${currentSong.id}-${activeSetlistIndex}`;

    // If transpose is not 0, we are already transposed. Mark as handled.
    if (transpose !== 0) {
      transposeHandledRef.current = currentContextId;
      return;
    }

    // If we've already handled this song instance (e.g. user reset to 0), don't prompt again.
    if (transposeHandledRef.current === currentContextId) return;

    // Mark as handled
    transposeHandledRef.current = currentContextId;

    // Normalize target key root
    const match = choice.key.match(/^([A-G][#b]?)/);
    if (!match) return;
    
    let root = match[1];
    const flatMap: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    if (flatMap[root]) root = flatMap[root];
    
    const targetIndex = CHROMATIC_SCALE.indexOf(root);
    if (targetIndex === -1) return;
    
    const originalIndex = keyInfo.originalIndex;
    
    // If already in target key (original key matches target), do nothing
    if (originalIndex === targetIndex) return;

    let diff = targetIndex - originalIndex;
    
    // Normalize to shortest path
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;

    let timeoutId: ReturnType<typeof setTimeout>;
    if (mode === 'auto') {
      setTranspose(diff);
    } else if (mode === 'confirm') {
      // Timeout to ensure UI is stable before alert
      timeoutId = setTimeout(() => {
        if (window.confirm(`Song: ${currentSong.title}\n\nTranspose to ${choice.key} from ${keyInfo.currentKey}?`)) {
          setTranspose(diff);
        }
      }, 100);
    }
    
    return () => clearTimeout(timeoutId);
  }, [currentSong?.id, activeSetlist, activeSetlistIndex, keyInfo?.originalIndex, transpose]);

  // Sync User Settings Theme with ThemeProvider
  useEffect(() => {
    if (user?.settings.theme) {
      setTheme(user.settings.theme);
    }
  }, [user?.settings.theme, setTheme]);

  const handleSaveSong = async (songData: Partial<Song>) => {
  //  console.log("Saving song with data:", songData);
    console.log("Current user in handleSaveSong:", user);
    if (!user) {
      console.error("User not authenticated. Cannot save song.");
      return;
    }
    // Use existing ownerId if available (editing), otherwise assign to current user (creating)
    const ownerId = songData.ownerId || user.id;
    await saveSong({ ...songData, ownerId });
    setView('SONG_VIEW');
  };

  const handleDeleteSong = async () => {
    const deleted = await deleteSong();
    if (deleted) {
      setView('SONG_VIEW');
    }
  };

  const handlePlaySetlist = (setlist: SetList) => {
    playSetlist(setlist);
    setView('SONG_VIEW');
    setMenuOpen(false);
  };

  const getKeyLabel = (note: string, suffix: string) => {
    const flatMap: Record<string, string> = {
      'C#': 'Db',
      'D#': 'Eb',
      'F#': 'Gb',
      'G#': 'Ab',
      'A#': 'Bb'
    };
    if (note === 'C#') return `Db${suffix}/C#${suffix}`;
    if (note === 'F#') return `Gb${suffix}/F#${suffix}`;
    if (note === 'G#') return `Ab${suffix}/G#${suffix}`;
    if (flatMap[note]) {
      return `${flatMap[note]}${suffix}`;
    }
    return `${note}${suffix}`;
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
            {!showEmailForm ? (
              <>
                <button 
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-300 py-3 rounded-xl hover:bg-gray-50 transition-all font-semibold"
                >
                  <i className="fa-brands fa-google text-red-500"></i>
                  <span>Continue with Google</span>
                </button>
                <button 
                  onClick={() => setShowEmailForm(true)}
                  className="w-full flex items-center justify-center space-x-3 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all font-semibold"
                >
                  <i className="fa-solid fa-envelope"></i>
                  <span>Login with Email</span>
                </button>
              </>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4 text-left animate-fadeIn">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    required
                    className="w-full rounded-lg border-gray-300 bg-gray-50 p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                  <input 
                    type="password" 
                    required
                    className="w-full rounded-lg border-gray-300 bg-gray-50 p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  {!isSignUp && (
                    <div className="flex justify-end mt-1">
                      <button 
                        type="button"
                        onClick={handlePasswordReset}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>
                
                {authError && (
                  <p className="text-red-500 text-sm font-medium">{authError}</p>
                )}
                {resetSent && (
                  <p className="text-green-600 text-sm font-medium">Password reset email sent! Check your inbox.</p>
                )}
                {verificationSent && (
                  <p className="text-green-600 text-sm font-medium">Account created! Verification email sent.</p>
                )}

                <button 
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 transition-all"
                >
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </button>

                <div className="flex justify-between items-center text-sm pt-2">
                  <button type="button" onClick={() => setShowEmailForm(false)} className="text-gray-500 hover:text-gray-700">Back</button>
                  <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-blue-600 hover:text-blue-800 font-semibold">
                    {isSignUp ? 'Switch to Login' : 'Create an account'}
                  </button>
                </div>
              </form>
            )}
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
    <div className="h-screen overflow-hidden flex flex-col">
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Header */}
      <Header
        title={currentSong?.title || "CloudSongBook"}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onMenuClick={() => setMenuOpen(true)}
        isSearchActive={isHeaderSearchActive}
        onSearchActiveChange={setIsHeaderSearchActive}
        onKeyDown={handleSearchKeyDown}
        menuOpen={menuOpen}
        rightContent={
          <div className={`hidden md:flex items-center space-x-2 transition-all duration-300 ${view !== 'SONG_VIEW' ? 'blur-sm opacity-50 pointer-events-none' : ''}`}>
            {currentSong?.key && keyInfo && (
              <div 
                className={`flex items-center rounded-lg p-1 border select-none transition-all duration-300 ${
                  transpose !== 0 
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' 
                    : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                }`}
                onDoubleClick={() => setTranspose(0)}
                title={transpose !== 0 ? "Key changed. Double-click to reset." : "Original Key"}
              >
                <span className={`text-xs font-bold ml-2 mr-1 ${transpose !== 0 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-300'}`}>Key:</span>
                <div className="relative">
                  <select
                    aria-label="Transpose Key"
                    className={`appearance-none bg-transparent font-bold text-sm py-1 pl-2 pr-6 cursor-pointer focus:outline-none ${transpose !== 0 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}
                    value={keyInfo.currentKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Remove suffix to find root
                      const selectedRoot = val.replace(keyInfo!.suffix, '');
                      const targetIndex = CHROMATIC_SCALE.indexOf(selectedRoot);
                      const diff = targetIndex - keyInfo!.originalIndex;
                      setTranspose(diff);
                    }}
                  >
                    {CHROMATIC_SCALE.map((note) => (
                      <option key={note} value={note + keyInfo.suffix} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                        {getKeyLabel(note, keyInfo.suffix)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className={`flex flex-col ml-1 border-l pl-1 ${transpose !== 0 ? 'border-blue-200 dark:border-blue-700' : 'border-gray-300 dark:border-gray-600'}`}>
                  <button aria-label="Up a semitone"
                    onClick={() => setTranspose(t => t + 1)} className={`h-3 flex items-center justify-center rounded px-1 ${transpose !== 0 ? 'text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800' : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                    <i className="fa-solid fa-caret-up text-[10px]"></i>
                  </button>
                  <button aria-label="Down a semitone"
                    onClick={() => setTranspose(t => t - 1)} className={`h-3 flex items-center justify-center rounded px-1 ${transpose !== 0 ? 'text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800' : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                    <i className="fa-solid fa-caret-down text-[10px]"></i>
                  </button>
                </div>

                {transpose !== 0 && (
                  <button
                    onClick={() => setTranspose(0)}
                    className="ml-2 mr-1 w-5 h-5 flex items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200 hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors animate-in fade-in zoom-in duration-200"
                    title="Reset to Original Key"
                  >
                    <i className="fa-solid fa-rotate-left text-[10px]"></i>
                  </button>
                )}
              </div>
            )}

            <div 
              className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600 ml-2 select-none"
              onDoubleClick={() => handleUpdateSettings({ fontSize: 18 })}
              title="Double-click to reset zoom"
            >
              <span className="text-xs font-bold text-gray-500 dark:text-gray-300 ml-2 mr-1">Zoom:</span>
              <div className="relative">
                <select
                  aria-label="Font Size"
                  className="appearance-none bg-transparent font-bold text-gray-900 dark:text-white text-sm py-1 pl-2 pr-6 cursor-pointer focus:outline-none"
                  value={user.settings.fontSize}
                  onChange={(e) => handleUpdateSettings({ fontSize: parseInt(e.target.value) })}
                >
                  {[12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48].map((size) => (
                    <option key={size} value={size} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{size}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col ml-1 border-l border-gray-300 dark:border-gray-600 pl-1">
                <button 
                  aria-label="Increase Font Size"
                  onClick={() => handleUpdateSettings({ fontSize: Math.min(48, user.settings.fontSize + 2) })}
                  className="h-3 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded px-1">
                  <i className="fa-solid fa-caret-up text-[10px]"></i>
                </button>
                <button 
                  aria-label="Decrease Font Size"
                  onClick={() => handleUpdateSettings({ fontSize: Math.max(12, user.settings.fontSize - 2) })} className="h-3 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded px-1">
                  <i className="fa-solid fa-caret-down text-[10px]"></i>
                </button>
              </div>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <main 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative"
        onMouseDown={(e) => {
          // Prevent closing search when clicking on scrollbar or empty space in search results
          if (isHeaderSearchActive && searchQuery.length >= 2) {
            e.nativeEvent.stopImmediatePropagation();
          }
        }}
      >
        {searchQuery.length >= 2 ? (
          <SongList 
            songs={filteredSongs} 
            searchQuery={searchQuery}
            selectedIndex={selectedIndex}
            onSongClick={(song) => handleUserSongSelect(song.id)}
            highlightSearch={user?.settings.highlightSearch ?? false}
          />
        ) : (
          <>
        {view === 'SONG_VIEW' && currentSong && (
          <>
            <SongViewer 
              song={currentSong} 
              settings={user.settings} 
              onUpdateSettings={handleUpdateSettings}
              transpose={transpose}
              onTranspose={setTranspose}
              activeSetlist={activeSetlist}
              activeSetlistIndex={activeSetlistIndex}
              onNextSong={() => navigateSetlist('next')}
              onPrevSong={() => navigateSetlist('prev')}
              onSetlistJump={(idx) => navigateSetlist(idx)}
              onExitSetlist={exitSetlist}
              allSongs={allSongs}
              onUpdateSong={handleSaveSong}
            />
            <SongNavigator 
              showBackToTop={showBackToTop}
              passedChoruses={passedChoruses}
              onScrollToTop={scrollToTop}
              onScrollToChorus={scrollToChorus}
            />
          </>
        )}
        {view === 'SONG_FORM' && (
          <SongForm 
            song={songToEdit}
            onSave={handleSaveSong} 
            onCancel={() => setView('SONG_VIEW')} 
          />
        )}
        {view === 'RECENT_SONGS' && (
          <RecentSongsView 
            songs={allSongs.slice(0, 50)}
            onSelectSong={handleUserSongSelect}
            onEditSong={(song) => {
              setSongToEdit(song);
              setView('SONG_FORM');
            }}
            onDeleteSong={deleteSpecificSong}
            onBack={() => setView('SONG_VIEW')}
          />
        )}
        {view === 'SETLIST_MANAGER' && (
          <SetlistManager
            setlists={setlists}
            allSongs={allSongs}
            currentSong={currentSong ?? undefined}
            onSave={saveSetlist}
            onDelete={deleteSetlist}
            onPlay={handlePlaySetlist}
            onClose={() => setView('SONG_VIEW')}
            onDirtyChange={setHasUnsavedChanges}
          />
        )}
        {view === 'SETTINGS' && (
          <SettingsView 
            user={user}
            onSave={(newSettings) => {
              handleUpdateSettings(newSettings);
              setView('SONG_VIEW');
            }}
            onCancel={() => setView('SONG_VIEW')}
          />
        )}
        {view === 'ADMIN_DASHBOARD' && user && (
          <AdminDashboard
            currentUser={user}
            onBack={() => setView('SONG_VIEW')}
          />
        )}
          </>
        )}
      </main>

      {/* Burger Menu Sidebar */}
      {menuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setMenuOpen(false)}
          ></div>
          <aside className="fixed inset-y-0 left-0 w-80 bg-white dark:bg-gray-800 z-50 shadow-2xl transform transition-transform animate-slideInLeft overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-xl font-bold">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">{user.role} Member</p>
              </div>
            </div>

            <nav className="p-4 space-y-1">
              <p className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Song Management</p>
              {/* "Add New Song" for Admin and Premium */}
              {(user.role === UserRole.ADMIN || user.role === UserRole.PREMIUM) && (
                <button 
                  onClick={() => handleNavigation('SONG_FORM', () => setSongToEdit(undefined))}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <i className="fa-solid fa-plus w-6"></i>
                  <span className="font-medium">Add New Song</span>
                </button>
              )}

              {/* "Edit Current Song" for Admin (always) or Premium (if owner) */}
              {(user.role === UserRole.ADMIN || (user.role === UserRole.PREMIUM && currentSong?.ownerId === user.id)) && (
                <button 
                  onClick={() => { if (currentSong) handleNavigation('SONG_FORM', () => setSongToEdit(currentSong)); }}
                  disabled={!currentSong}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fa-solid fa-pen-to-square w-6"></i>
                  <span className="font-medium">Edit Current Song</span>
                </button>
              )}

              {/* "Delete Current Song" for Admin (always) or Premium (if owner) */}
              {(user.role === UserRole.ADMIN || (user.role === UserRole.PREMIUM && currentSong?.ownerId === user.id)) && (
                <button 
                  onClick={() => { handleDeleteSong(); setMenuOpen(false); }}
                  disabled={!currentSong}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fa-solid fa-trash w-6"></i>
                  <span className="font-medium">Delete Current Song</span>
                </button>
              )}

              <div className="my-4 border-t border-gray-100 dark:border-gray-700" />
              
              <p className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Playlists</p>
              {activeSetlist && (
                <button 
                  onClick={() => { exitSetlist(); setMenuOpen(false); }} // Exit setlist doesn't change view, just state
                  className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors mb-2"
                >
                  <i className="fa-solid fa-circle-stop w-6"></i>
                  <span className="font-medium">Exit Current Set</span>
                </button>
              )}
              <button 
                onClick={() => handleNavigation('SETLIST_MANAGER')}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-list-ul w-6"></i>
                <span className="font-medium">My Set-Lists</span>
              </button>
              <button 
                onClick={() => handleNavigation('RECENT_SONGS')}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-clock-rotate-left w-6"></i>
                <span className="font-medium">Recent 50 Additions</span>
              </button>

              <div className="my-4 border-t border-gray-100 dark:border-gray-700" />

              {user.role === UserRole.ADMIN && (
                <button 
                  onClick={() => handleNavigation('ADMIN_DASHBOARD')}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl transition-colors mb-2"
                >
                  <i className="fa-solid fa-users-gear w-6"></i>
                  <span className="font-medium">Admin Dashboard</span>
                </button>
              )}

              <p className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Account</p>
              <button 
                onClick={() => handleUpdateSettings({ theme: user.settings.theme === 'dark' ? 'light' : 'dark' })}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <i className={`fa-solid ${user.settings.theme === 'dark' ? 'fa-sun' : 'fa-moon'} w-6`}></i>
                <span className="font-medium">{user.settings.theme === 'dark' ? 'To Light Mode' : 'To Dark Mode'}</span>
              </button>
              <button 
                onClick={() => handleNavigation('SETTINGS')}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-user-gear w-6"></i>
                <span className="font-medium">Profile & Settings</span>
              </button>
              <button 
                onClick={() => {
                  if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Are you sure you want to discard them?')) return;
                  handleLogout();
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-right-from-bracket w-6"></i>
                <span className="font-medium">Logout</span>
              </button>
            </nav>
          </aside>
        </>
      )}
      </div>
    </div>
  );
};

export default App;
