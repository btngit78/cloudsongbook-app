
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
  theme: 'light' | 'dark';
}

export interface Song {
  id: string;
  title: string;
  author: string;
  body: string; // ChordPro text or empty if PDF
  key?: string;
  tempo?: number;
  keywords?: string;
  language: string;
  isPdf: boolean;
  pdfData?: string; // Base64 encoded PDF string
  createdAt: number;
  lastUsedAt: number;
}

export interface SetList {
  id: string;
  name: string;
  songIds: string[];
  ownerId: string;
}

export type ViewState = 'SONG_VIEW' | 'SONG_FORM' | 'SETLIST_LIST' | 'SETLIST_FORM' | 'RECENT_SONGS' | 'ADVANCED_SEARCH' | 'SETTINGS';
