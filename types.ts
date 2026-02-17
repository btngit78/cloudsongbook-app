
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
  theme: 'light' | 'dark' | 'system';
  chordColor: string; // For dark theme
  sectionColor: string; // For dark theme
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
  pdfData?: string; // Base64 encoded PDF string
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
}

export interface SetList {
  id: string;
  name: string;
  songIds: string[];
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

export type ViewState = 'SONG_VIEW' | 'SONG_FORM' | 'SETLIST_LIST' | 'SETLIST_FORM' | 'RECENT_SONGS' | 'ADVANCED_SEARCH' | 'SETTINGS';
