
export enum UserRole {
  FREE = 'free',
  PREMIUM = 'premium',
  ADMIN = 'admin'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  profileImage?: string;
  settings: UserSettings;
}

export interface UserSettings {
  fontSize: number;
  showChords: boolean;
  highlightSearch?: boolean;
  theme: 'light' | 'dark' | 'system';
  chordColor: string; // For dark theme
  sectionColor: string; // For dark theme
  setlistTransposeMode?: 'auto' | 'confirm' | 'off';
  showComments?: boolean;
  autoRemoveBrokenLinks?: boolean;
}

export interface Song {
  id: string;
  title: string;
  authors: string;
  body: string; // ChordPro text or empty if PDF
  key: string;
  tempo: number;
  keywords: Array<string>;
  ownerId: string;
  language: string;
  isPdf: boolean;
  pdfUrl?: string; // Public URL to the PDF file in Cloud Storage
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
}

export interface SetList { 
  id: string;
  name: string; 
  ownerId: string; 
  choices: SongChoice[]; 
  createdAt: number; 
  updatedAt: number; 
} 
  
export interface SongChoice { 
  songId: string; 
  key?: string; 
  style?: string; 
  tempo?: number; 
  singer?: string; 
}

export type ViewState = 'SONG_VIEW' | 'SONG_FORM' | 'SETLIST_LIST' | 'SETLIST_FORM' | 'RECENT_SONGS' | 'ADVANCED_SEARCH' | 'SETTINGS';
