// src/pages/Upload.jsx — Design upload + product details (home after setup)
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSettings } from '../utils/api.js';
import { showToast } from '../components/Toast.jsx';
import { useLanguage } from '../utils/i18n.jsx';

const SESSION_KEY = 'printflow_upload_state';

function DesignSlot({ id, label, desc, design, onDrop, onRemove }) {
  const { t } = useLanguage();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (file.type !== 'image/png') {
      showToast(t('only_png_accepted'));
      return;
    }
    onDrop(file);
  };

  return (
    <div className="flex-1">
      <p className="text-sm font-bold text-black dark:text-white uppercase tracking-wider mb-2">{label}</p>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">{desc}</p>
      {design ? (
        <div className={`relative hdk-border rounded-none overflow-hidden aspect-square flex items-center justify-center ${
          id === 'design-b-input'
            ? 'bg-slate-950'
            : 'bg-slate-50'
        }`}>
          <img src={design.url} alt={design.name} className="max-w-full max-h-full object-contain p-4" />
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-white border border-black rounded-none text-black hover:bg-red-500 hover:text-white text-sm flex items-center justify-center font-bold"
            aria-label="Remove design"
          >
            ×
          </button>
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-slate-400 truncate px-3">{design.name}</p>
        </div>
      ) : (
        <div
          className={`drop-zone rounded-none aspect-square flex flex-col items-center justify-center gap-2 cursor-pointer ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <svg className="w-10 h-10 text-slate-350" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Drop PNG here</p>
          <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">or click to browse</p>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
      )}
    </div>
  );
}

export default function Upload() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [settings, setSettings] = useState(null);
  const { lang, t } = useLanguage();

  // Restore from sessionStorage
  const saved = (() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  })();

  const [designA, setDesignA] = useState(null);
  const [designB, setDesignB] = useState(null);
  const [editorDesignTab, setEditorDesignTab] = useState('A');
  const [title,   setTitle]   = useState(saved?.title   || 'T-Shirt');
  const [price,   setPrice]   = useState(saved?.price   || '29.99');
  const [compareAt, setCompareAt] = useState(saved?.compareAt || '39.99');

  // Placement drag states
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [placement, setPlacement] = useState({ x: 0.5, y: 0.5, scale: 1.0 });
  const [snappingEnabled, setSnappingEnabled] = useState(true);

  const handleStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX, y: clientY });
    setIsDragging(true);
    if (containerRef.current) {
      containerRef.current.focus();
    }
  };

  const whiteMapping = settings?.colorMappings?.find(
    c => c.colorName.toLowerCase() === 'white' || c.colorName.toLowerCase() === 'vintage white'
  ) || settings?.colorMappings?.[0];

  const darkMapping = settings?.colorMappings?.find(
    m => {
      const name = (m.colorName || '').toLowerCase();
      return name.includes('black') || name.includes('navy') || name.includes('charcoal') || name.includes('grey') || name.includes('gray') || m.designGroup === 'dark';
    }
  ) || settings?.colorMappings?.find(m => m.designGroup === 'dark') || settings?.colorMappings?.[0];

  const activeMapping = (editorDesignTab === 'B' && designB) ? darkMapping : whiteMapping;
  const zone = activeMapping?.placementZone || { xPct: 0.1, yPct: 0.1, wPct: 0.8, hPct: 0.8 };
  const activeDesign = (editorDesignTab === 'B' && designB) ? designB : (designA || designB);

  const handleMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = containerRef.current.getBoundingClientRect();
    const zoneW = rect.width * zone.wPct;
    const zoneH = rect.height * zone.hPct;
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;

    let newX = Math.max(0, Math.min(1, placement.x + dx / zoneW));
    let newY = Math.max(0, Math.min(1, placement.y + dy / zoneH));

    if (snappingEnabled) {
      // Snapping: snap to center vertical/horizontal axes when within 6px threshold
      const thresholdX = 6 / zoneW;
      const thresholdY = 6 / zoneH;
      if (Math.abs(newX - 0.5) <= thresholdX) {
        newX = 0.5;
      }
      if (Math.abs(newY - 0.5) <= thresholdY) {
        newY = 0.5;
      }
    }

    setPlacement(prev => ({ ...prev, x: newX, y: newY }));
    setDragStart({ x: clientX, y: clientY });
  }, [isDragging, dragStart, placement, zone, snappingEnabled]);

  const handleEnd = () => {
    setIsDragging(false);
  };

  // Restore from library duplicate
  useEffect(() => {
    if (location.state?.duplicateFrom) {
      const d = location.state.duplicateFrom;
      setTitle(d.title || 'T-Shirt');
      if (d.price != null) setPrice((d.price / 100).toFixed(2));
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      if (!saved?.price && s.defaultPrice) setPrice((s.defaultPrice / 100).toFixed(2));
      if (!saved?.compareAt && s.defaultCompareAtPrice) setCompareAt((s.defaultCompareAtPrice / 100).toFixed(2));
    }).catch(() => {});
  }, []); // eslint-disable-line

  // Persist to sessionStorage (URLs can't be serialized across tabs but survive navigation within)
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ title, price, compareAt }));
  }, [title, price, compareAt]);

  useEffect(() => {
    if (designA) {
      setEditorDesignTab('A');
    } else if (designB) {
      setEditorDesignTab('B');
    }
  }, [designA, designB]);

  const makeDesign = (file) => ({
    name: file.name,
    url:  URL.createObjectURL(file),
    file,
  });

  const handleGenerate = () => {
    if (!designA && !designB) {
      showToast(t('upload_at_least_one'));
      return;
    }
    if (!title.trim()) {
      showToast(t('enter_product_title'));
      return;
    }
    navigate('/mockup-review', {
      state: {
        designA,
        designB,
        title:     title.trim(),
        price:     Math.round(parseFloat(price) * 100),
        compareAt: Math.round(parseFloat(compareAt) * 100),
        settings,
        designPlacement: placement,
      },
    });
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white uppercase tracking-wider">{t('upload_design_title')}</h1>
        <p className="text-slate-500 mt-1 text-sm uppercase tracking-wider">{t('upload_design_desc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Design Files, Product Details, Generate Button */}
        <div className="lg:col-span-6 space-y-6">
          {/* Design slots */}
          <div className="bg-white dark:bg-slate-800 p-6 hdk-border rounded-none">
            <h2 className="text-base font-bold text-black dark:text-white uppercase tracking-wider mb-4">Design Files</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <DesignSlot
                id="design-a-input"
                label={t('design_a_label')}
                desc={t('design_a_desc')}
                design={designA}
                onDrop={f => setDesignA(makeDesign(f))}
                onRemove={() => setDesignA(null)}
              />
              <DesignSlot
                id="design-b-input"
                label={t('design_b_label')}
                desc={t('design_b_desc')}
                design={designB}
                onDrop={f => setDesignB(makeDesign(f))}
                onRemove={() => setDesignB(null)}
              />
            </div>
            {(designA || designB) && (
              <p className="mt-3 text-xs text-slate-500 uppercase tracking-wider font-bold">
                {!designA || !designB
                  ? t('only_one_design')
                  : t('both_designs')}
              </p>
            )}
          </div>

          {/* Product details */}
          <div className="bg-white dark:bg-slate-800 hdk-border p-6 rounded-none">
            <h2 className="text-base font-bold text-black dark:text-white uppercase tracking-wider mb-4">{t('product_details')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-black dark:text-white mb-1.5 uppercase tracking-wider">{t('title_label')}</label>
                <input
                  id="product-title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="T-Shirt"
                  className="w-full px-4 py-2.5 hdk-input text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-black dark:text-white mb-1.5 uppercase tracking-wider">{t('price_label')}</label>
                  <input
                    id="product-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full px-4 py-2.5 hdk-input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black dark:text-white mb-1.5 uppercase tracking-wider">{t('compare_price_label')}</label>
                  <input
                    id="product-compare-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={compareAt}
                    onChange={e => setCompareAt(e.target.value)}
                    className="w-full px-4 py-2.5 hdk-input text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            id="generate-mockups-btn"
            onClick={handleGenerate}
            disabled={!designA && !designB}
            className="w-full hdk-skew-btn-yellow text-black font-bold py-4 text-base flex items-center justify-center gap-2 rounded-none"
          >
            <span className="hdk-unskew">{t('generate_mockups')} →</span>
          </button>
        </div>

        {/* Right Column: Design Placement Section */}
        <div className={`lg:col-span-6 ${(!designA && !designB) ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-white dark:bg-slate-800 hdk-border p-6 rounded-none">
            <h2 className="text-base font-bold text-black dark:text-white uppercase tracking-wider mb-2">{t('design_placement')}</h2>
            <p className="text-xs text-slate-500 mb-4 uppercase tracking-wider">
              {t('design_placement_desc')}
            </p>

            {designA && designB && (
              <div className="flex border border-black dark:border-slate-700 mb-4 overflow-hidden text-xs max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => setEditorDesignTab('A')}
                  className={`flex-1 py-1.5 font-bold uppercase transition-all ${
                    editorDesignTab === 'A'
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {t('light_shirt_tab')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditorDesignTab('B')}
                  className={`flex-1 py-1.5 font-bold uppercase transition-all ${
                    editorDesignTab === 'B'
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {t('dark_shirt_tab')}
                </button>
              </div>
            )}
            
            <div className="flex flex-col items-center gap-4">
              {/* Interactive Drag & Scale Bounding Box using the actual mockup background */}
              <div 
                ref={containerRef}
                tabIndex={0}
                onKeyDown={(e) => {
                  const key = e.key;
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;

                  const rect = containerRef.current.getBoundingClientRect();
                  const zoneW = rect.width * zone.wPct;
                  const zoneH = rect.height * zone.hPct;

                  // step by 1px or 10px
                  const stepX = (e.shiftKey ? 10 : 1) / zoneW;
                  const stepY = (e.shiftKey ? 10 : 1) / zoneH;

                  let moved = false;
                  setPlacement(prev => {
                    let nx = prev.x;
                    let ny = prev.y;

                    if (key === 'ArrowLeft') {
                      nx = Math.max(0, prev.x - stepX);
                      moved = true;
                    }
                    if (key === 'ArrowRight') {
                      nx = Math.min(1, prev.x + stepX);
                      moved = true;
                    }
                    if (key === 'ArrowUp') {
                      ny = Math.max(0, prev.y - stepY);
                      moved = true;
                    }
                    if (key === 'ArrowDown') {
                      ny = Math.min(1, prev.y + stepY);
                      moved = true;
                    }

                    return moved ? { ...prev, x: nx, y: ny } : prev;
                  });
                  if (moved) e.preventDefault();
                }}
                className="relative w-full max-w-[480px] aspect-square hdk-border cursor-move overflow-hidden select-none flex items-center justify-center bg-slate-50 dark:bg-slate-900"
                style={activeMapping?.backgroundImageFilename ? {
                  backgroundImage: `url(/api/backgrounds/${activeMapping.backgroundImageFilename})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                } : {
                  backgroundColor: editorDesignTab === 'B' ? '#1e293b' : '#f8fafc'
                }}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
              >
                {/* Print boundary box mapped exactly to coordinates */}
                <div 
                  className="absolute border border-dashed border-black/40 pointer-events-none flex items-center justify-center"
                  style={{
                    left: `${zone.xPct * 100}%`,
                    top: `${zone.yPct * 100}%`,
                    width: `${zone.wPct * 100}%`,
                    height: `${zone.hPct * 100}%`,
                  }}
                >
                  <span className="text-[10px] text-black/20 font-bold uppercase tracking-widest select-none">{t('print_area_label')}</span>
                  
                  {/* Positioned and Scaled Image */}
                  {activeDesign && (
                    <img
                      src={activeDesign.url}
                      alt="Design preview"
                      className="absolute pointer-events-none object-contain"
                      style={{
                        left: `${placement.x * 100}%`,
                        top: `${placement.y * 100}%`,
                        width: `${placement.scale * 100}%`,
                        height: `${placement.scale * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        maxWidth: 'none',
                        maxHeight: 'none',
                      }}
                    />
                  )}
                </div>
              </div>
              
              {/* Scale Slider */}
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs font-bold text-black dark:text-white uppercase tracking-wider">
                  <span>{t('scale_label')}</span>
                  <span>{Math.round(placement.scale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.01"
                  value={placement.scale}
                  onChange={e => setPlacement(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                  className="w-full accent-black"
                />
              </div>

              {/* Snapping Control */}
              <div className="w-full flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 mt-1">
                <span className="text-xs font-bold text-black dark:text-white uppercase tracking-wider">
                  {t('snapping_label')}
                </span>
                <label className="toggle-switch flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={snappingEnabled}
                    onChange={e => setSnappingEnabled(e.target.checked)}
                    aria-label="Toggle Snapping"
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
