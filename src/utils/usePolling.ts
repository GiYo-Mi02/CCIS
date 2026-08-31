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
    const tick = () => {
      savedCallback.current();
    };

    const handleVisibilityChange = () => {
      if (options.pauseWhenHidden && !document.hidden) {
        tick();
      }
    };

    if (!options.pauseWhenHidden || !document.hidden) {
      tick();
    }
    const intervalId = setInterval(() => {
      if (!options.pauseWhenHidden || !document.hidden) tick();
    }, intervalMs);

    if (options.pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(intervalId);
      if (options.pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [intervalMs, options.pauseWhenHidden]);
}
