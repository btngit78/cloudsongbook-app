
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { useTheme } from './components/useTheme';
import RecentSongsView from './components/RecentSongsView';
import AdminDashboard from './components/AdminDashboard';
import { auth, googleProvider } from './firebaseConfig';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { sendEmailVerification } from 'firebase/auth';

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [view, setView] = useState<ViewState | 'SETLIST_MANAGER' | 'ADMIN_DASHBOARD'>('SONG_VIEW');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [transpose, setTranspose] = useState(0);
  const [songToEdit, setSongToEdit] = useState<Song | undefined>(undefined);

  // Email Auth State
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  // Navigation State
  const scrollContainerRef = useRef<HTMLElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [passedChoruses, setPassedChoruses] = useState<number[]>([]);

  // Setlist State
  const [setlists, setSetlists] = useState<SetList[]>([]);
  const [activeSetlist, setActiveSetlist] = useState<SetList | null>(null);
  const [activeSetlistIndex, setActiveSetlistIndex] = useState(0);

  // Sync theme
  const { setTheme } = useTheme();

  // Initialize App
  useEffect(() => {
    const init = async () => {
      // Check auth (mock)
      const storedUser = localStorage.getItem('cloudsong_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        // Load Setlists for this user from DB
        const userSetlists = await dbService.getSetlists(parsedUser.id);
        setSetlists(userSetlists);
      }

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

  // Sync User Settings Theme with ThemeProvider
  useEffect(() => {
    if (user?.settings.theme) {
      setTheme(user.settings.theme);
    }
  }, [user?.settings.theme, setTheme]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetSent(false);
    setVerificationSent(false);
    
    if (!email || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    try {
      let firebaseUser;
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = userCredential.user;
        await sendEmailVerification(firebaseUser);
        setVerificationSent(true);
        setIsSignUp(false); // Switch to login view to show message
        return; // Stop here to let user verify email before logging in
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = userCredential.user;
        if (!firebaseUser.emailVerified) {
          setAuthError("Please verify your email to log in. Check your inbox for the verification link.");
          // Sign out the user from the Firebase client instance to prevent a dangling session.
          await auth.signOut();
          return;
        }
      }

      const newUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || email.split('@')[0],
        email: firebaseUser.email || '',
        role: UserRole.FREE,
        settings: { ...MOCK_USER.settings }
      };

      const syncedUser = await dbService.syncUser(newUser);
      setUser(syncedUser);
      localStorage.setItem('cloudsong_user', JSON.stringify(syncedUser));
      
      const userSetlists = await dbService.getSetlists(syncedUser.id);
      setSetlists(userSetlists);
      
    } catch (error: any) {
      console.error('Email Auth Failed:', error);
      let msg = "Authentication failed.";
      if (error.code === 'auth/invalid-credential') msg = "Invalid email or password.";
      if (error.code === 'auth/email-already-in-use') msg = "Email already in use.";
      if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
      setAuthError(msg);
    }
  };

  const handlePasswordReset = async () => {
    setAuthError(null);
    setResetSent(false);
    if (!email) {
      setAuthError("Please enter your email address first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (error: any) {
      console.error('Password Reset Failed:', error);
      let msg = "Failed to send reset email.";
      if (error.code === 'auth/user-not-found') msg = "No user found with this email.";
      if (error.code === 'auth/invalid-email') msg = "Invalid email address.";
      setAuthError(msg);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      // Map Firebase user to your App's User type
      const newUser: User = {
        id: firebaseUser.uid, // Use Firebase's unique ID
        name: firebaseUser.displayName || 'New User',
        email: firebaseUser.email || '',
        role: UserRole.FREE, // Default role for new users
        settings: {
          ...MOCK_USER.settings, // Start with default settings
        }
      };

      const syncedUser = await dbService.syncUser(newUser);
      setUser(syncedUser);
      localStorage.setItem('cloudsong_user', JSON.stringify(syncedUser));
      
      // Fetch user's setlists
      const userSetlists = await dbService.getSetlists(syncedUser.id);
      setSetlists(userSetlists);
    } catch (error) {
      console.error('Google Login Failed:', error);
    }
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
      setTranspose(0);
      setSearchOpen(false);
      setSearchQuery('');
      // Note: We don't clear activeSetlist here to allow "browsing" while in a set, unless we want strict mode.
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

  const handleDeleteSpecificSong = async (song: Song) => {
    if (window.confirm(`Delete "${song.title}"?`)) {
      await dbService.deleteSong(song.id);
      const songs = await dbService.getSongs();
      setAllSongs(songs);
      if (currentSong?.id === song.id) {
        setCurrentSong(songs[0] || null);
      }
    }
  };

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const updatedUser = {
        ...prevUser,
        settings: { ...prevUser.settings, ...newSettings }
      };
      console.log('Updated user:', updatedUser);
      dbService.updateUserSettings(prevUser.id, newSettings);
      localStorage.setItem('cloudsong_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim() === '') {
      setSearchResults([]);
    } else {
      const filtered = allSongs.filter(s => 
        s.title.toLowerCase().includes(q.toLowerCase()) || 
        s.authors.toLowerCase().includes(q.toLowerCase())
      );
      setSearchResults(filtered);
    }
  };

  const keyInfo = useMemo(() => {
    if (!currentSong?.key) return null;
    
    let root = currentSong.key;
    let suffix = '';
    
    const match = currentSong.key.match(/^([A-G][#b]?)(.*)/);
    if (match) {
      root = match[1];
      suffix = match[2];
    }

    if (FLAT_MAP[root]) root = FLAT_MAP[root];
    const originalIndex = CHROMATIC_SCALE.indexOf(root);
    
    if (originalIndex === -1) return null;

    let currentIndex = (originalIndex + transpose) % 12;
    if (currentIndex < 0) currentIndex += 12;

    return {
      originalIndex,
      currentIndex,
      currentKey: CHROMATIC_SCALE[currentIndex] + suffix,
      suffix,
      root
    };
  }, [currentSong, transpose]);

  // Setlist Handlers
  const handleSaveSetlist = (setlist: SetList) => {
    const existingIdx = setlists.findIndex(s => s.id === setlist.id);
    let newSetlists;
    if (existingIdx >= 0) {
      newSetlists = [...setlists];
      newSetlists[existingIdx] = setlist;
    } else {
      newSetlists = [...setlists, setlist];
    }
    setSetlists(newSetlists);
    if (user) dbService.saveSetlist(setlist, user.id);
  };

  const handleDeleteSetlist = (id: string) => {
    const newSetlists = setlists.filter(s => s.id !== id);
    setSetlists(newSetlists);
    dbService.deleteSetlist(id);
    if (activeSetlist?.id === id) setActiveSetlist(null);
  };

  const handlePlaySetlist = (setlist: SetList) => {
    setActiveSetlist(setlist);
    setActiveSetlistIndex(0);
    if (setlist.songIds.length > 0) {
      selectSong(setlist.songIds[0]);
    }
    setView('SONG_VIEW');
    setMenuOpen(false);
  };

  const handleSetlistNav = (direction: 'next' | 'prev' | number) => {
    if (!activeSetlist) return;
    let newIndex = activeSetlistIndex;
    
    if (direction === 'next') newIndex++;
    else if (direction === 'prev') newIndex--;
    else newIndex = direction;

    if (newIndex >= 0 && newIndex < activeSetlist.songIds.length) {
      setActiveSetlistIndex(newIndex);
      selectSong(activeSetlist.songIds[newIndex]);
    }
  };

  const handleExitSetlist = () => {
    setActiveSetlist(null);
    setActiveSetlistIndex(0);
  };

  // Scroll Handling
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
   
    const scrollTop = scrollContainerRef.current.scrollTop;
    
    setShowBackToTop(scrollTop > 300);

    const passed: number[] = [];
    // Check for up to 4 choruses
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`chorus-${i}`);
      if (!el) break;
      
      // If the chorus is scrolled out of view (top + height < scroll + offset)
      // We use a buffer (100px) to determine when it's "passed"
      if (el.offsetTop + el.offsetHeight < scrollTop + 100) {
        passed.push(i);
      }
    }
    
    setPassedChoruses(prev => {
      if (prev.length !== passed.length) return passed;
      return prev.every((val, idx) => val === passed[idx]) ? prev : passed;
    });
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToChorus = (index: number) => {
    const el = document.getElementById(`chorus-${index}`);
    if (el && scrollContainerRef.current) {
      // Scroll to element minus header height (approx 100px buffer)
      scrollContainerRef.current.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
    }
  };

  // Reset scroll on song change
  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    setShowBackToTop(false);
    setPassedChoruses([]);
  }, [currentSong]);

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
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 sticky top-0 z-30 flex items-center px-4 md:px-6 shadow-sm transition-colors">
        <button 
          aria-label="Open Menu"
          onClick={() => setMenuOpen(true)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <i className="fa-solid fa-bars text-xl text-gray-700 dark:text-gray-200"></i>
        </button>

        <div className={`flex-1 mx-4 flex items-center overflow-hidden transition-all duration-300 ${view !== 'SONG_VIEW' ? 'blur-sm opacity-50 pointer-events-none' : ''}`}>
          {searchOpen ? (
            <div className="relative w-full max-w-lg">
              <input
                autoFocus
                type="text"
                placeholder="Search songs..."
                className="w-full py-2 pl-4 pr-10 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white border-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-500 dark:placeholder-gray-400"
                value={searchQuery}
                onChange={handleSearch}
                onBlur={() => !searchQuery && setSearchOpen(false)}
              />
              <button aria-label="Search" 
                className="absolute right-3 top-2 text-gray-400">
                <i className="fa-solid fa-magnifying-glass"></i>
              </button>
              {searchResults.length > 0 && (
                <div className="absolute top-12 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {searchResults.slice(0, 5).map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectSong(s.id)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700 flex flex-col"
                    >
                      <span className="font-bold text-gray-900 dark:text-gray-100">{s.title}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{s.authors}</span>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[200px] md:max-w-md">
                {currentSong?.title || "Select a Song"}
              </h2>
              <i className="fa-solid fa-magnifying-glass text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ml-4"></i>
            </div>
          )}
        </div>

        {/* Extra Info Area */}
        <div className={`hidden md:flex items-center space-x-2 transition-all duration-300 ${view !== 'SONG_VIEW' ? 'blur-sm opacity-50 pointer-events-none' : ''}`}>
          {currentSong?.key && keyInfo && (
            <div 
              className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600 select-none"
              onDoubleClick={() => setTranspose(0)}
              title="Double-click to reset key"
            >
              <span className="text-xs font-bold text-gray-500 dark:text-gray-300 ml-2 mr-1">Key:</span>
              <div className="relative">
                <select
                  aria-label="Transpose Key"
                  className="appearance-none bg-transparent font-bold text-gray-700 dark:text-gray-200 text-sm py-1 pl-2 pr-6 cursor-pointer focus:outline-none"
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
                    <option key={note} value={note + keyInfo.suffix}>
                      {note + keyInfo.suffix}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col ml-1 border-l border-gray-300 dark:border-gray-600 pl-1">
                <button aria-label="Up a semitone"
                  onClick={() => setTranspose(t => t + 1)} className="h-3 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded px-1">
                  <i className="fa-solid fa-caret-up text-[10px]"></i>
                </button>
                <button aria-label="Down a semitone"
                  onClick={() => setTranspose(t => t - 1)} className="h-3 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded px-1">
                  <i className="fa-solid fa-caret-down text-[10px]"></i>
                </button>
              </div>
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
                className="appearance-none bg-transparent font-bold text-gray-700 dark:text-gray-200 text-sm py-1 pl-2 pr-6 cursor-pointer focus:outline-none"
                value={user.settings.fontSize}
                onChange={(e) => handleUpdateSettings({ fontSize: parseInt(e.target.value) })}
              >
                {[12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48].map((size) => (
                  <option key={size} value={size}>{size}</option>
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
      </header>

      {/* Main Content */}
      <main 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative"
      >
        {view === 'SONG_VIEW' && currentSong && (
          <>
            <SongViewer 
              song={currentSong} 
              settings={user.settings} 
              onUpdateSettings={handleUpdateSettings}
              transpose={transpose}
              activeSetlist={activeSetlist}
              activeSetlistIndex={activeSetlistIndex}
              onNextSong={() => handleSetlistNav('next')}
              onPrevSong={() => handleSetlistNav('prev')}
              onSetlistJump={(idx) => handleSetlistNav(idx)}
              onExitSetlist={handleExitSetlist}
              allSongs={allSongs}
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
            onSelectSong={selectSong}
            onEditSong={(song) => {
              setSongToEdit(song);
              setView('SONG_FORM');
            }}
            onDeleteSong={handleDeleteSpecificSong}
            onBack={() => setView('SONG_VIEW')}
          />
        )}
        {view === 'SETLIST_MANAGER' && (
          <SetlistManager
            setlists={setlists}
            allSongs={allSongs}
            onSave={handleSaveSetlist}
            onDelete={handleDeleteSetlist}
            onPlay={handlePlaySetlist}
            onClose={() => setView('SONG_VIEW')}
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
              <button 
                onClick={() => { setSongToEdit(undefined); setView('SONG_FORM'); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-plus w-6"></i>
                <span className="font-medium">Add New Song</span>
              </button>
              <button 
                onClick={() => { setSongToEdit(currentSong || undefined); setView('SONG_FORM'); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-pen-to-square w-6"></i>
                <span className="font-medium">Edit Current Song</span>
              </button>
              <button 
                onClick={() => { handleDeleteSong(); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-trash w-6"></i>
                <span className="font-medium">Delete Current Song</span>
              </button>

              <div className="my-4 border-t border-gray-100 dark:border-gray-700" />
              
              <p className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Playlists</p>
              {activeSetlist && (
                <button 
                  onClick={() => { handleExitSetlist(); setMenuOpen(false); }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors mb-2"
                >
                  <i className="fa-solid fa-circle-stop w-6"></i>
                  <span className="font-medium">Exit Current Set</span>
                </button>
              )}
              <button 
                onClick={() => { setView('SETLIST_MANAGER'); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-list-ul w-6"></i>
                <span className="font-medium">My Set-Lists</span>
              </button>
              <button 
                onClick={() => { setView('RECENT_SONGS'); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-clock-rotate-left w-6"></i>
                <span className="font-medium">Recent 50 Additions</span>
              </button>

              <div className="my-4 border-t border-gray-100 dark:border-gray-700" />

              {user.role === UserRole.ADMIN && (
                <button 
                  onClick={() => { setView('ADMIN_DASHBOARD'); setMenuOpen(false); }}
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
                onClick={() => { setView('SETTINGS'); setMenuOpen(false); }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <i className="fa-solid fa-user-gear w-6"></i>
                <span className="font-medium">Profile & Settings</span>
              </button>
              <button 
                onClick={handleLogout}
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
