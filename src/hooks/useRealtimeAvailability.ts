import { useEffect, useState } from 'react';

interface RealtimeAvailability {
  isDocumentVisible: boolean;
  isOnline: boolean;
  isRealtimeAvailable: boolean;
}

const readAvailability = (): RealtimeAvailability => {
  const isDocumentVisible = typeof document === 'undefined' || !document.hidden;
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;

  return {
    isDocumentVisible,
    isOnline,
    isRealtimeAvailable: isDocumentVisible && isOnline,
  };
};

export function useRealtimeAvailability(): RealtimeAvailability {
  const [availability, setAvailability] = useState(readAvailability);

  useEffect(() => {
    const updateAvailability = () => setAvailability(readAvailability());

    document.addEventListener('visibilitychange', updateAvailability);
    window.addEventListener('online', updateAvailability);
    window.addEventListener('offline', updateAvailability);

    return () => {
      document.removeEventListener('visibilitychange', updateAvailability);
      window.removeEventListener('online', updateAvailability);
      window.removeEventListener('offline', updateAvailability);
    };
  }, []);

  return availability;
}
