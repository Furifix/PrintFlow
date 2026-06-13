// src/pages/PublishReview.jsx — Correct Printify flow with parallel compressed uploads
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  saveSettings, uploadImage, createProduct, publishProduct,
  appendHistory, updateProduct, getVariants, getProduct,
  stageMockups,
} from '../utils/api.js';
import { compressMockupToBase64 } from '../utils/canvas.js';
import { showToast } from '../components/Toast.jsx';
import { usePrintify } from '../context/PrintifyContext.jsx';
import JSZip from 'jszip';

const ALL_SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'];

const getVariantColorAndSize = (v) => {
  let color = '';
  let size  = '';
  if (Array.isArray(v.options)) {
    const cOpt = v.options.find(o => o.name === 'Colors' || o.name === 'Color');
    if (cOpt) color = cOpt.value;
    const sOpt = v.options.find(o => o.name === 'Sizes' || o.name === 'Size');
    if (sOpt) size = sOpt.value;
  } else if (v.options && typeof v.options === 'object') {
    color = v.options.color || v.options.colors || '';
    size  = v.options.size  || v.options.sizes  || '';
  }
  return { color, size };
};

// Helper — convert a File/Blob directly to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper — fetch a blob URL and return base64 (for design files)
async function blobUrlToBase64(blobUrl) {
  const res  = await fetch(blobUrl);
  const blob = await res.blob();
  return fileToBase64(blob);
}

function StepRow({ label, status, error }) {
  const icons = {
    idle:    <span className="text-slate-300 dark:text-slate-600">○</span>,
    pending: <span className="step-spinning text-indigo-500">⟳</span>,
    done:    <span className="text-green-500">✓</span>,
    skipped: <span className="text-slate-300 dark:text-slate-600">—</span>,
    error:   <span className="text-red-500">✕</span>,
  };
  const safeStatus = typeof status === 'string' && Object.prototype.hasOwnProperty.call(icons, status) ? status : 'idle';
  return (
    <div className={`flex items-start gap-3 py-2 ${status === 'skipped' ? 'opacity-40' : ''}`}>
      <div className="w-5 text-center text-base mt-0.5 shrink-0">{icons[safeStatus]}</div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${
          status === 'done'    ? 'text-green-700 dark:text-green-400'
          : status === 'error'   ? 'text-red-600'
          : status === 'pending' ? 'text-slate-800 dark:text-slate-100 font-medium'
          : 'text-slate-500 dark:text-slate-400'
        }`}>{label}</span>
        {error && status === 'error' && (
          <p className="text-xs text-red-400 mt-0.5 break-words">{error}</p>
        )}
      </div>
    </div>
  );
}

export default function PublishReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const state    = location.state;

  const { designA, designB, settings, designPlacement } = state || {};
  const selectedMockups = state?.selectedMockups || [];

  const [title,     setTitle]     = useState(state?.title || 'T-Shirt');
  const [price,     setPrice]     = useState(
    state?.price != null ? (state.price / 100).toFixed(2) : '29.99'
  );
  const [compareAt, setCompareAt] = useState(
    state?.compareAt != null ? (state.compareAt / 100).toFixed(2) : '39.99'
  );
  const [sizes, setSizes] = useState(settings?.defaultSizes || ['S','M','L','XL','2XL']);

  const { openPrintifyPopup, clearPending } = usePrintify();

  const [publishing, setPublishing] = useState(false);

  const initialSteps = {
    'save-mockups':          'idle',
    'upload-designs':        'idle',
    'load-catalog':          'idle',
    'create-product':        'idle',
    'save-history':          'idle',
  };
  const [steps,         setSteps]         = useState(initialSteps);
  const [stepErrors,    setStepErrors]    = useState({});
  const [mockupProgress,setMockupProgress]= useState([]);
  const [pollAttempt,   setPollAttempt]   = useState(0); // live sync poll counter
  const [pollMax,       setPollMax]       = useState(0);

  const createdProdIdRef = useRef(null);

  useEffect(() => { if (!state) navigate('/'); }, []); // eslint-disable-line

  const setStep = (id, status, error = null) => {
    setSteps(prev => ({ ...prev, [id]: status }));
    if (error) setStepErrors(prev => ({ ...prev, [id]: error }));
    else       setStepErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const toggleSize = (s) => {
    setSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  // ─── Main publish flow ────────────────────────────────────────────────────────
  const runPublish = async (shouldPublish) => {
    clearPending();
    setPublishing(true);
    setSteps(initialSteps);
    setStepErrors({});
    setMockupProgress(selectedMockups.map(m => ({ name: m.color.colorName, status: 'pending' })));
    setPollAttempt(0);
    setPollMax(0);
    createdProdIdRef.current = null;

    const defaultPriceCents   = Math.round(parseFloat(price)     * 100);
    const defaultCompareCents = Math.round(parseFloat(compareAt) * 100);
    const activeColorMappings = settings?.colorMappings || [];

    // ── Task 1: Generate and download mockup ZIP file (in parallel) ──
    const mockupsToStage = [];
    const zipPromise = (async () => {
      setStep('save-mockups', 'pending');
      try {
        const zip = new JSZip();
        for (let i = 0; i < selectedMockups.length; i++) {
          const m = selectedMockups[i];
          try {
            const base64 = await compressMockupToBase64(m.mockupUrl, 1200, 0.88);
            mockupsToStage.push({
              colorName: m.color.colorName,
              base64: base64.replace(/^data:image\/\w+;base64,/, '')
            });
            zip.file(`${m.color.colorName}.jpg`, base64.replace(/^data:image\/\w+;base64,/, ''), { base64: true });
            setMockupProgress(prev =>
              prev.map(p => p.name === m.color.colorName ? { ...p, status: 'done' } : p)
            );
          } catch (e) {
            setMockupProgress(prev =>
              prev.map(p => p.name === m.color.colorName ? { ...p, status: 'error' } : p)
            );
            throw new Error(`Mockup ${m.color.colorName}: ${e.message}`);
          }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'PrintFlow_Product';
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${safeTitle}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        showToast(`Downloaded ${safeTitle}.zip`, 'success');
        setStep('save-mockups', 'done');
        return true;
      } catch (e) {
        setStep('save-mockups', 'error', e.message);
        return false;
      }
    })();

    // ── Task 2: Upload designs and create product on Printify (in parallel) ──
    const printifyPromise = (async () => {
      // ── Phase 2: Upload design images ──
      setStep('upload-designs', 'pending');
      let designAImageId  = null;
      let designBImageId  = null;

      console.log('[PublishReview] designA present:', !!designA, designA ? `(name=${designA.name}, hasFile=${designA.file instanceof Blob}, hasUrl=${!!designA.url})` : '');
      console.log('[PublishReview] designB present:', !!designB, designB ? `(name=${designB.name}, hasFile=${designB.file instanceof Blob}, hasUrl=${!!designB.url})` : '');

      const uploadDesign = async (design, label) => {
        if (!design) { console.log(`[PublishReview] ${label}: null, skipping`); return null; }
        let base64;
        // File/Blob objects are NOT serialized by React Router's history state,
        // so we must always fall back to fetching the blob URL.
        // Blob URLs remain valid within the same browser tab session.
        if (design.url && design.url.startsWith('blob:')) {
          console.log(`[PublishReview] ${label}: fetching from blob URL`);
          base64 = await blobUrlToBase64(design.url);
        } else if (design.file instanceof Blob) {
          console.log(`[PublishReview] ${label}: reading File object`);
          base64 = await fileToBase64(design.file);
        } else {
          throw new Error(`${label}: no valid blob URL or File object available`);
        }
        console.log(`[PublishReview] ${label}: base64 length=${base64?.length}, uploading...`);
        const data = await uploadImage(design.name || `${label}.png`, base64);
        console.log(`[PublishReview] ${label}: upload OK, Printify image id=${data.id}`);
        return data.id;
      };

      try {
        designAImageId = await uploadDesign(designA, 'design_a');
        // Add a 3 second gap between uploads so Printify doesn't rate-limit the second one silently
        if (designA && designB) {
          await new Promise(r => setTimeout(r, 3000));
        }
        designBImageId = await uploadDesign(designB, 'design_b');
        console.log(`[PublishReview] upload done: imageA=${designAImageId}, imageB=${designBImageId}`);
        setStep('upload-designs', 'done');
      } catch (e) {
        setStep('upload-designs', 'error', e.message);
        return false;
      }

      // ── Phase 3: Fetch catalog variants ──
      setStep('load-catalog', 'pending');
      let catalogVariants = [];
      try {
        if (!settings?.blueprintId || !settings?.printProviderId) {
          throw new Error('Blueprint ID or Print Provider ID is missing in settings');
        }
        const catalogData = await getVariants(
          settings.blueprintId, String(settings.printProviderId)
        );
        catalogVariants = catalogData?.available_variants || catalogData?.variants || [];
        if (!catalogVariants.length) {
          throw new Error('No variants found in Printify catalog for this blueprint/provider');
        }
        setStep('load-catalog', 'done');
      } catch (e) {
        setStep('load-catalog', 'error', e.message);
        return false;
      }

      // ── Phase 4: Create product ──
      setStep('create-product', 'pending');
      const enabledVariantIdsByColor = new Map();
      try {
        const selectedColors = selectedMockups.map(m => m.color.colorName);

        const sizePrices = settings?.sizePrices || {};
        const designGroupMap = new Map();
        activeColorMappings.forEach(cm => {
          designGroupMap.set(cm.colorName, cm.designGroup || 'light');
        });

        const variants        = [];
        const lightVariantIds = [];
        const darkVariantIds  = [];

        catalogVariants.forEach(v => {
          const { color: vColor, size: vSize } = getVariantColorAndSize(v);
          if (!selectedColors.includes(vColor)) return;

          const isEnabled  = sizes.includes(vSize);
          
          let priceCents = defaultPriceCents;
          const safeSizeKey = typeof vSize === 'string' && !['__proto__', 'constructor', 'prototype'].includes(vSize) ? vSize : '';
          const customSizePriceObj = safeSizeKey ? sizePrices[safeSizeKey] : null;
          if (customSizePriceObj && customSizePriceObj.price != null && customSizePriceObj.price !== '') {
            const parsedPrice = parseInt(customSizePriceObj.price);
            if (!isNaN(parsedPrice)) {
              priceCents = parsedPrice;
            }
          }

          variants.push({ id: v.id, price: priceCents, is_enabled: isEnabled });

          if (isEnabled) {
            if (!enabledVariantIdsByColor.has(vColor)) enabledVariantIdsByColor.set(vColor, []);
            enabledVariantIdsByColor.get(vColor).push(v.id);
            if ((designGroupMap.get(vColor) || 'light') === 'dark') {
              darkVariantIds.push(v.id);
            } else {
              lightVariantIds.push(v.id);
            }
          }
        });

        if (!variants.filter(v => v.is_enabled).length) {
          throw new Error('No variants enabled — check sizes and colors');
        }

        const px     = designPlacement?.x     ?? 0.5;
        const py     = designPlacement?.y     ?? 0.5;
        const pScale = designPlacement?.scale ?? 1.0;

        const allCatalogVariantIds = catalogVariants.map(v => v.id);
        const mappedVariantIdsSet = new Set([...lightVariantIds, ...darkVariantIds]);
        const unmappedVariantIds = allCatalogVariantIds.filter(id => !mappedVariantIdsSet.has(id));

        const buildPlaceholders = (designId) => {
          return [{
            position: 'front',
            images: [{ id: designId, x: px, y: py, scale: pScale, angle: 0 }]
          }];
        };

        const printAreas = [];
        if (designAImageId && designBImageId) {
          if (lightVariantIds.length > 0 && darkVariantIds.length > 0) {
            printAreas.push({
              variant_ids:  lightVariantIds,
              placeholders: buildPlaceholders(designAImageId),
            });
            printAreas.push({
              variant_ids:  [...darkVariantIds, ...unmappedVariantIds],
              placeholders: buildPlaceholders(designBImageId),
            });
          } else if (lightVariantIds.length > 0) {
            printAreas.push({
              variant_ids:  lightVariantIds,
              placeholders: buildPlaceholders(designAImageId),
            });
            printAreas.push({
              variant_ids:  unmappedVariantIds,
              placeholders: buildPlaceholders(designBImageId),
            });
          } else if (darkVariantIds.length > 0) {
            printAreas.push({
              variant_ids:  unmappedVariantIds,
              placeholders: buildPlaceholders(designAImageId),
            });
            printAreas.push({
              variant_ids:  darkVariantIds,
              placeholders: buildPlaceholders(designBImageId),
            });
          } else {
            throw new Error('No variants enabled — check sizes and colors');
          }
        } else {
          const designId = designAImageId || designBImageId;
          if (!designId) throw new Error('No design image was uploaded');
          printAreas.push({
            variant_ids:  allCatalogVariantIds,
            placeholders: buildPlaceholders(designId),
          });
        }

        // Verification of exhaustiveness
        const totalSubmittedVariantIdsCount = printAreas.reduce((sum, area) => sum + area.variant_ids.length, 0);
        console.log(`[PublishReview] print_areas=${printAreas.length}, totalMapped=${totalSubmittedVariantIdsCount}, totalCatalog=${allCatalogVariantIds.length}, imageA=${designAImageId}, imageB=${designBImageId}`);
        if (totalSubmittedVariantIdsCount !== allCatalogVariantIds.length) {
          throw new Error(`Variant validation failed: Submitted variant IDs count (${totalSubmittedVariantIdsCount}) does not match catalog variants count (${allCatalogVariantIds.length}).`);
        }

        const productPayload = {
          title:       title,
          blueprint_id: parseInt(settings.blueprintId),
          print_provider_id: parseInt(settings.printProviderId),
          variants:    variants,
          print_areas: printAreas,
        };

        console.log('[Printify Payload]', JSON.stringify(productPayload, null, 2));

        const created = await createProduct(productPayload);

        createdProdIdRef.current = created.id;
        setStep('create-product', 'done');
      } catch (e) {
        setStep('create-product', 'error', e.message);
        return false;
      }

      // ── Phase 5: Save history ──
      setStep('save-history', 'pending');
      try {
        await appendHistory({
          printifyProductId: createdProdIdRef.current,
          title,
          createdAt:         new Date().toISOString(),
          price:             defaultPriceCents,
          compareAtPrice:    defaultCompareCents,
          colorNames:        selectedMockups.map(m => m.color.colorName),
          published:         false,
          printifyEditUrl:   `https://printify.com/app/store/products/${createdProdIdRef.current}/edit`,
        });
        await saveSettings({ defaultSizes: sizes });
        setStep('save-history', 'done');
      } catch {
        setStep('save-history', 'skipped');
      }

      return true;
    })();

    // Await both promises in parallel
    const [zipSuccess, printifySuccess] = await Promise.all([zipPromise, printifyPromise]);

    // Send the staged mockups to the server for Shopify syncing later
    if (printifySuccess && createdProdIdRef.current && mockupsToStage.length > 0) {
      await stageMockups(createdProdIdRef.current, mockupsToStage).catch(console.error);
    }

    setPublishing(false);

    if (printifySuccess) {
      // ── Phase 6: schedule background job → navigate to Upload after 1s ──
      try {
        await fetch('/api/jobs/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printifyProductId: createdProdIdRef.current, title })
        });
        showToast('Publish scheduled! Redirecting...', 'success');
      } catch (e) {
        console.error('Failed to schedule job', e);
        showToast('Failed to schedule job', 'error');
      }
      setTimeout(() => {
        navigate('/', { state: { keepPrices: true } });
      }, 1000);
    }
  };

  const variantCount = selectedMockups.length * sizes.length;
  const anyRunning   = Object.values(steps).some(s => s !== 'idle');

  if (!state) return null;

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Publish Review</h1>
        {!publishing && (
          <button
            onClick={() => navigate('/mockup-review', { state })}
            className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ← Back
          </button>
        )}
      </div>



      {/* Summary card — always visible while not publishing */}
      {!publishing && (
        <div className="bg-white dark:bg-slate-800 p-6 mb-6 hdk-border rounded-none shadow-none space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-black dark:text-white uppercase tracking-wider mb-1">Title</label>
            <input
              id="review-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={publishing}
              className="w-full px-3 py-2 hdk-input text-sm disabled:bg-slate-50 dark:disabled:bg-slate-700"
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider mb-1">Price ($)</label>
              <input
                id="review-price"
                type="number"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                disabled={publishing}
                className="w-full px-3 py-2 hdk-input text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider mb-1">Compare-At ($)</label>
              <input
                id="review-compare-price"
                type="number"
                step="0.01"
                value={compareAt}
                onChange={e => setCompareAt(e.target.value)}
                disabled={publishing}
                className="w-full px-3 py-2 hdk-input text-sm disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <p className="text-xs font-bold text-black dark:text-white uppercase tracking-wider mb-2">Selected Colors</p>
            <div className="flex flex-wrap gap-2">
              {selectedMockups.map(m => (
                <div key={m.color.colorName} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700 border border-black dark:border-slate-600 rounded-none px-2.5 py-1">
                  <div className="w-4 h-4 rounded-none border border-black dark:border-slate-500" style={{ backgroundColor: m.color.colorHex || '#ccc' }} />
                  <span className="text-xs font-bold text-black dark:text-white uppercase tracking-wider">{m.color.colorName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mockup thumbnails */}
          <div>
            <p className="text-xs font-bold text-black dark:text-white uppercase tracking-wider mb-2">Mockups</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {selectedMockups.map(m => (
                <img
                  key={m.color.colorName}
                  src={m.mockupUrl}
                  alt={m.color.colorName}
                  className="h-16 w-16 rounded-none object-cover border border-black dark:border-slate-650 flex-shrink-0"
                />
              ))}
            </div>
          </div>

          {/* Size range */}
          <div>
            <p className="text-xs font-bold text-black dark:text-white uppercase tracking-wider mb-2">Sizes</p>
            <div className="flex flex-wrap gap-2">
              {ALL_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => !publishing && toggleSize(s)}
                  disabled={publishing}
                  className={`px-3 py-1.5 rounded-none border font-bold text-xs transition-colors disabled:cursor-default ${
                    sizes.includes(s)
                      ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                      : 'bg-white text-black border-black dark:bg-slate-800 dark:text-white dark:border-white hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {selectedMockups.length} colors × {sizes.length} sizes = {variantCount} total variants
            </p>
          </div>
        </div>
      )}

      {/* Progress steps */}
      {(publishing || anyRunning) && (
        <div className="bg-white dark:bg-slate-800 p-6 mb-6 hdk-border rounded-none shadow-none">
          <h3 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider mb-3">Progress</h3>

          <StepRow label="Uploading designs to Printify…"  status={steps['upload-designs']} error={stepErrors['upload-designs']} />
          <StepRow label="Loading catalog variants…"        status={steps['load-catalog']}   error={stepErrors['load-catalog']} />
          <StepRow label="Creating product on Printify…"   status={steps['create-product']} error={stepErrors['create-product']} />

          {/* Mockup save with per-color progress */}
          <StepRow
            label={
              steps['save-mockups'] === 'pending'
                ? `Generating ZIP archive… (${mockupProgress.filter(p => p.status === 'done').length}/${mockupProgress.length} done)`
                : 'Generating ZIP archive…'
            }
            status={steps['save-mockups']}
            error={stepErrors['save-mockups']}
          />
          {steps['save-mockups'] === 'pending' && mockupProgress.length > 0 && (
            <div className="ml-8 mt-1 mb-2 flex flex-wrap gap-1.5">
              {mockupProgress.map(p => (
                <span
                  key={p.name}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-none border border-black ${
                    p.status === 'done'  ? 'bg-green-300 text-black'
                    : p.status === 'error' ? 'bg-red-300 text-black'
                    : 'bg-white text-slate-500 dark:bg-slate-750'
                  }`}
                >
                  {p.status === 'done' ? '✓' : p.status === 'error' ? '✕' : '⟳'} {p.name}
                </span>
              ))}
            </div>
          )}

          <StepRow label="Saved to local history"          status={steps['save-history']}    error={stepErrors['save-history']} />
        </div>
      )}

      {/* Action button */}
      {!publishing && (
        <div className="flex gap-3">
          <button
            id="publish-shopify-btn"
            onClick={() => runPublish(false)}
            className="flex-1 hdk-skew-btn-yellow text-black font-bold py-3.5 text-base flex items-center justify-center gap-2 rounded-none"
          >
            <span className="hdk-unskew">Create & Schedule Publish</span>
          </button>
        </div>
      )}


    </div>
  );
}
