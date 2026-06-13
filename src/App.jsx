// src/App.jsx — Router, layout, and setup guard
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout.jsx';
import { ToastContainer } from './components/Toast.jsx';
import SetupWizard from './pages/SetupWizard.jsx';
import Upload from './pages/Upload.jsx';
import MockupReview from './pages/MockupReview.jsx';
import PublishReview from './pages/PublishReview.jsx';
import Library from './pages/Library.jsx';
import Settings from './pages/Settings.jsx';
import { getSettings } from './utils/api.js';

function AppRoutes() {
  const [setupComplete, setSetupComplete] = useState(null); // null = loading
  const location = useLocation();

  useEffect(() => {
    getSettings()
      .then(s => setSetupComplete(s.setupComplete))
      .catch(() => setSetupComplete(false));
  }, [location.pathname]); // Re-check on navigation

  // Still loading
  if (setupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading PrintFlow…</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Setup wizard — always accessible */}
      <Route path="/setup" element={<SetupWizard />} />

      {/* Main app — redirect to setup if not complete */}
      <Route
        path="/"
        element={
          setupComplete
            ? <Layout><Upload /></Layout>
            : <Navigate to="/setup" replace />
        }
      />
      <Route
        path="/mockup-review"
        element={
          setupComplete
            ? <Layout><MockupReview /></Layout>
            : <Navigate to="/setup" replace />
        }
      />
      <Route
        path="/publish-review"
        element={
          setupComplete
            ? <Layout><PublishReview /></Layout>
            : <Navigate to="/setup" replace />
        }
      />
      <Route
        path="/library"
        element={<Layout><Library /></Layout>}
      />
      <Route
        path="/settings"
        element={<Layout><Settings /></Layout>}
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { LanguageProvider } from './utils/i18n.jsx';
import { PrintifyProvider } from './context/PrintifyContext.jsx';
import PrintifyFloatingButton from './components/PrintifyFloatingButton.jsx';
import JobWidget from './components/JobWidget.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <PrintifyProvider>
          <AppRoutes />
          <ToastContainer />
          <PrintifyFloatingButton />
          <JobWidget />
        </PrintifyProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
