import { useCallback, useRef, useEffect } from 'react';

interface PerformanceMetrics {
  fps: number;
  memory: number;
  renderTime: number;
}

export function useQuizPerformance() {
  const fpsRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const rafRef = useRef<number | undefined>(undefined);

  const measurePerformance = useCallback(() => {
    const currentTime = performance.now();
    frameCountRef.current++;

    if (currentTime - lastTimeRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      lastTimeRef.current = currentTime;
    }

    rafRef.current = requestAnimationFrame(measurePerformance);
  }, []);

  const getMetrics = useCallback((): PerformanceMetrics => {
    return {
      fps: fpsRef.current,
      memory: (performance as any)?.memory?.usedJSHeapSize || 0,
      renderTime: performance.now() - lastTimeRef.current
    };
  }, []);

  const optimizeRendering = useCallback(() => {
    // Batching updates
    return new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }, []);

  const debounceRender = useCallback((fn: Function, delay: number = 100) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(measurePerformance);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [measurePerformance]);

  return {
    getMetrics,
    optimizeRendering,
    debounceRender
  };
} 