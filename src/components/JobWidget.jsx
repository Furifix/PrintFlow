import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../utils/i18n.jsx';

export default function JobWidget() {
  const [jobs, setJobs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [visible, setVisible] = useState(() => {
    // On mobile, default to hidden; on desktop, always show
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth <= 640;
      return !isMobile;
    }
    return true;
  });
  const { lang, t } = useLanguage();

  // Track which jobs we've already auto-opened a popup for (avoid re-opening on every poll)
  const openedPopups = useRef(new Set());

  // Expose visibility toggle for mobile
  window.__jobWidgetToggle = () => setVisible(v => !v);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        const incoming = data.jobs || [];
        setJobs(incoming);
        window.dispatchEvent(new CustomEvent('printflow-jobs-updated', { detail: incoming }));
        if (data.serverTime) setServerTimeOffset(data.serverTime - Date.now());

        // Auto-open Printify popup for actionable error states
        for (const job of incoming) {
          if (
            (job.status === 'NO_MOCKUPS' || job.status === 'PUBLISH_ERROR') &&
            job.printifyUrl &&
            !openedPopups.current.has(job.id)
          ) {
            openedPopups.current.add(job.id);
            // Small delay so the UI renders first
            setTimeout(() => {
              window.open(job.printifyUrl, `printify_${job.id}`, 'width=1200,height=800,noopener');
            }, 600);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch jobs', e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) setSettings(await res.json());
    } catch (e) {
      console.error('Failed to fetch settings', e);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchJobs();
    // Poll every 3 seconds for fast updates
    const fetchInterval = setInterval(fetchJobs, 3000);
    const tickInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(fetchInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const handleClear = async (id, askShopify = false, hasShopifyId = false) => {
    let deleteFromShopify = false;
    if (askShopify && hasShopifyId) {
      if (window.confirm('Also delete this product from Shopify? (Click Cancel to just clear the job)')) {
        deleteFromShopify = true;
      }
    }
    try {
      await fetch(`/api/jobs/${id}?deleteFromShopify=${deleteFromShopify}`, { method: 'DELETE' });
      setJobs(prev => prev.filter(j => j.id !== id));
      openedPopups.current.delete(id);
    } catch (e) {
      console.error('Failed to clear job', e);
    }
  };

  if (jobs.length === 0 || !visible) return null;

  const getStatusDisplay = (job) => {
    const currentServerTime = now + serverTimeOffset;
    const elapsedSinceCreated = Math.floor((currentServerTime - job.createdAt) / 1000);
    const elapsedSinceCheck = Math.floor((currentServerTime - job.lastCheckedAt) / 1000);

    switch (job.status) {
      case 'WAITING_PUBLISH': {
        const remain = Math.max(0, 40 - elapsedSinceCreated);
        return {
          text: remain > 0 ? `Waiting for Printify mockups... (${remain}s)` : 'Checking mockups...',
          bg: 'bg-[#F5C400]',
          spin: true,
          color: 'text-black',
        };
      }
      case 'POLLING_STATUS': {
        const remain = Math.max(0, 60 - elapsedSinceCheck);
        const attempt = job.pollAttempts ? ` #${job.pollAttempts}` : '';
        return {
          text: remain > 0 ? `Publishing to Shopify${attempt}... (${remain}s)` : `Checking status${attempt}...`,
          bg: 'bg-blue-400',
          spin: true,
          color: 'text-black',
        };
      }
      case 'WAITING_SHOPIFY_SYNC':
      case 'WAITING_SYNC': {
        const remain = Math.max(0, 30 - elapsedSinceCheck);
        return {
          text: remain > 0 ? `Syncing mockups to Shopify... (${remain}s)` : 'Updating Shopify images...',
          bg: 'bg-indigo-400',
          spin: true,
          color: 'text-white',
        };
      }
      case 'COMPLETED': {
        const isSyncOnly = job.title?.startsWith('Sync:');
        return {
          text: job.shopifySyncWarning 
            ? (isSyncOnly ? '✓ Synced (mockup sync warning)' : '✓ Published (mockup sync warning)') 
            : (isSyncOnly ? '✓ Shopify Images Synced' : '✓ Published & Synced'),
          bg: 'bg-green-400',
          spin: false,
          color: 'text-black',
        };
      }
      case 'FAILED':
        return { text: '✕ Failed', bg: 'bg-red-500', spin: false, color: 'text-white' };
      case 'NO_MOCKUPS':
        return {
          text: '⚠ No Mockups — Upload in Printify',
          bg: 'bg-orange-400',
          spin: false,
          color: 'text-black',
        };
      case 'PUBLISH_ERROR':
        return {
          text: '✕ Publish Error — Fix in Printify',
          bg: 'bg-red-500',
          spin: false,
          color: 'text-white',
        };
      default:
        return { text: job.status, bg: 'bg-slate-200', spin: false, color: 'text-black' };
    }
  };

  const isTerminal = (status) =>
    ['COMPLETED', 'FAILED', 'NO_MOCKUPS', 'PUBLISH_ERROR'].includes(status);

  const isActionable = (status) => status === 'NO_MOCKUPS' || status === 'PUBLISH_ERROR';

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-3 w-80 pointer-events-none md:z-50">
      {jobs.map(job => {
        const display = getStatusDisplay(job);
        const done = isTerminal(job.status);
        const actionable = isActionable(job.status);

        return (
          <div
            key={job.id}
            className="bg-white dark:bg-slate-800 border-2 border-black shadow-[4px_4px_0_0_#000] p-3 pointer-events-auto flex flex-col gap-2 transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold text-xs uppercase tracking-wider line-clamp-1 flex-1 text-black dark:text-white">
                {job.title}
              </div>
              {done ? (
                <button
                  onClick={() => handleClear(job.id, false, false)}
                  className="text-black dark:text-white hover:text-red-500 font-bold px-1 text-sm leading-none"
                  title="Clear"
                >
                  ✕
                </button>
              ) : (
                <button
                  onClick={() => handleClear(job.id, true, !!job.shopifyProductId)}
                  className="text-red-500 hover:bg-red-100 border border-transparent hover:border-red-500 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 leading-none transition-colors"
                  title="Cancel Job"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Status pill */}
            <div
              className={`px-2 py-1.5 border border-black text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${display.bg} ${display.color}`}
            >
              <span>{display.text}</span>
              {display.spin && (
                <span className="animate-spin text-sm leading-none inline-block">⟳</span>
              )}
            </div>

            {/* Warning for sync issues even on completed */}
            {job.shopifySyncWarning && (
              <div className="text-[9px] text-orange-600 dark:text-orange-400 leading-tight">
                ⚠ {job.shopifySyncWarning}
              </div>
            )}

            {/* Error message for actionable states */}
            {actionable && job.errorMessage && (
              <div className="text-[9px] text-red-600 dark:text-red-400 leading-tight">
                {job.errorMessage}
              </div>
            )}

            {/* Action buttons for error states — open Printify in popup */}
            {actionable && job.printifyUrl && (
              <div className="flex flex-col gap-1.5 mt-1">
                <button
                  onClick={() => window.open(job.printifyUrl, `printify_${job.id}`, 'width=1200,height=800,noopener')}
                  className="w-full text-center px-2 py-1.5 border-2 border-black bg-orange-400 text-black hover:bg-orange-300 text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  1. Upload Mockups ↗
                </button>
                <button
                  onClick={async () => {
                    try {
                      await fetch(`/api/jobs/${job.id}/resume`, { method: 'POST' });
                    } catch (e) {
                      console.error('Failed to resume:', e);
                    }
                  }}
                  className="w-full text-center px-2 py-1.5 border-2 border-black bg-indigo-400 text-white hover:bg-indigo-300 hover:text-black text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  2. Sync with Shopify
                </button>
                {job.status === 'NO_MOCKUPS' && (
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`/api/jobs/${job.id}/resume?publishWithoutMockups=true`, { method: 'POST' });
                      } catch (e) {
                        console.error('Failed to publish without mockups:', e);
                      }
                    }}
                    className="w-full text-center px-2 py-1.5 border-2 border-black bg-red-500 text-white hover:bg-red-400 hover:text-black text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    3. Publish Without Mockups
                  </button>
                )}
              </div>
            )}

            {/* Completed links */}
            {job.status === 'COMPLETED' && (
              <div className="flex gap-2 mt-1">
                <a
                  href={`https://printify.com/app/product-details/${job.printifyProductId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center px-2 py-1 border border-black bg-white text-black hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider"
                >
                  Printify ↗
                </a>
                {job.shopifyProductId && settings?.shopifyDomain && (
                  <a
                    href={`https://admin.shopify.com/store/${settings.shopifyDomain.replace('.myshopify.com', '')}/products/${job.shopifyProductId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center px-2 py-1 border border-black bg-green-200 text-black hover:bg-green-300 text-[10px] font-bold uppercase tracking-wider"
                  >
                    Shopify ↗
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
