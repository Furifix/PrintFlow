// src/components/PrintifyFloatingButton.jsx
// On mobile: floating toggle to show/hide live notifications (JobWidget)
// On desktop: Floating "open Printify" button — visible for 90s after product creation.
import { usePrintify } from '../context/PrintifyContext.jsx';
import { useState, useEffect } from 'react';

export default function PrintifyFloatingButton() {
  const { hasPending, focusOrReopen, dismiss } = usePrintify();
  const [isMobile, setIsMobile] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [hasJobs, setHasJobs] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleJobsUpdate = (e) => {
      setHasJobs(e.detail.length > 0);
    };
    window.addEventListener('printflow-jobs-updated', handleJobsUpdate);
    
    // Initial fetch
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => setHasJobs((data.jobs || []).length > 0))
      .catch(() => {});

    return () => window.removeEventListener('printflow-jobs-updated', handleJobsUpdate);
  }, []);

  // Mobile: show notifications toggle button
  if (isMobile) {
    if (!hasJobs) return null;
    return (
      <button
        onClick={() => {
          setNotificationsVisible(v => !v);
          window.__jobWidgetToggle?.();
        }}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 40,
          background: '#F5C400',
          color: '#000',
          border: '3px solid #000',
          padding: '12px 16px',
          fontWeight: 800,
          fontSize: '12px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          borderRadius: 0,
          transform: 'skewX(-8deg)',
          transition: 'background 80ms',
          filter: 'drop-shadow(4px 4px 0 #000)',
        }}
        title="Toggle notifications"
        onMouseEnter={e => e.target.style.background = '#ffd500'}
        onMouseLeave={e => e.target.style.background = '#F5C400'}
      >
        <span style={{ display: 'inline-block', transform: 'skewX(8deg)' }}>
          {notificationsVisible ? '✕ Hide' : '🔔 Show'}
        </span>
      </button>
    );
  }

  // Desktop: original Printify FAB
  if (!hasPending) return null;

  return (
    <div
      id="printify-fab"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        pointerEvents: 'auto',
        filter: 'drop-shadow(4px 4px 0 #000)',
      }}
    >
      {/* Main action button */}
      <button
        id="printify-fab-btn"
        onClick={focusOrReopen}
        title="Printify öffnen oder fokussieren"
        style={{
          background: '#F5C400',
          color: '#000',
          border: '3px solid #000',
          borderRight: 'none',
          padding: '13px 18px',
          fontWeight: 800,
          fontSize: '13px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderRadius: 0,
          transform: 'skewX(-8deg)',
          transition: 'background 80ms',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#ffd500'}
        onMouseLeave={e => e.currentTarget.style.background = '#F5C400'}
      >
        <span style={{ display: 'inline-block', transform: 'skewX(8deg)' }}>
          ↗ Printify öffnen
        </span>
      </button>

      {/* Dismiss X */}
      <button
        id="printify-fab-dismiss"
        onClick={dismiss}
        title="Schließen"
        style={{
          background: '#000',
          color: '#F5C400',
          border: '3px solid #000',
          padding: '13px 14px',
          fontWeight: 900,
          fontSize: '14px',
          cursor: 'pointer',
          borderRadius: 0,
          transform: 'skewX(-8deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 80ms',
          lineHeight: 1,
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#333'}
        onMouseLeave={e => e.currentTarget.style.background = '#000'}
      >
        <span style={{ display: 'inline-block', transform: 'skewX(8deg)' }}>✕</span>
      </button>
    </div>
  );
}
