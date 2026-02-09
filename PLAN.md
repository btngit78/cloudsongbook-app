
# Project Plan: CloudSongBook PWA

## 1. Architectural Overview
- **Frontend**: React 18+ (SPA) with TypeScript.
- **Styling**: Tailwind CSS for responsive, mobile-first design.
- **State Management**: React Context/Hooks for app state; `localStorage` for the 40-song LRU (Least Recently Used) cache.
- **Backend Integration**: Service-oriented architecture using a `dbService` (mocking Firestore behavior) and `geminiService` (requires `GEMINI_API_KEY`) for advanced AI search.
- **Deployment**: Optimized for Google Cloud/Firebase Hosting and AI Studio.

## 2. User Roles & Permissions
- **Admin**: Full CRUD on songs/setlists, user management.
- **Premium**: Edit personal setlists, advanced search, offline access to 100+ songs.
- **Free**: View songs, basic search, limited local cache (40 songs).

## 3. Core Modules
### A. Authentication
- Simulated multi-provider login (Google, Facebook, Email).
- Persistent session handling.

### B. Song Management
- **Song Object**: `{ id, title, author, body, createdAt, lastUsedAt }`.
- **Set-List Object**: `{ id, name, songIds, createdAt }`.
- **View Layer**: Chord-aware text rendering with transpose/zoom capabilities.

### C. Search & Discovery
- **Combo Field**: Toggle between "Title Display" and "Live Search".
- **Advanced Search**: Utilizes Gemini API for semantic search (e.g., "songs about hope in G major").
- **Recent Feed**: Dedicated view for the 50 most recently added songs.

## 4. Offline/Caching Strategy
- **LRU Cache**: A specialized utility to manage the 40 most recently used songs in local storage.
- **PWA Manifest**: (Simulated) support for standalone installation.

## 5. Design Language
- **Theme**: Clean, high-contrast typography for readability on stage.
- **Navigation**: Persistent top-bar with burger menu and context-sensitive action area.
