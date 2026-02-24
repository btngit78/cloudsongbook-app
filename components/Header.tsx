import React, { useState, useRef, useEffect, useCallback } from 'react';

interface HeaderProps {
  title?: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onMenuClick: () => void;
  isSearchActive?: boolean;
  onSearchActiveChange?: (isActive: boolean) => void;
  rightContent?: React.ReactNode;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = "CloudSongBook",
  searchQuery,
  setSearchQuery,
  onMenuClick,
  isSearchActive: controlledSearchActive,
  onSearchActiveChange,
  rightContent,
  onKeyDown
}) => {
  const [localSearchActive, setLocalSearchActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState(searchQuery);

  const isSearchActive = controlledSearchActive ?? localSearchActive;
  const setIsSearchActive = useCallback((active: boolean) => {
    onSearchActiveChange ? onSearchActiveChange(active) : setLocalSearchActive(active);
  }, [onSearchActiveChange]);

  const handleCloseSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
  }, [setIsSearchActive, setSearchQuery]);

  // Sync local input with prop when it changes externally
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  // Debounce search query updates
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== searchQuery) {
        setSearchQuery(inputValue);
      }
    }, 170);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchQuery, searchQuery]);

  // Auto-focus input when search mode is activated
  useEffect(() => {
    if (isSearchActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchActive]);

  // Handle clicks outside the search bar to close it
  useEffect(() => {
    if (!isSearchActive) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        handleCloseSearch();
      }
    };
    // Add listener on next tick to avoid capturing the click that opened the search
    const timerId = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchActive, handleCloseSearch]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm h-16 flex items-center px-4 transition-colors duration-200">
      {isSearchActive ? (
        // Search Mode View
        <div ref={searchContainerRef} className="flex-1 flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
          <button
            onClick={handleCloseSearch}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close search"
          >
            {/* Arrow Left Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
          </button>
          
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCloseSearch();
                } else {
                  onKeyDown?.(e);
                }
              }}
              placeholder="Search titles, authors..."
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-full py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {inputValue && (
              <button
                onClick={() => {
                  setInputValue('');
                  setSearchQuery('');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {/* X Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      ) : (
        // Normal Title View
        <div className="flex-1 flex items-center justify-between animate-in fade-in slide-in-from-left-4 duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="p-2 -ml-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Menu"
            >
              {/* Menu Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12"/>
                <line x1="4" x2="20" y1="6" y2="6"/>
                <line x1="4" x2="20" y1="18" y2="18"/>
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchActive(true)}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Search"
            >
              {/* Search Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            </button>
            {rightContent}
          </div>
        </div>
      )}
    </header>
  );
};