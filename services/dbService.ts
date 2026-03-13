import { db, app } from '../firebaseConfig';
import { 
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, 
  query, where, orderBy, limit
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Song, User, SetList, UserSettings, UserRole } from '../types';

const functions = getFunctions(app);
const deleteUserCallable = httpsCallable(functions, 'deleteUser');
const sendWelcomeEmailCallable = httpsCallable(functions, 'sendWelcomeEmail');

const SONGS_COLLECTION = 'songs';
const USERS_COLLECTION = 'users';
const SETLISTS_COLLECTION = 'setlists';
const CACHE_KEY = 'cloudsong_recent_songs';
const RECENT_SETLISTS_CACHE_KEY = 'cloudsong_recent_setlists';
const ALL_SONGS_CACHE_KEY = 'cloudsong_all_songs';
const ALL_SETLISTS_CACHE_KEY = 'cloudsong_all_setlists';
const MULTI_USER_SESSION_KEY = 'cloudsong_user_sessions';
const MAX_SESSIONS = 4;

interface UserSession {
  userId: string;
  lastActive: number;
  recentSongs: Song[];
  recentSetlists: SetList[];
  cachedPdfUrls?: string[];
}

// Helper to update local cache lists (append/update or remove)
const updateCacheList = <T extends { id: string }>(key: string, item: T | { id: string }, isDelete: boolean) => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return;
    let list = JSON.parse(stored) as T[];
    if (isDelete) {
      list = list.filter(i => i.id !== item.id);
    } else {
      const idx = list.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        list[idx] = item as T;
      } else {
        list.push(item as T);
      }
    }
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.warn('Cache update failed', e);
  }
};

export const dbService = {
  // --- Songs ---
  async getSongs(forceRefresh = false): Promise<Song[]> {
    try {
      if (!forceRefresh) {
        const cached = localStorage.getItem(ALL_SONGS_CACHE_KEY);
        if (cached) return JSON.parse(cached);
      }

      const q = query(collection(db, SONGS_COLLECTION), orderBy('title'));
      const snapshot = await getDocs(q);
      const songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song));
      
      try {
        localStorage.setItem(ALL_SONGS_CACHE_KEY, JSON.stringify(songs));
      } catch (e) {
        console.error("Failed to cache songs (quota?)", e);
      }
      
      return songs;
    } catch (error) {
      console.error("Error fetching songs:", error);
      // Fallback to cache on error if available
      const cached = localStorage.getItem(ALL_SONGS_CACHE_KEY);
      if (cached) return JSON.parse(cached);
      return [];
    }
  },

  async getSong(id: string, userId?: string): Promise<Song | undefined> {
    try {
      const docRef = doc(db, SONGS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const song = { id: docSnap.id, ...docSnap.data() } as Song;
        if (userId) {
          this.addToRecentCache(userId, song);
        }
        return song;
      }
    } catch (error) {
      console.error("Error fetching song:", error);
    }
    return undefined;
  },

  async saveSong(song: Partial<Song>): Promise<Song> {
    // Generate a new ID if one doesn't exist
    const id = song.id || doc(collection(db, SONGS_COLLECTION)).id;
    const now = Date.now();
    
    const songData: Song = {
      ...song,
      id,
      createdAt: song.createdAt || now,
      lastUsedAt: now,
      // Ensure required fields exist if partial
      title: song.title || 'Untitled',
      authors: song.authors|| 'Unknown',
      body: song.body || '',
      key: song.key || 'C',
      pdfUrl: song.pdfUrl || '',
      tempo: song.tempo || 0,
      keywords: song.keywords || [],
      language: song.language || 'English',
      isPdf: song.isPdf || false,
      ownerId: song.ownerId || 'Unknown',
      updatedAt: song.updatedAt || now
    } as Song;

    await setDoc(doc(db, SONGS_COLLECTION, id), songData, { merge: true });
    updateCacheList(ALL_SONGS_CACHE_KEY, songData, false);
    return songData;
  },

  async deleteSong(id: string): Promise<void> {
    await deleteDoc(doc(db, SONGS_COLLECTION, id));
    updateCacheList(ALL_SONGS_CACHE_KEY, { id }, true);
  },

  // --- Users ---
  async getUser(id: string): Promise<User | undefined> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as User;
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
    return undefined;
  },

  async syncUser(user: User): Promise<User> {
    const userRef = doc(db, USERS_COLLECTION, user.id);
    const userSnap = await getDoc(userRef);
    const now = Date.now();

    if (userSnap.exists()) {
      // User exists. Update last login and return merged data.
      const existingData = { id: userSnap.id, ...userSnap.data() } as User;
      const updatedUser = { ...existingData, lastLoginAt: now };
      await setDoc(userRef, { lastLoginAt: now }, { merge: true });
      return updatedUser;
    } else {
      // Create new user in DB with timestamps.
      const newUser = {
        ...user,
        createdAt: now,
        lastLoginAt: now,
      };
      await setDoc(userRef, newUser);
      return newUser;
    }
  },

  async updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userRef, { settings }, { merge: true });
  },

  async getAllUsers(): Promise<User[]> {
    try {
      const q = query(collection(db, USERS_COLLECTION), orderBy('name'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  },

  async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userRef, { role: newRole }, { merge: true });
  },

  // --- Setlists ---
  async getSetlists(forceRefresh = false): Promise<SetList[]> {
    try {
      if (!forceRefresh) {
        const cached = localStorage.getItem(ALL_SETLISTS_CACHE_KEY);
        if (cached) return JSON.parse(cached);
      }

      // Fetch all setlists (readable by all users)
      const q = query(collection(db, SETLISTS_COLLECTION));
      const snapshot = await getDocs(q);
      const setlists = snapshot.docs.map(doc => {
        const data = doc.data();
        // Backward compatibility: map legacy songIds to choices if choices is missing
        const choices = data.choices || (data.songIds ? data.songIds.map((sid: string) => ({ songId: sid })) : []);
        return { id: doc.id, ...data, choices } as SetList;
      });

      try {
        localStorage.setItem(ALL_SETLISTS_CACHE_KEY, JSON.stringify(setlists));
      } catch (e) {
        console.error("Failed to cache setlists", e);
      }

      return setlists;
    } catch (error) {
      console.error("Error fetching setlists:", error);
      const cached = localStorage.getItem(ALL_SETLISTS_CACHE_KEY);
      if (cached) return JSON.parse(cached);
      return [];
    }
  },

  async saveSetlist(setlist: SetList): Promise<void> {
    const now = Date.now();
    const data = { 
      ...setlist, 
      updatedAt: now,
      createdAt: (setlist as any).createdAt || now,
      name: setlist.name || 'Untitled Setlist',
      choices: setlist.choices || [],
      lastUsedAt: setlist.lastUsedAt || 0
    };
    await setDoc(doc(db, SETLISTS_COLLECTION, setlist.id), data, { merge: true });
    updateCacheList(ALL_SETLISTS_CACHE_KEY, data, false);
  },

  async deleteSetlist(id: string): Promise<void> {
    await deleteDoc(doc(db, SETLISTS_COLLECTION, id));
    updateCacheList(ALL_SETLISTS_CACHE_KEY, { id }, true);
  },

  // --- Multi-user Session Management ---
  getSessions(): UserSession[] {
    const stored = localStorage.getItem(MULTI_USER_SESSION_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  saveSessions(sessions: UserSession[]): void {
    localStorage.setItem(MULTI_USER_SESSION_KEY, JSON.stringify(sessions));
  },

  getUserSession(userId: string): UserSession | undefined {
    return this.getSessions().find(s => s.userId === userId);
  },

  updateUserSession(userId: string, data: Partial<Omit<UserSession, 'userId' | 'lastActive'>>): void {
    let sessions = this.getSessions();
    let session = sessions.find(s => s.userId === userId);

    if (session) {
      // Update existing session
      Object.assign(session, data, { lastActive: Date.now() });
    } else {
      // Create new session
      session = {
        userId,
        lastActive: Date.now(),
        recentSongs: [],
        recentSetlists: [],
        ...data,
      };
      if (sessions.length >= MAX_SESSIONS) {
        // Evict the least recently active session
        sessions.sort((a, b) => a.lastActive - b.lastActive);
        sessions.shift();
      }
      sessions.push(session);
    }
    this.saveSessions(sessions);
  },

  // --- Local Cache (LRU) ---
  // Keeps the "Offline/Caching Strategy" from the plan
  getRecentCache(userId: string): Song[] {
    const session = this.getUserSession(userId);
    if (session) return session.recentSongs;

    // Migration from old single-user cache
    const oldCache = localStorage.getItem(CACHE_KEY);
    if (oldCache) {
      try {
        const songs = JSON.parse(oldCache);
        this.updateUserSession(userId, { recentSongs: songs });
        localStorage.removeItem(CACHE_KEY);
        return songs;
      } catch (e) { localStorage.removeItem(CACHE_KEY); }
    }
    return [];
  },

  addToRecentCache(userId: string, song: Song) {
    const current = this.getRecentCache(userId);
    const filtered = current.filter(s => s.id !== song.id);
    const updated = [song, ...filtered].slice(0, 40); // Limit 40
    this.updateUserSession(userId, { recentSongs: updated });
  },

  clearRecentCache(userId: string) {
    this.updateUserSession(userId, { recentSongs: [] });
  },

  // --- Local Cache (LRU) for Setlists ---
  getRecentSetlistsCache(userId: string): SetList[] {
    const session = this.getUserSession(userId);
    if (session) return session.recentSetlists;

    // Migration from old single-user cache
    const oldCache = localStorage.getItem(RECENT_SETLISTS_CACHE_KEY);
    if (oldCache) {
      try {
        const setlists = JSON.parse(oldCache);
        this.updateUserSession(userId, { recentSetlists: setlists });
        localStorage.removeItem(RECENT_SETLISTS_CACHE_KEY);
        return setlists;
      } catch (e) { localStorage.removeItem(RECENT_SETLISTS_CACHE_KEY); }
    }
    return [];
  },

  addToRecentSetlistsCache(userId: string, setlist: SetList) {
    const current = this.getRecentSetlistsCache(userId);
    const filtered = current.filter(s => s.id !== setlist.id);
    const updated = [setlist, ...filtered].slice(0, 10);
    this.updateUserSession(userId, { recentSetlists: updated });
  },

  // --- PDF Caching (LRU - Max 5 per user) ---
  async cacheUserPdf(userId: string, url: string): Promise<void> {
    if (!url) return;
    
    // 1. Update Session Metadata
    let sessions = this.getSessions();
    let session = sessions.find(s => s.userId === userId);
    
    if (!session) return; 
    
    const cachedUrls = session.cachedPdfUrls || [];
    
    // Remove if exists (to move to front)
    const existingIndex = cachedUrls.indexOf(url);
    if (existingIndex > -1) {
      cachedUrls.splice(existingIndex, 1);
    }
    
    // Add to front
    cachedUrls.unshift(url);
    
    const urlsToRemove: string[] = [];
    
    // Trim to 5 (LRU eviction)
    while (cachedUrls.length > 5) {
      const removed = cachedUrls.pop();
      if (removed) urlsToRemove.push(removed);
    }
    
    session.cachedPdfUrls = cachedUrls;
    this.saveSessions(sessions);
    
    // 2. Manage Browser Cache
    if ('caches' in window) {
      try {
        const cache = await caches.open('cloudsong-pdfs');
        await cache.add(url).catch(e => console.warn("Failed to cache PDF:", e));
        
        // Clean up evicted ones (check ref count across other users)
        for (const remUrl of urlsToRemove) {
          const isReferenced = sessions.some(s => s.userId !== userId && s.cachedPdfUrls?.includes(remUrl));
          if (!isReferenced) {
             await cache.delete(remUrl);
          }
        }
      } catch (err) {
        console.error("Error managing PDF cache:", err);
      }
    }
  },

  // --- Global Cache Control ---
  async refreshCache() {
    await Promise.all([
      this.getSongs(true),
      this.getSetlists(true)
    ]);
  },


/**
 * Calls a secure cloud function to delete a user and their content.
 * The cloud function handles deleting from Firebase Auth and Firestore.
 */
async deleteUserAndContent(userId: string, contentOption: 'transfer' | 'delete'): Promise<any> {
  try {
    const result = await deleteUserCallable({ userId, contentOption });
    return result.data;
  } catch (error) {
    console.error("Error calling deleteUser cloud function:", error);
    // Re-throw to be handled by the UI
    throw error;
  }
},

async sendWelcomeEmail(userId: string): Promise<any> {
  try {
    const result = await sendWelcomeEmailCallable({ userId });
    return result.data;
  } catch (error) {
    console.error("Error calling sendWelcomeEmail cloud function:", error);
    throw error;
  }
}

};