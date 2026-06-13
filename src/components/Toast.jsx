// src/components/Toast.jsx — Dismissible toast notifications
import { useEffect, useState } from 'react';

let toastListeners = [];
let toastId = 0;

export function showToast(message, type = 'error') {
  const id = ++toastId;
  toastListeners.forEach(fn => fn({ id, message, type }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (toast) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 5000);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter(fn => fn !== handler); };
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast-enter flex items-start gap-3 px-4 py-3 rounded-none border border-black shadow-none text-sm font-bold uppercase tracking-wider ${
            t.type === 'success'
              ? 'bg-green-50 text-green-800'
              : t.type === 'info'
              ? 'bg-blue-50 text-blue-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="text-current opacity-60 hover:opacity-100 text-lg leading-none mt-0.5"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
