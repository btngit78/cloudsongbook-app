import { useState, useEffect, useRef } from 'react';
import { Song } from '../types';

export const useScroll = (currentSong: Song | null) => {
  const scrollContainerRef = useRef<HTMLElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [passedChoruses, setPassedChoruses] = useState<number[]>([]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
   
    const scrollTop = scrollContainerRef.current.scrollTop;
    
    setShowBackToTop(scrollTop > 300);

    const passed: number[] = [];
    // Check for up to 4 choruses
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`chorus-${i}`);
      if (!el) break;
      
      // If the chorus is scrolled out of view (top + height < scroll + offset)
      // We use a buffer (100px) to determine when it's "passed"
      if (el.offsetTop + el.offsetHeight < scrollTop + 100) {
        passed.push(i);
      }
    }
    
    setPassedChoruses(prev => {
      if (prev.length !== passed.length) return passed;
      return prev.every((val, idx) => val === passed[idx]) ? prev : passed;
    });
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToChorus = (index: number) => {
    const el = document.getElementById(`chorus-${index}`);
    if (el && scrollContainerRef.current) {
      // Scroll to element minus header height (approx 100px buffer)
      scrollContainerRef.current.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
    }
  };

  // Reset scroll on song change
  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    setShowBackToTop(false);
    setPassedChoruses([]);
  }, [currentSong]);

  return {
    scrollContainerRef,
    showBackToTop,
    passedChoruses,
    handleScroll,
    scrollToTop,
    scrollToChorus
  };
};