import { useState, useEffect, useRef, useCallback } from 'react';

export const useMetronome = (baseTempo?: number) => {
  const [localTempo, setLocalTempo] = useState<number | undefined>(undefined);
  const [active, setActive] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  // Refs for Web Audio API scheduling and timers
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const schedulerTimerIdRef = useRef<number | null>(null);
  const beatFlashTimeoutIdRef = useRef<number | null>(null);

  // If localTempo is set (via tap/input), use it; otherwise use the base tempo
  const effectiveTempo = localTempo ?? baseTempo;

  // If the base tempo changes (e.g. from parent prop update), reset the local override
  // This allows the "commit" of a tapped tempo in editors to clear the temporary state
  useEffect(() => {
    setLocalTempo(undefined);
  }, [baseTempo]);

  // Cleanup audio context and timers on unmount
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
      if (schedulerTimerIdRef.current) clearTimeout(schedulerTimerIdRef.current);
      if (beatFlashTimeoutIdRef.current) clearTimeout(beatFlashTimeoutIdRef.current);
    };
  }, []);

  const playClick = useCallback((time: number) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // A simple, short click sound
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(1000, time);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
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
      // Reset scheduler time when starting to avoid a jump
      if (audioContextRef.current) {
        nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.1;
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

  // The core Web Audio API scheduler. This is more accurate than setInterval.
  useEffect(() => {
    if (!active || !effectiveTempo || effectiveTempo <= 0) {
      // Stop any running schedulers
      if (schedulerTimerIdRef.current) clearTimeout(schedulerTimerIdRef.current);
      setBeatFlash(false);
      return;
    }

    const scheduleAheadTime = 0.1;   // How far ahead to schedule audio (sec)
    const schedulerLookahead = 25.0; // How often to call the scheduler (ms)

    const scheduler = () => {
      const ctx = audioContextRef.current;
      if (!ctx || !active) return; // Stop if context is gone or metronome is off

      // While there are notes that will need to play before the next scheduler check
      while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
        // Schedule the audio click
        playClick(nextNoteTimeRef.current);

        // Schedule the visual flash to sync with the audio
        const flashDelay = (nextNoteTimeRef.current - ctx.currentTime) * 1000;
        setTimeout(() => {
          setBeatFlash(true);
          if (beatFlashTimeoutIdRef.current) clearTimeout(beatFlashTimeoutIdRef.current);
          beatFlashTimeoutIdRef.current = setTimeout(() => setBeatFlash(false), 100) as any;
        }, flashDelay);

        // Advance the next note time
        const secondsPerBeat = 60.0 / effectiveTempo;
        nextNoteTimeRef.current += secondsPerBeat;
      }
      schedulerTimerIdRef.current = setTimeout(scheduler, schedulerLookahead) as any;
    };

    scheduler();

    return () => {
      if (schedulerTimerIdRef.current) clearTimeout(schedulerTimerIdRef.current);
      if (beatFlashTimeoutIdRef.current) clearTimeout(beatFlashTimeoutIdRef.current);
    };
  }, [active, effectiveTempo, playClick]);

  const reset = useCallback(() => {
    setLocalTempo(undefined);
    setActive(false);
    setTapTimes([]);
  }, []);

  return { tempo: effectiveTempo, setTempo: setLocalTempo, active, toggle, beatFlash, tap, reset };
};
