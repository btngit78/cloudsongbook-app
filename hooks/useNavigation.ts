import { useState, useCallback } from 'react';
import { ViewState, Song } from '../types';

interface UseNavigationProps {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setSearchQuery: (query: string) => void;
  setIsHeaderSearchActive: (isActive: boolean) => void; // Setter for isHeaderSearchActive from App.tsx
  setSelectedIndex: (index: number) => void; // Setter for selectedIndex from App.tsx
  setSongToEdit: (song: Song | undefined) => void;
  setTargetSetlistId: (id: string | null) => void; // Setter for targetSetlistId from App.tsx
  exitSetlist: () => void;
}

interface UseNavigationReturn {
  view: ViewState | 'SETLIST_MANAGER' | 'ADMIN_DASHBOARD';
  setView: (newView: ViewState | 'SETLIST_MANAGER' | 'ADMIN_DASHBOARD') => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  showRecentlyViewedSubMenu: boolean;
  setShowRecentlyViewedSubMenu: (show: boolean) => void;
  showRecentlyPlayedSetlistsSubMenu: boolean;
  setShowRecentlyPlayedSetlistsSubMenu: (show: boolean) => void;
  cameFromAdminSongSearch: boolean;
  setCameFromAdminSongSearch: (came: boolean) => void;
  adminSetlistFilter: string;
  setAdminSetlistFilter: (filter: string) => void;
  handleNavigation: (targetView: ViewState | 'SETLIST_MANAGER' | 'ADMIN_DASHBOARD', callback?: () => void) => void;
  handleAdminNavigate: (query: string, type: 'songs' | 'setlists') => void;
} // Ensure that the Song type is imported or defined correctly

export const useNavigation = ({
  hasUnsavedChanges,
  setHasUnsavedChanges,
  setSearchQuery,
  setIsHeaderSearchActive,
  setSelectedIndex,
  setSongToEdit,
  setTargetSetlistId,
  exitSetlist,
}: UseNavigationProps): UseNavigationReturn => {
  const [view, setView] = useState<ViewState | 'SETLIST_MANAGER' | 'ADMIN_DASHBOARD'>('SONG_VIEW');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRecentlyViewedSubMenu, setShowRecentlyViewedSubMenu] = useState(false);
  const [showRecentlyPlayedSetlistsSubMenu, setShowRecentlyPlayedSetlistsSubMenu] = useState(false);
  const [cameFromAdminSongSearch, setCameFromAdminSongSearch] = useState(false);
  const [adminSetlistFilter, setAdminSetlistFilter] = useState<string>('');

  const handleNavigation = useCallback((targetView: ViewState | 'SETLIST_MANAGER' | 'ADMIN_DASHBOARD', callback?: () => void) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        return;
      }
      setHasUnsavedChanges(false);
    }
    if (callback) callback();
    setView(targetView);
    setMenuOpen(false);
    setShowRecentlyViewedSubMenu(false);
    setShowRecentlyPlayedSetlistsSubMenu(false);
    // Reset search-related states
    setSearchQuery('');
    setIsHeaderSearchActive(false);
    setSelectedIndex(-1);
    if (targetView !== 'SONG_FORM') {
      setSongToEdit(undefined); // Clear song to edit when navigating, but not when going to the edit form
    }
    setTargetSetlistId(null); // Clear target setlist when navigating
    exitSetlist(); // Call the passed exitSetlist
  }, [hasUnsavedChanges, setHasUnsavedChanges, setSearchQuery, setIsHeaderSearchActive, setSelectedIndex, setSongToEdit, setTargetSetlistId, exitSetlist, setView]);

  const handleAdminNavigate = useCallback((query: string, type: 'songs' | 'setlists') => {
    if (type === 'songs') {
      setCameFromAdminSongSearch(true);
      setView('SONG_VIEW');
      setSearchQuery(query);
      setIsHeaderSearchActive(true);
    } else {
      setAdminSetlistFilter(query);
      setView('SETLIST_MANAGER');
    }
    setMenuOpen(false);
  }, [setSearchQuery, setIsHeaderSearchActive, setAdminSetlistFilter, setCameFromAdminSongSearch, setView, setMenuOpen, setCameFromAdminSongSearch]);

  return {
    view,
    setView,
    menuOpen,
    setMenuOpen,
    showRecentlyViewedSubMenu,
    setShowRecentlyViewedSubMenu,
    showRecentlyPlayedSetlistsSubMenu,
    setShowRecentlyPlayedSetlistsSubMenu,
    cameFromAdminSongSearch,
    setCameFromAdminSongSearch,
    adminSetlistFilter,
    setAdminSetlistFilter,
    handleNavigation,
    handleAdminNavigate,
  };
};