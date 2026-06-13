// src/context/PrintifyContext.jsx
// Global state for the "pending Printify popup" that survives navigation.
import { createContext, useContext, useRef, useState, useCallback } from 'react';

const PrintifyContext = createContext(null);

const AUTO_HIDE_MS = 90_000; // 90 seconds

export function PrintifyProvider({ children }) {
  const popupRef    = useRef(null);   // window handle
  const timerRef    = useRef(null);   // auto-hide timer
  const [pendingUrl,  setPendingUrl]  = useState(null);
  const [hasPending,  setHasPending]  = useState(false);

  const _startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setHasPending(false);
      setPendingUrl(null);
      popupRef.current = null;
    }, AUTO_HIDE_MS);
  }, []);

  // Called by PublishReview after product creation
  const openPrintifyPopup = useCallback((url) => {
    const w    = Math.min(1280, window.screen.availWidth);
    const h    = Math.min(860,  window.screen.availHeight);
    const left = Math.round((window.screen.availWidth  - w) / 2);
    const top  = Math.round((window.screen.availHeight - h) / 2);
    const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;

    const popup = window.open(url, 'printify_publish', features);
    popupRef.current = popup || null;

    setPendingUrl(url);
    setHasPending(true);
    _startTimer();
  }, [_startTimer]);

  // Focus existing popup or reopen it
  const focusOrReopen = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
    } else if (pendingUrl) {
      const w    = Math.min(1280, window.screen.availWidth);
      const h    = Math.min(860,  window.screen.availHeight);
      const left = Math.round((window.screen.availWidth  - w) / 2);
      const top  = Math.round((window.screen.availHeight - h) / 2);
      const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const popup = window.open(pendingUrl, 'printify_publish', features);
      if (popup) popupRef.current = popup;
    }
  }, [pendingUrl]);

  // Dismiss the FAB manually
  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHasPending(false);
    setPendingUrl(null);
    popupRef.current = null;
  }, []);

  // Called at start of new publish → hide old FAB
  const clearPending = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHasPending(false);
    setPendingUrl(null);
    popupRef.current = null;
  }, []);

  return (
    <PrintifyContext.Provider value={{
      hasPending, openPrintifyPopup, focusOrReopen, dismiss, clearPending,
    }}>
      {children}
    </PrintifyContext.Provider>
  );
}

export const usePrintify = () => useContext(PrintifyContext);
