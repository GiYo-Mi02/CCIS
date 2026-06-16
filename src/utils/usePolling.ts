import { useEffect, useRef } from 'react';

interface PollingOptions {
  pauseWhenHidden?: boolean;
}

export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options: PollingOptions = { pauseWhenHidden: true }
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    let intervalId: any = null;

    const tick = () => {
      savedCallback.current();
    };

    const start = () => {
      if (!intervalId) {
        tick(); // Trigger immediate execution on start/resume
        intervalId = setInterval(tick, intervalMs);
      }
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (options.pauseWhenHidden) {
        if (document.hidden) {
          stop();
        } else {
          start();
        }
      }
    };

    // Initialize polling if visible
    if (!options.pauseWhenHidden || !document.hidden) {
      start();
    }

    if (options.pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      stop();
      if (options.pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [intervalMs, options.pauseWhenHidden]);
}
