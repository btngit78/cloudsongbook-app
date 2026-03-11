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

export const dbService = {
  // --- Songs ---
  async getSongs(): Promise<Song[]> {
    try {
      const q = query(collection(db, SONGS_COLLECTION), orderBy('title'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song));
    } catch (error) {
      console.error("Error fetching songs:", error);
      return [];
    }
  },

  async getSong(id: string): Promise<Song | undefined> {
    try {
      const docRef = doc(db, SONGS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const song = { id: docSnap.id, ...docSnap.data() } as Song;
        this.addToRecentCache(song);
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
    return songData;
  },

  async deleteSong(id: string): Promise<void> {
    await deleteDoc(doc(db, SONGS_COLLECTION, id));
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
  async getSetlists(): Promise<SetList[]> {
    try {
      // Fetch all setlists (readable by all users)
      const q = query(collection(db, SETLISTS_COLLECTION));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        // Backward compatibility: map legacy songIds to choices if choices is missing
        const choices = data.choices || (data.songIds ? data.songIds.map((sid: string) => ({ songId: sid })) : []);
        return { id: doc.id, ...data, choices } as SetList;
      });
    } catch (error) {
      console.error("Error fetching setlists:", error);
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
  },

  async deleteSetlist(id: string): Promise<void> {
    await deleteDoc(doc(db, SETLISTS_COLLECTION, id));
  },

  // --- Local Cache (LRU) ---
  // Keeps the "Offline/Caching Strategy" from the plan
  getRecentCache(): Song[] {
    const stored = localStorage.getItem(CACHE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  addToRecentCache(song: Song) {
    const current = this.getRecentCache();
    const filtered = current.filter(s => s.id !== song.id);
    const updated = [song, ...filtered].slice(0, 40); // Limit 40
    localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  },

  clearRecentCache() {
    localStorage.removeItem(CACHE_KEY);
  },

  // --- Local Cache (LRU) for Setlists ---
  getRecentSetlistsCache(): SetList[] {
    const stored = localStorage.getItem(RECENT_SETLISTS_CACHE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  addToRecentSetlistsCache(setlist: SetList) {
    const current = this.getRecentSetlistsCache();
    // Remove if it already exists to move it to the front
    const filtered = current.filter(s => s.id !== setlist.id);
    // Add to the front and limit to 10
    const updated = [setlist, ...filtered].slice(0, 10);
    localStorage.setItem(RECENT_SETLISTS_CACHE_KEY, JSON.stringify(updated));
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