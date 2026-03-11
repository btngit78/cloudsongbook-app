
# Project Plan: CloudSongBook PWA

## 1. Architectural Overview
- **Frontend**: React 18+ (SPA) with TypeScript.
- **Styling**: Tailwind CSS for responsive, mobile-first design.
- **State Management**: React Context/Hooks for app state; `localStorage` for the 40-song LRU (Least Recently Used) cache.
- **Backend Integration**: Service-oriented architecture using a `dbService` (mocking Firestore behavior) and `geminiService` (requires `GEMINI_API_KEY`) for advanced AI search.
- **Deployment**: Optimized for Google Cloud/Firebase Hosting and AI Studio.

## 2. User Roles & Permissions
- **Admin**: Full CRUD on all songs/setlists, user management. Admin dashboard to manage users, Dbs, etc.
- **Premium**: CRUD on personal songs/setlists, read-only on others' songs/setlists, advanced search, offline access to 100+ songs.
- **Free**: View songs, basic search, limited local cache (40 songs).

## 3. Core Modules
### A. Authentication
- Multi-provider login (Google, Facebook, Email).
- Persistent session handling. Support for localStorage for up to 4 users' data to maintain session information; each slot will have timestamp with which the oldest can be replaced when a new user logs in but all 4 have been used.

### B. Song Management
- **Song Object**: Various info in addition to the basics title, author, body.
- **Set-List Object**: These are named records of song list for ease of play. 
- **View Layer**: Chord-aware text rendering with transpose/zoom capabilities.

### C. Search & Discovery
- **Combo Field**: Toggle between "Title Display" and "Live Search".
- **Advanced Search**: In 2nd or 3rd iteration, utilizes Gemini API for semantic search (e.g., "songs about hope in G major").
- **Recent Feed**: Dedicated view for the 50 most recently added songs with the ability to edit or delete them on same page per user's authority on a given song listed.

## 4. Offline/Caching Strategy
- **PWA Manifest**: Support for standalone installation.
- **Offline use**: Initial design should support full DB in local storage for non-PDF songs; DB size is estimated to be currently at 2MB at most. For songs with PDF, caching is limited to 5 songs and only for the latest login, not for other logins. Initial design will have explicit sync button to synchronize with any DB updates in the backend. Second iteration should support autosync when the Recent 50 Additions' songs are updated upon user's login (or past 24 hours) and then any song is found to be older than the current song DB's timestamp. Third iteration should address possible reduction of localStorage use and real caching with dynamic notification of periodic/instant updates of song and setlist DBs.
- **Multi-user**: The app supports up to 4 users session through browser/app restarts. 

## 5. Design Language
- **Theme**: Clean, high-contrast typography for readability on stage. Default 'light' mode if user has yet to login and then subsequent change is stored along with other users' data on backend database; this will be simulated first with localStorage.
- **Navigation**: Persistent top-bar with burger menu and context-sensitive action area.
