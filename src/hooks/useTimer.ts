import { useState, useRef, useCallback, useEffect } from 'react';

interface TimerOptions {
  initialTime?: number;
  interval?: number;
  autostart?: boolean;
  onTimeUp?: () => void;
}

export function useTimer({ 
  initialTime = 0, 
  interval = 1000, 
  autostart = false,
  onTimeUp
}: TimerOptions = {}) {
  const [time, setTime] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autostart);
  const lastTickRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);
  const intervalRef = useRef<number>(interval);

  const tick = useCallback((timestamp: number) => {
    if (!lastTickRef.current) {
      lastTickRef.current = timestamp;
    }

    const elapsed = timestamp - lastTickRef.current;

    if (elapsed >= intervalRef.current) {
      setTime(prevTime => {
        if (initialTime > 0) {
          const newTime = prevTime - (intervalRef.current / 1000);
          if (newTime <= 0 && onTimeUp) {
            onTimeUp();
            return 0;
          }
          return newTime;
        } else {
          return prevTime + (intervalRef.current / 1000);
        }
      });
      lastTickRef.current = timestamp;
    }

    if (isRunning) {
      rafIdRef.current = requestAnimationFrame(tick);
    }
  }, [isRunning, onTimeUp, initialTime]);

  const start = useCallback(() => {
    setIsRunning(true);
    lastTickRef.current = 0;
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
  }, []);

  const reset = useCallback((newTime: number = initialTime) => {
    setTime(newTime);
    lastTickRef.current = 0;
  }, [initialTime]);

  const setTimeManually = useCallback((newTime: number) => {
    setTime(newTime);
  }, []);

  useEffect(() => {
    if (autostart) {
      start();
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [autostart, start]);

  return {
    time,
    isRunning,
    start,
    pause,
    reset,
    setTime: setTimeManually
  };
} 