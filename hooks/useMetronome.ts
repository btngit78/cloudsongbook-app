import { useState, useEffect, useRef, useCallback } from 'react';

export const useMetronome = (baseTempo?: number) => {
  const [localTempo, setLocalTempo] = useState<number | undefined>(undefined);
  const [active, setActive] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // If localTempo is set (via tap/input), use it; otherwise use the base tempo
  const effectiveTempo = localTempo ?? baseTempo;

  // If the base tempo changes (e.g. from parent prop update), reset the local override
  // This allows the "commit" of a tapped tempo in editors to clear the temporary state
  useEffect(() => {
    setLocalTempo(undefined);
  }, [baseTempo]);

  const playClick = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }, []);

  const toggle = useCallback(() => {
    if (!active) {
      // Initialize AudioContext on user interaction
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        }
      }
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    }
    setActive(prev => !prev);
  }, [active]);

  const tap = useCallback(() => {
    const now = Date.now();
    setTapTimes(prev => {
      let newTaps = [...prev];
      // Reset if last tap was > 2s ago
      if (newTaps.length > 0 && now - newTaps[newTaps.length - 1] > 2000) {
        newTaps = [];
      }
      newTaps.push(now);
      // Keep last 4 taps
      if (newTaps.length > 4) newTaps.shift();
      
      if (newTaps.length > 1) {
        const intervals = newTaps.slice(1).map((t, i) => t - newTaps[i]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const bpm = Math.round(60000 / avgInterval);
        const clampedBpm = Math.min(Math.max(bpm, 30), 400);
        setLocalTempo(clampedBpm);
      }
      return newTaps;
    });
  }, []);

  useEffect(() => {
    if (!active || !effectiveTempo || effectiveTempo <= 0) {
      setBeatFlash(false);
      return;
    }

    setBeatFlash(true);
    playClick();
    const initialTimeout = setTimeout(() => setBeatFlash(false), 150);

    const intervalMs = 60000 / effectiveTempo;
    const intervalId = setInterval(() => {
      setBeatFlash(true);
      playClick();
      setTimeout(() => setBeatFlash(false), 150);
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      clearTimeout(initialTimeout);
    };
  }, [active, effectiveTempo, playClick]);

  return {
    tempo: effectiveTempo,
    setTempo: setLocalTempo,
    active,
    toggle,
    beatFlash,
    tap,
    reset: () => {
      setLocalTempo(undefined);
      setActive(false);
      setTapTimes([]);
    }
  };
};
