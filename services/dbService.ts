// c:\Users\ntdt7\cloudsongbook-app\services\dbService.ts
import { db } from '../firebaseConfig';
import { 
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, 
  query, where, orderBy, limit 
} from 'firebase/firestore';
import { Song, User, SetList, UserSettings, UserRole } from '../types';

const SONGS_COLLECTION = 'songs';
const USERS_COLLECTION = 'users';
const SETLISTS_COLLECTION = 'setlists';
const CACHE_KEY = 'cloudsong_recent_songs';

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
      tempo: song.tempo || 120,
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

    if (userSnap.exists()) {
      // Return existing user data (preserves settings from DB)
      return { id: userSnap.id, ...userSnap.data() } as User;
    } else {
      // Create new user in DB
      await setDoc(userRef, user);
      return user;
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
  async getSetlists(userId: string): Promise<SetList[]> {
    try {
      const q = query(collection(db, SETLISTS_COLLECTION), where('ownerId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SetList));
    } catch (error) {
      console.error("Error fetching setlists:", error);
      return [];
    }
  },

  async saveSetlist(setlist: SetList, userId: string): Promise<void> {
    const now = Date.now();
    const data = { 
      ...setlist, 
      ownerId: userId,
      updatedAt: now,
      createdAt: (setlist as any).createdAt || now,
      name: setlist.name || 'Untitled Setlist',
      songIds: setlist.songIds || []
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
  }
};
