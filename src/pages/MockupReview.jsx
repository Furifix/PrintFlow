// src/pages/MockupReview.jsx — Canvas compositing + mockup grid
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../utils/i18n.jsx';
import { generateMockup } from '../utils/canvas.js';
import ColorCard from '../components/ColorCard.jsx';
import { showToast } from '../components/Toast.jsx';

const SESSION_MOCKUPS_KEY = 'printflow_mockups';

export default function MockupReview() {
  const navigate  = useNavigate();
  const { t }     = useLanguage();
  const location  = useLocation();
  const state     = location.state;

  const [mockups,    setMockups]    = useState([]);     // { color, mockupUrl, enabled }
  const [generating, setGenerating] = useState(false);
  const [progress,   setProgress]   = useState({ current: 0, total: 0 });
  const [fullscreen, setFullscreen] = useState(null);   // mockupUrl
  const [enabled,    setEnabled]    = useState({});     // colorName -> bool

  useEffect(() => {
    if (!state) { navigate('/'); return; }

    // Escape key closes fullscreen
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!state) return;
    runGeneration();
  }, []); // eslint-disable-line

  const runGeneration = async () => {
    const { designA, designB, settings, designPlacement } = state;
    const colorMappings = settings?.colorMappings || [];
    const withBg = colorMappings.filter(c => c.backgroundImageFilename && c.placementZone);

    if (!withBg.length) {
      showToast(t('no_colors_configured'));
      navigate('/setup');
      return;
    }

    setGenerating(true);
    setProgress({ current: 0, total: withBg.length });
    const results = [];

    for (let i = 0; i < withBg.length; i++) {
      const cm = withBg[i];
      setProgress({ current: i + 1, total: withBg.length });

      // Pick design based on group
      let designUrl = null;
      if (designA && designB) {
        designUrl = cm.designGroup === 'dark' ? designB.url : designA.url;
      } else {
        designUrl = (designA || designB)?.url || null;
      }

      if (!designUrl) continue;

      const bgUrl = `/api/backgrounds/${cm.backgroundImageFilename}`;
      try {
        const mockupUrl = await generateMockup(bgUrl, designUrl, cm.placementZone, designPlacement);
        results.push({
          color: {
            colorId:   cm.colorId || cm.colorName,
            colorName: cm.colorName,
            colorHex:  cm.colorHex || '#888',
          },
          mockupUrl,
          enabled: true,
        });
      } catch (e) {
        console.error('Mockup generation failed for', cm.colorName, e);
      }
    }

    setMockups(results);
    const enabledMap = {};
    results.forEach(r => { enabledMap[r.color.colorName] = true; });
    setEnabled(enabledMap);
    setGenerating(false);
  };

  const toggleColor = (colorName) => {
    const currentlyEnabled = Object.values(enabled).filter(Boolean).length;
    const isOn = enabled[colorName];
    if (isOn && currentlyEnabled <= 1) {
      showToast(t('at_least_one_color'));
      return;
    }
    setEnabled(prev => ({ ...prev, [colorName]: !prev[colorName] }));
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  const handleContinue = () => {
    const selectedMockups = mockups.filter(m => enabled[m.color.colorName]);
    navigate('/publish-review', {
      state: {
        ...state,
        selectedMockups,
      },
    });
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('mockup_review_title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('mockup_review_desc')}</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider"
        >
          ← {t('back')}
        </button>
      </div>

      {/* Progress */}
      {generating && (
        <div className="bg-white dark:bg-slate-800 p-6 mb-6 hdk-border rounded-none shadow-none">
          <p className="text-sm font-bold text-black dark:text-white uppercase tracking-wider mb-3">
            {t('generating_mockup')} {progress.current} {t('of')} {progress.total}…
          </p>
          <div className="h-4 bg-slate-100 dark:bg-slate-700 border border-black dark:border-white rounded-none overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-none transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Grid */}
      {!generating && mockups.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {mockups.map((m) => (
              <ColorCard
                key={m.color.colorName}
                color={m.color}
                mockupUrl={m.mockupUrl}
                enabled={enabled[m.color.colorName] !== false}
                onToggle={() => toggleColor(m.color.colorName)}
                onExpand={() => setFullscreen(m.mockupUrl)}
              />
            ))}
          </div>

          <button
            id="continue-to-publish"
            onClick={handleContinue}
            disabled={enabledCount < 1}
            className="w-full hdk-skew-btn-yellow text-black font-bold py-4 text-base flex items-center justify-center gap-2 rounded-none disabled:opacity-40"
          >
            <span className="hdk-unskew font-bold uppercase tracking-wider">
              {t('continue_with')} {enabledCount} {enabledCount === 1 ? t('color') : t('colors')} →
            </span>
          </button>
        </>
      )}

      {!generating && mockups.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <p>{t('no_mockups_generated')}</p>
        </div>
      )}

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          className="fullscreen-overlay"
          onClick={() => setFullscreen(null)}
        >
          <img
            src={fullscreen}
            alt="Full preview"
            className="max-w-full max-h-full object-contain rounded-none border-2 border-black"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setFullscreen(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black border border-white rounded-none text-white text-xl flex items-center justify-center"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
