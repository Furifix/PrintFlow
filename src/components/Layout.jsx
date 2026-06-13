import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../utils/i18n.jsx';

const tabs = [
  { path: '/', key: 'upload' },
  { path: '/library', key: 'library' },
  { path: '/settings', key: 'settings' },
];

// Apply theme to <html> and persist in localStorage
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('printflow-theme', theme);
}

function getStoredTheme() {
  return localStorage.getItem('printflow-theme') || 'light';
}

export default function Layout({ children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme]       = useState(getStoredTheme);
  const { lang, setLang, t }    = useLanguage();
  const [customBgColor, setCustomBgColor] = useState(() => localStorage.getItem('printflow-bg-color') || '');

  // Apply on mount + whenever theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Sync background color event from settings
  useEffect(() => {
    const handleBgChange = () => {
      setCustomBgColor(localStorage.getItem('printflow-bg-color') || '');
    };
    window.addEventListener('printflow-bg-color-change', handleBgChange);
    return () => {
      window.removeEventListener('printflow-bg-color-change', handleBgChange);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-black relative" style={{ backgroundColor: customBgColor || undefined }}>
      {/* HDK Stark Header Bar */}
      <header className="hdk-border-b hdk-border flex items-center justify-between h-16 px-4 bg-white sticky top-0 z-50">
        {/* Left Side: Brand */}
        <div className="flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2 hover:opacity-80">
            <div className="w-8 h-8 hdk-border flex items-center justify-center bg-black">
              <span className="text-white font-bold text-sm">PF</span>
            </div>
            <span className="font-bold tracking-tight text-lg underline decoration-1">PrintFlow</span>
          </NavLink>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          {tabs.map(tab => {
            const active = location.pathname === tab.path ||
              (tab.path !== '/' && location.pathname.startsWith(tab.path));
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={`text-sm font-medium hover:underline ${
                  active ? 'underline decoration-2 font-bold' : ''
                }`}
              >
                {t(tab.key)}
              </NavLink>
            );
          })}
        </nav>

        {/* Right Side: Dark Mode Toggle + Menu */}
        <div className="flex items-center h-full">
          {/* Dark Mode Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="px-4 border-r border-black h-full flex items-center justify-center hover:bg-slate-50 transition-colors text-lg"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* Language selector */}
          <div className="hidden sm:flex items-center gap-3 px-4 border-r border-black h-full text-xs font-semibold">
            <span
              onClick={() => setLang('de')}
              className={`cursor-pointer hover:underline ${lang === 'de' ? 'font-extrabold text-black dark:text-white' : 'text-slate-400'}`}
            >
              DE
            </span>
            <span
              onClick={() => setLang('en')}
              className={`border-l border-black dark:border-white pl-3 cursor-pointer hover:underline ${lang === 'en' ? 'font-extrabold text-black dark:text-white' : 'text-slate-400'}`}
            >
              EN
            </span>
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="px-5 border-l border-black h-full flex items-center justify-center hover:bg-slate-50 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Hamburger / Navigation Overlay (Teal Fullscreen Menu) */}
      {menuOpen && (
        <div className="fixed inset-x-0 top-16 bottom-0 hdk-bg-green text-white z-40 p-8 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="mb-12">
              <span className="text-sm font-medium tracking-widest text-emerald-100 uppercase">{lang === 'de' ? 'PrintFlow Suchen' : 'Search PrintFlow'}</span>
              <div className="relative mt-2 border-b-2 border-white pb-2 flex items-center">
                <input
                  type="text"
                  placeholder={t('search_placeholder')}
                  className="bg-transparent border-none outline-none text-4xl w-full placeholder-emerald-200 text-white font-light"
                />
                <svg className="w-8 h-8 text-white absolute right-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-xs uppercase tracking-widest text-emerald-100 font-semibold mb-4">{lang === 'de' ? 'PrintFlow Module' : 'PrintFlow Modules'}</h3>
                <ul className="space-y-3 text-lg">
                  {tabs.map(tab => (
                    <li key={tab.path}>
                      <NavLink
                        to={tab.path}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <span>→</span> {t(tab.key)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-widest text-emerald-100 font-semibold mb-4">{lang === 'de' ? 'Hilfe & Dokumentation' : 'Help & Documentation'}</h3>
                <ul className="space-y-3 text-lg">
                  <li><a href="https://printify.com/app/store/connections-api" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline"><span>→</span> {lang === 'de' ? 'Printify API-Einstellungen' : 'Printify API Settings'}</a></li>
                  <li><a href="https://printify.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline"><span>→</span> Printify Dashboard</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-widest text-emerald-100 font-semibold mb-4">{lang === 'de' ? 'Aussehen' : 'Appearance'}</h3>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-3 text-lg hover:underline"
                >
                  <span>{isDark ? '☀️' : '🌙'}</span>
                  {lang === 'de' 
                    ? (isDark ? 'Zu hellem Modus wechseln' : 'Zu dunklem Modus wechseln') 
                    : (isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode')}
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-emerald-200 border-t border-emerald-400 pt-6 mt-8">
            © 2026 PrintFlow — Inspired by Haus der Kunst design system.
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
