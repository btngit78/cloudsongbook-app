import { useState, useRef, useCallback, useEffect } from 'react';

export const useDraggable = (initialPosition: { x: number, y: number }) => {
  const [position, setPosition] = useState(initialPosition);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const onDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    
    let newX = clientX - dragOffset.current.x;
    let newY = clientY - dragOffset.current.y;

    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;

      newX = Math.max(0, Math.min(newX, viewportWidth - rect.width));
      newY = Math.max(0, Math.min(newY, viewportHeight - rect.height));
    }

    setPosition({ x: newX, y: newY });
  }, []);

  const stopDrag = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
  }, [onDrag]);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent drag on right-click
    if ('button' in e && e.button === 2) return;

    isDragging.current = true;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    dragOffset.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
  };

  // Ensure modal stays in viewport on resize
  useEffect(() => {
    const handleResize = () => {
      if (modalRef.current) {
        const rect = modalRef.current.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        
        setPosition(prev => ({
          x: Math.max(0, Math.min(prev.x, viewportWidth - rect.width)),
          y: Math.max(0, Math.min(prev.y, viewportHeight - rect.height))
        }));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { position, modalRef, startDrag };
};