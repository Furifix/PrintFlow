// src/pages/SetupWizard.jsx — 4-step setup wizard
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../utils/i18n.jsx';
import SetupStepIndicator from '../components/SetupStepIndicator.jsx';
import PlacementEditor from '../components/PlacementEditor.jsx';
import { showToast } from '../components/Toast.jsx';
import {
  getSettings, saveSettings,
  getShops, getBlueprints, getProviders, getVariants,
  uploadBackground,
} from '../utils/api.js';

const ALL_SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'];

/** Recursively collect all image files from a FileSystemEntry tree */
async function collectImagesFromEntry(entry) {
  const results = [];
  if (entry.isFile) {
    await new Promise(resolve => {
      entry.file(f => {
        const n = f.name.toLowerCase();
        if (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg')) results.push(f);
        resolve();
      }, resolve);
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let batch = [];
    do {
      batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const child of batch) {
        const sub = await collectImagesFromEntry(child);
        results.push(...sub);
      }
    } while (batch.length > 0);
  }
  return results;
}

/** Score how well a filename matches a color name (0 = no match, higher = better) */
function scoreFileForColor(filename, colorName) {
  const fn = filename.toLowerCase().replace(/\.[^.]+$/, '').replace(/[_\-\s]+/g, ' ').trim();
  const cn = colorName.toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
  if (fn === cn) return 100;
  if (fn.includes(cn) || cn.includes(fn)) return 50;
  const fnWords = fn.split(' ');
  const cnWords = cn.split(' ');
  const matches = cnWords.filter(w => w.length > 2 && fnWords.some(fw => fw.includes(w) || w.includes(fw)));
  return matches.length > 0 ? matches.length * 10 : 0;
}

export default function SetupWizard() {
  const navigate   = useNavigate();
  const { lang, t } = useLanguage();
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState(null);

  // Step 1
  const [apiKey, setApiKey]     = useState('');
  const [shops, setShops]       = useState([]);
  const [shopId, setShopId]     = useState('');
  const [shopName, setShopName] = useState('');
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error]     = useState('');

  // Step 2
  const [blueprints, setBlueprints]   = useState([]);
  const [bpFilter, setBpFilter]       = useState('');
  const [bpLoading, setBpLoading]     = useState(false);
  const [bpPage, setBpPage]           = useState(1);
  const [bpHasMore, setBpHasMore]     = useState(true);
  const [selectedBp, setSelectedBp]   = useState(null);
  const [providers, setProviders]     = useState([]);
  const [providerId, setProviderId]   = useState('');
  const [providerName, setProviderName] = useState('');
  const [providersLoading, setProvidersLoading] = useState(false);

  // Step 3
  const [colors, setColors]           = useState([]);
  const [colorMappings, setColorMappings] = useState({});
  const [variantsData, setVariantsData]   = useState(null);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [placementColor, setPlacementColor]   = useState(null); // color being edited in PlacementEditor
  const [uploading, setUploading]     = useState({});
  const [dragOverColor, setDragOverColor] = useState(null);
  const [batchDragOver, setBatchDragOver] = useState(false);
  const [batchMatching, setBatchMatching] = useState(false); // loading state for folder batch
  const folderInputRef = useRef(null);

  // Step 4
  const [defaultPrice, setDefaultPrice]           = useState('29.99');
  const [defaultCompareAt, setDefaultCompareAt]   = useState('39.99');
  const [defaultSizes, setDefaultSizes]           = useState(['S','M','L','XL','2XL']);
  const [sizePrices, setSizePrices]               = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(async (s) => {
      setSettings(s);
      setApiKey(s.printifyApiKey || '');
      if (s.printifyApiKey) {
        setShopId(s.shopId || '');
        setShopName(s.shopName || '');
        
        try {
          const data = await getShops();
          const list = Array.isArray(data) ? data : [];
          setShops(list);
        } catch (e) {}

        if (s.blueprintId && s.printProviderId) {
          setSelectedBp({ id: s.blueprintId });
          setProviderId(String(s.printProviderId));
          setProviderName(s.printProviderName || '');
          
          loadBlueprints(1, true);
          
          try {
            const data = await getProviders(s.blueprintId);
            setProviders(Array.isArray(data) ? data : []);
          } catch (e) {}

          setVariantsLoading(true);
          try {
            const data = await getVariants(s.blueprintId, String(s.printProviderId));
            setVariantsData(data);
            
            const colorOpt = (data?.available_variants || data?.variants || []);
            const seen = new Map();
            colorOpt.forEach(v => {
              let colorName = '';
              let colorHex = '#888888';
              if (Array.isArray(v.options)) {
                const cOpt = v.options.find(o => o.name === 'Colors' || o.name === 'Color');
                if (cOpt) {
                  colorName = cOpt.value;
                  colorHex = cOpt.colors?.[0] || '#888888';
                }
              } else if (v.options && typeof v.options === 'object') {
                colorName = v.options.color || v.options.colors || '';
                const lowerName = colorName.toLowerCase();
                const colorMap = {
                  'black': '#1a1a1a',
                  'white': '#f9f9f9',
                  'heather grey': '#b0b3b8',
                  'grey': '#808080',
                  'navy': '#1d2a44',
                  'red': '#b32424',
                  'royal': '#2b580c',
                  'forest': '#2d5a27',
                  'green': '#2e7d32',
                  'blue': '#1565c0',
                  'yellow': '#fbc02d',
                  'orange': '#ef6c00',
                  'purple': '#6a1b9a',
                  'pink': '#ad1457',
                  'sand': '#e0ac69',
                  'cream': '#fffdd0',
                  'charcoal': '#36454f',
                  'anthracite': '#2e3b4e',
                  'dust': '#c2b280',
                };
                for (const [nameKey, hexVal] of Object.entries(colorMap)) {
                  if (lowerName.includes(nameKey)) {
                    colorHex = hexVal;
                    break;
                  }
                }
              }
              if (colorName) {
                if (!seen.has(colorName)) {
                  seen.set(colorName, {
                    colorId: String(v.id) + '_c',
                    colorName: colorName,
                    colorHex: colorHex,
                    variantIds: [],
                  });
                }
                seen.get(colorName).variantIds.push(v.id);
              }
            });
            const uniqueColors = Array.from(seen.values());
            setColors(uniqueColors);

            const init = {};
            const savedMappingsMap = new Map();
            if (s.colorMappings && Array.isArray(s.colorMappings)) {
              s.colorMappings.forEach(m => {
                savedMappingsMap.set(m.colorName, m);
              });
            }

            uniqueColors.forEach(c => {
              if (savedMappingsMap.has(c.colorName)) {
                init[c.colorName] = {
                  ...savedMappingsMap.get(c.colorName),
                  colorId: c.colorName,
                  colorHex: c.colorHex,
                  variantIds: c.variantIds,
                };
              } else {
                init[c.colorName] = {
                  colorId: c.colorName,
                  colorName: c.colorName,
                  colorHex: c.colorHex,
                  variantIds: c.variantIds,
                  backgroundImageFilename: '',
                  placementZone: null,
                  designGroup: 'light',
                };
              }
            });
            setColorMappings(init);
            
            const hasMappings = s.colorMappings && s.colorMappings.length > 0;
            if (hasMappings) {
              setStep(4);
            } else {
              setStep(3);
            }
          } catch (e) {
            console.error(e);
          } finally {
            setVariantsLoading(false);
          }
        } else {
          loadBlueprints(1, true);
          setStep(2);
        }
      }
      if (s.defaultPrice)        setDefaultPrice((s.defaultPrice / 100).toFixed(2));
      if (s.defaultCompareAtPrice) setDefaultCompareAt((s.defaultCompareAtPrice / 100).toFixed(2));
      if (s.defaultSizes?.length) setDefaultSizes(s.defaultSizes);
      if (s.sizePrices && typeof s.sizePrices === 'object') {
        const loadedSizePrices = {};
        Object.keys(s.sizePrices).forEach(sz => {
          const szObj = s.sizePrices[sz];
          loadedSizePrices[sz] = {
            price: szObj.price != null && szObj.price !== '' ? (szObj.price / 100).toFixed(2) : '',
            compareAtPrice: szObj.compareAtPrice != null && szObj.compareAtPrice !== '' ? (szObj.compareAtPrice / 100).toFixed(2) : '',
          };
        });
        setSizePrices(loadedSizePrices);
      }
    }).catch(() => {});
  }, []);

  // ─── Step 1 ───────────────────────────────────────────────────────────────
  const handleStep1Next = async () => {
    setStep1Error('');
    setStep1Loading(true);
    const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, '').replace(/[^A-Za-z0-9._-]/g, '');
    setApiKey(cleanKey);
    try {
      await saveSettings({ printifyApiKey: cleanKey });
      const data = await getShops();
      const list = Array.isArray(data) ? data : [];
      if (!list.length) throw new Error('No shops found');
      setShops(list);
      if (list.length === 1) {
        setShopId(String(list[0].id));
        setShopName(list[0].title);
      }
      // Load blueprints now
      loadBlueprints(1, true);
      setStep(2);
    } catch (e) {
      setStep1Error('invalid_api_key_error');
    } finally {
      setStep1Loading(false);
    }
  };

  // ─── Step 2 ───────────────────────────────────────────────────────────────
  const loadBlueprints = async (page, reset = false) => {
    setBpLoading(true);
    try {
      const data = await getBlueprints(page, 20);
      const items = Array.isArray(data) ? data : (data?.data || []);
      setBpPage(page);
      if (reset) {
        setBlueprints(items);
      } else {
        setBlueprints(prev => [...prev, ...items]);
      }
      setBpHasMore(items.length === 20);
    } catch (e) {
      showToast(t('failed_load_blueprints'));
    } finally {
      setBpLoading(false);
    }
  };

  const handleBpSelect = async (bp) => {
    setSelectedBp(bp);
    setProviders([]);
    setProviderId('');
    setProviderName('');
    setProvidersLoading(true);
    try {
      const data = await getProviders(bp.id);
      const list = Array.isArray(data) ? data : [];
      setProviders(list);
      if (list.length === 1) {
        setProviderId(String(list[0].id));
        setProviderName(list[0].title);
      }
    } catch {
      showToast(t('failed_load_providers'));
    } finally {
      setProvidersLoading(false);
    }
  };

  const handleStep2Next = async () => {
    if (!selectedBp || !providerId) return;
    await saveSettings({
      shopId,
      shopName,
      blueprintId: selectedBp.id,
      printProviderId: parseInt(providerId),
      printProviderName: providerName,
    });
    // Load variants for step 3
    setVariantsLoading(true);
    try {
      const data = await getVariants(selectedBp.id, providerId);
      setVariantsData(data);
      // Extract unique colors from variants
      const colorOpt = (data?.available_variants || data?.variants || []);
      const seen = new Map();
      colorOpt.forEach(v => {
        let colorName = '';
        let colorHex = '#888888';

        if (Array.isArray(v.options)) {
          const cOpt = v.options.find(o => o.name === 'Colors' || o.name === 'Color');
          if (cOpt) {
            colorName = cOpt.value;
            colorHex = cOpt.colors?.[0] || '#888888';
          }
        } else if (v.options && typeof v.options === 'object') {
          colorName = v.options.color || v.options.colors || '';
          
          const lowerName = colorName.toLowerCase();
          const colorMap = {
            'black': '#1a1a1a',
            'white': '#f9f9f9',
            'heather grey': '#b0b3b8',
            'grey': '#808080',
            'navy': '#1d2a44',
            'red': '#b32424',
            'royal': '#2b580c',
            'forest': '#2d5a27',
            'green': '#2e7d32',
            'blue': '#1565c0',
            'yellow': '#fbc02d',
            'orange': '#ef6c00',
            'purple': '#6a1b9a',
            'pink': '#ad1457',
            'sand': '#e0ac69',
            'cream': '#fffdd0',
            'charcoal': '#36454f',
            'anthracite': '#2e3b4e',
            'dust': '#c2b280',
          };
          for (const [nameKey, hexVal] of Object.entries(colorMap)) {
            if (lowerName.includes(nameKey)) {
              colorHex = hexVal;
              break;
            }
          }
        }

        if (colorName) {
          if (!seen.has(colorName)) {
            seen.set(colorName, {
              colorId: String(v.id) + '_c',
              colorName: colorName,
              colorHex: colorHex,
              variantIds: [],
            });
          }
          seen.get(colorName).variantIds.push(v.id);
        }
      });
      const uniqueColors = Array.from(seen.values());
      console.log("SetupWizard - Extracted uniqueColors:", uniqueColors);
      setColors(uniqueColors);
      // Init mappings, merging with existing settings colorMappings if any
      const init = {};
      const savedMappingsMap = new Map();
      if (settings?.colorMappings && Array.isArray(settings.colorMappings)) {
        settings.colorMappings.forEach(m => {
          savedMappingsMap.set(m.colorName, m);
        });
      }
      uniqueColors.forEach(c => {
        if (savedMappingsMap.has(c.colorName)) {
          init[c.colorName] = {
            ...savedMappingsMap.get(c.colorName),
            colorId: c.colorName,
            colorHex: c.colorHex,
            variantIds: c.variantIds,
          };
        } else {
          init[c.colorName] = {
            colorId: c.colorName,
            colorName: c.colorName,
            colorHex: c.colorHex,
            variantIds: c.variantIds,
            backgroundImageFilename: '',
            placementZone: null,
            designGroup: 'light',
          };
        }
      });
      setColorMappings(init);
    } catch {
      showToast(t('failed_load_variants'));
    } finally {
      setVariantsLoading(false);
    }
    setStep(3);
  };

  // ─── Step 3 ───────────────────────────────────────────────────────────────
  const handleBgUpload = async (colorName, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [colorName]: true }));
    try {
      const { filename } = await uploadBackground(file);
      setColorMappings(prev => {
        const next = {
          ...prev,
          [colorName]: { ...prev[colorName], backgroundImageFilename: filename },
        };
        const mappingsArr = Object.values(next).filter(
          c => c.backgroundImageFilename || c.placementZone
        );
        saveSettings({ colorMappings: mappingsArr }).catch(err => console.error("Auto-save failed", err));
        return next;
      });
    } catch (e) {
      showToast(e.message || (lang === 'de' ? 'Upload fehlgeschlagen' : 'Upload failed'));
    } finally {
      setUploading(prev => ({ ...prev, [colorName]: false }));
    }
  };

  const handleDropOnColor = async (e, colorName) => {
    e.preventDefault();
    setDragOverColor(null);

    const items = Array.from(e.dataTransfer.items || []);
    const entries = items.map(i => i.webkitGetAsEntry?.()).filter(Boolean);

    if (entries.length > 0) {
      const images = [];
      for (const entry of entries) {
        const found = await collectImagesFromEntry(entry);
        images.push(...found);
      }
      if (images.length === 0) {
        showToast(t('no_image_files'));
        return;
      }
      // Use best-matching image for this color
      const scored = images.map(f => ({ f, score: scoreFileForColor(f.name, colorName) }));
      scored.sort((a, b) => b.score - a.score);
      await handleBgUpload(colorName, scored[0].f);
      return;
    }

    // Plain file drop fallback
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
        await handleBgUpload(colorName, file);
      } else {
        showToast(t('only_images_accepted'));
      }
    }
  };

  /** Handle a folder dropped onto the batch zone — auto-match files to colors */
  const handleFolderBatchDrop = async (e) => {
    e.preventDefault();
    setBatchDragOver(false);
    setBatchMatching(true);
    try {
      const items = Array.from(e.dataTransfer.items || []);
      const entries = items.map(i => i.webkitGetAsEntry?.()).filter(Boolean);

      let images = [];
      if (entries.length > 0) {
        for (const entry of entries) {
          const found = await collectImagesFromEntry(entry);
          images.push(...found);
        }
      } else {
        images = Array.from(e.dataTransfer.files || []).filter(f => {
          const n = f.name.toLowerCase();
          return n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg');
        });
      }

      if (images.length === 0) {
        showToast(t('no_images_in_folder'));
        return;
      }

      await matchAndUploadImages(images);
    } finally {
      setBatchMatching(false);
    }
  };

  /** Handle folder selected via input[webkitdirectory] */
  const handleFolderBatchInput = async (e) => {
    const images = Array.from(e.target.files || []).filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg');
    });
    e.target.value = '';
    if (images.length === 0) {
      showToast(t('no_images_selected_folder'));
      return;
    }
    setBatchMatching(true);
    try {
      await matchAndUploadImages(images);
    } finally {
      setBatchMatching(false);
    }
  };

  /** Match image files to colors by filename similarity, then upload each */
  const matchAndUploadImages = async (images) => {
    const colorNames = colors.map(c => c.colorName);
    const matched = new Map(); // colorName -> File
    const unmatched = [];

    for (const img of images) {
      const scores = colorNames.map(cn => ({ cn, score: scoreFileForColor(img.name, cn) }));
      scores.sort((a, b) => b.score - a.score);
      if (scores[0].score > 0 && !matched.has(scores[0].cn)) {
        matched.set(scores[0].cn, img);
      } else {
        unmatched.push(img);
      }
    }

    if (matched.size === 0) {
      showToast(t('match_error'));
      return;
    }

    // Upload all matched images in parallel
    const uploadPromises = Array.from(matched.entries()).map(([colorName, file]) =>
      handleBgUpload(colorName, file)
    );
    await Promise.all(uploadPromises);
    const unmatchedMsg = unmatched.length > 0
      ? ` (${unmatched.length} ${unmatched.length === 1 ? (lang === 'de' ? 'Datei nicht abgeglichen' : 'file unmatched') : (lang === 'de' ? 'Dateien nicht abgeglichen' : 'files unmatched')})`
      : '';
    showToast(t('matched_uploaded_msg').replace('{count}', matched.size).replace('{unmatched}', unmatchedMsg));
  };

  const handlePlacementConfirm = (colorName, zone) => {
    setColorMappings(prev => {
      const next = {
        ...prev,
        [colorName]: { ...prev[colorName], placementZone: zone },
      };
      const mappingsArr = Object.values(next).filter(
        c => c.backgroundImageFilename || c.placementZone
      );
      saveSettings({ colorMappings: mappingsArr }).catch(err => console.error("Auto-save failed", err));
      return next;
    });
    setPlacementColor(null);
  };

  const handleApplyPlacementToAll = (zone) => {
    if (!zone) return;
    setColorMappings(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        next[k] = { ...next[k], placementZone: zone };
      });
      const mappingsArr = Object.values(next).filter(
        c => c.backgroundImageFilename || c.placementZone
      );
      saveSettings({ colorMappings: mappingsArr }).catch(err => console.error("Auto-save failed", err));
      return next;
    });
    showToast(t('placement_copied_toast'));
  };

  const handleDesignGroupChange = (colorName, group) => {
    setColorMappings(prev => {
      const next = {
        ...prev,
        [colorName]: { ...prev[colorName], designGroup: group },
      };
      const mappingsArr = Object.values(next).filter(
        c => c.backgroundImageFilename || c.placementZone
      );
      saveSettings({ colorMappings: mappingsArr }).catch(err => console.error("Auto-save failed", err));
      return next;
    });
  };

  const configuredCount = Object.values(colorMappings).filter(
    c => c.backgroundImageFilename && c.placementZone
  ).length;

  const handleStep3Next = async () => {
    const mappingsArr = Object.values(colorMappings).filter(
      c => c.backgroundImageFilename || c.placementZone
    );
    await saveSettings({ colorMappings: mappingsArr });
    setStep(4);
  };

  // ─── Step 4 ───────────────────────────────────────────────────────────────
  const toggleSize = (s) => {
    setDefaultSizes(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleSizePriceChange = (size, field, val) => {
    setSizePrices(prev => ({
      ...prev,
      [size]: {
        ...prev[size],
        [field]: val
      }
    }));
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const savedSizePrices = {};
      Object.keys(sizePrices).forEach((sz) => {
        const spObj = sizePrices[sz] || {};
        const centsPrice = spObj.price && !isNaN(parseFloat(spObj.price)) ? Math.round(parseFloat(spObj.price) * 100) : '';
        const centsCompare = spObj.compareAtPrice && !isNaN(parseFloat(spObj.compareAtPrice)) ? Math.round(parseFloat(spObj.compareAtPrice) * 100) : '';
        
        if (centsPrice !== '' || centsCompare !== '') {
          savedSizePrices[sz] = {
            price: centsPrice,
            compareAtPrice: centsCompare
          };
        }
      });

      await saveSettings({
        defaultPrice:         Math.round(parseFloat(defaultPrice) * 100),
        defaultCompareAtPrice: Math.round(parseFloat(defaultCompareAt) * 100),
        defaultSizes,
        sizePrices: savedSizePrices,
        setupComplete: true,
      });
      navigate('/');
    } catch {
      showToast(t('failed_save_settings'));
    } finally {
      setSaving(false);
    }
  };

  const filteredBp = blueprints.filter(b =>
    b.title?.toLowerCase().includes(bpFilter.toLowerCase()) ||
    b.brand?.toLowerCase().includes(bpFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-4xl font-extrabold tracking-widest text-black uppercase">PrintFlow {t('setup_wizard')}</h1>
          <p className="text-slate-600 mt-2 text-xs uppercase tracking-wider">{t('setup_desc')}</p>
        </div>

        <div className="bg-white hdk-border p-6 sm:p-8 rounded-none">
          <SetupStepIndicator currentStep={step} totalSteps={4} />

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-black uppercase tracking-wider">{t('step_1')}</h2>
              <div>
                <label className="block text-sm font-bold text-black mb-1.5 uppercase tracking-wider">
                  {t('printify_api_key')}
                </label>
                <input
                  id="setup-api-key"
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={t('api_key_placeholder')}
                  className="w-full px-4 py-2.5 hdk-input text-sm"
                />
                <div className="hdk-info-card text-xs text-black mt-4 rounded-none">
                  <div className="hdk-info-card-unskew space-y-1">
                    <p className="font-bold uppercase tracking-wider">{t('how_to_get_api_key')}</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>{t('get_api_key_step_1')}</li>
                      <li>{t('get_api_key_step_2')}</li>
                      <li>{t('get_api_key_step_3')}</li>
                      <li>{t('get_api_key_step_4')}</li>
                    </ol>
                  </div>
                </div>
                {step1Error && (
                  <p className="mt-1.5 text-sm text-red-600 font-bold">✕ {t(step1Error)}</p>
                )}
              </div>

              {shops.length > 1 && (
                <div>
                  <label className="block text-sm font-bold text-black mb-1.5 uppercase tracking-wider">{t('select_shop')}</label>
                  <select
                    value={shopId}
                    onChange={e => {
                      const s = shops.find(x => String(x.id) === e.target.value);
                      setShopId(e.target.value);
                      setShopName(s?.title || '');
                    }}
                    className="w-full px-4 py-2.5 hdk-select text-sm"
                  >
                    <option value="">{t('select_shop_placeholder')}</option>
                    {shops.map(s => (
                      <option key={s.id} value={String(s.id)}>{s.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                id="setup-step1-next"
                onClick={handleStep1Next}
                disabled={!apiKey || step1Loading || (shops.length > 1 && !shopId)}
                className="w-full hdk-skew-btn-yellow text-black font-bold py-3 text-sm flex items-center justify-center gap-2 rounded-none"
              >
                <span className="hdk-unskew flex items-center gap-2 font-bold uppercase tracking-wider">
                  {step1Loading && <span className="step-spinning">⟳</span>}
                  {step1Loading ? t('connecting') : `${t('next')} →`}
                </span>
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-black uppercase tracking-wider">{t('select_blueprint')}</h2>
              <input
                id="setup-bp-search"
                type="text"
                value={bpFilter}
                onChange={e => setBpFilter(e.target.value)}
                placeholder={t('search_tshirts')}
                className="w-full px-4 py-2.5 hdk-input text-sm"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {filteredBp.map(bp => (
                  <button
                    key={bp.id}
                    onClick={() => handleBpSelect(bp)}
                    className={`rounded-none border-2 p-2 text-left transition-all ${
                      selectedBp?.id === bp.id
                        ? 'border-black bg-yellow-100 text-black font-bold'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-black'
                    }`}
                  >
                    {bp.images?.[0]?.src && (
                      <img src={bp.images[0].src} alt={bp.title} className="w-full aspect-square object-cover rounded-none mb-1.5 border border-black" />
                    )}
                    <p className="text-xs font-bold text-black uppercase line-clamp-2">{bp.title}</p>
                    {bp.brand && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{bp.brand}</p>}
                  </button>
                ))}
                {bpLoading && (
                  <div className="col-span-full flex justify-center py-4 text-black text-xs font-bold uppercase tracking-wider">
                    <span className="step-spinning mr-2">⟳</span>{t('loading')}
                  </div>
                )}
              </div>
              {bpHasMore && !bpLoading && (
                <button
                  onClick={() => loadBlueprints(bpPage + 1)}
                  className="w-full py-2 border-2 border-black rounded-none text-xs font-bold text-black uppercase tracking-wider bg-white hover:bg-slate-50"
                >
                  {t('load_more')}
                </button>
              )}

              {providersLoading && (
                <p className="text-xs text-black font-bold uppercase tracking-wider text-center">
                  <span className="step-spinning mr-2">⟳</span>{t('loading_providers')}
                </p>
              )}

              {providers.length > 1 && (
                <div>
                  <label className="block text-sm font-bold text-black mb-1.5 uppercase tracking-wider">{t('print_provider')}</label>
                  <select
                    value={providerId}
                    onChange={e => {
                      const p = providers.find(x => String(x.id) === e.target.value);
                      setProviderId(e.target.value);
                      setProviderName(p?.title || '');
                    }}
                    className="w-full px-4 py-2.5 hdk-select text-sm"
                  >
                    <option value="">{t('select_provider')}</option>
                    {providers.map(p => (
                      <option key={p.id} value={String(p.id)}>
                        {p.title}{p.location?.country ? ` — ${p.location.country}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 hdk-skew-btn-white text-black font-bold py-2.5 text-sm flex items-center justify-center rounded-none"
                >
                  <span className="hdk-unskew font-bold uppercase tracking-wider">{t('back')}</span>
                </button>
                <button
                  id="setup-step2-next"
                  onClick={handleStep2Next}
                  disabled={!selectedBp || !providerId || variantsLoading}
                  className="flex-1 hdk-skew-btn-yellow text-black font-bold py-2.5 text-sm flex items-center justify-center gap-2 rounded-none disabled:opacity-40"
                >
                  <span className="hdk-unskew flex items-center gap-2 font-bold uppercase tracking-wider">
                    {variantsLoading && <span className="step-spinning">⟳</span>}
                    {variantsLoading ? t('loading') : t('next')}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-black pb-2">
                <h2 className="text-lg font-bold text-black uppercase tracking-wider">{t('color_bg_mapping')}</h2>
                <span className="text-xs font-bold border border-black bg-yellow-100 text-black px-3 py-1 rounded-none uppercase tracking-wider">
                  {t('configured_of').replace('{configured}', configuredCount).replace('{total}', colors.length)}
                </span>
              </div>

              {/* Batch folder drop zone */}
              <div
                className={`border-2 border-dashed p-5 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer rounded-none ${
                  batchDragOver
                    ? 'border-black bg-yellow-50 scale-[1.01]'
                    : 'border-black hover:bg-slate-50'
                }`}
                onDragOver={e => { e.preventDefault(); setBatchDragOver(true); }}
                onDragLeave={() => setBatchDragOver(false)}
                onDrop={handleFolderBatchDrop}
                onClick={() => folderInputRef.current?.click()}
              >
                {batchMatching ? (
                  <>
                    <span className="step-spinning text-2xl text-black">⟳</span>
                    <p className="text-xs font-bold text-black uppercase tracking-wider">{t('matching_uploading')}</p>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                    <p className="text-sm font-bold text-black text-center uppercase tracking-wider">
                      {t('drop_folder_desc')}
                    </p>
                    <p className="text-xs text-slate-500 text-center max-w-xs uppercase font-bold tracking-wider leading-relaxed">
                      {t('auto_match_desc')}<br/>
                      <span className="font-mono bg-yellow-100 border border-black px-1 text-black font-normal normal-case">black.png</span> → Black · <span className="font-mono bg-yellow-100 border border-black px-1 text-black font-normal normal-case">french-navy.png</span> → French Navy
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-xs text-black font-bold uppercase tracking-wider hover:underline"
                      onClick={e => { e.stopPropagation(); folderInputRef.current?.click(); }}
                    >
                      {t('browse_folder')}
                    </button>
                  </>
                )}
                <input
                  ref={folderInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderBatchInput}
                />
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {colors.map(color => {
                  const mapping = colorMappings[color.colorName] || {};
                  const isConfigured = !!(mapping.backgroundImageFilename && mapping.placementZone);

                  return (
                    <div
                      key={color.colorName}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverColor(color.colorName);
                      }}
                      onDragLeave={() => setDragOverColor(null)}
                      onDrop={(e) => handleDropOnColor(e, color.colorName)}
                      className={`border-2 p-4 space-y-3 transition-all duration-200 rounded-none ${
                        dragOverColor === color.colorName
                          ? 'border-dashed border-black bg-yellow-50/50 scale-[1.01]'
                          : 'border-black bg-white'
                      }`}
                    >
                      {/* Color info + status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-none border border-black"
                            style={{ backgroundColor: color.colorHex || '#888' }}
                          />
                          <span className="text-xs font-bold text-black uppercase tracking-wider">{color.colorName}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-none border uppercase tracking-wider ${
                          isConfigured ? 'bg-green-300 border-black text-black' : 'bg-white border-slate-300 text-slate-400'
                        }`}>
                          {isConfigured ? `✓ ${t('configured')}` : `○ ${t('not_configured')}`}
                        </span>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Background upload */}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            className="hidden"
                            onChange={e => handleBgUpload(color.colorName, e.target.files?.[0])}
                          />
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none border-2 border-black text-xs font-bold uppercase tracking-wider transition-colors ${
                            uploading[color.colorName]
                              ? 'opacity-60 cursor-wait bg-slate-100 text-slate-400'
                              : 'bg-white text-black hover:bg-slate-100'
                          }`}>
                            {uploading[color.colorName] ? <span className="step-spinning">⟳</span> : '↑'}
                            {t('upload_background')}
                          </span>
                        </label>

                        {/* Placement editor */}
                        {mapping.backgroundImageFilename && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPlacementColor(color.colorName)}
                              className={`px-3 py-1.5 border-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors rounded-none ${
                                mapping.placementZone
                                  ? 'border-black bg-slate-100 text-black'
                                  : 'border-black bg-white text-black hover:bg-slate-100'
                              }`}
                            >
                              {mapping.placementZone ? `✓ ${t('placement_set')}` : t('set_placement')}
                            </button>
                            {mapping.placementZone && (
                              <button
                                onClick={() => handleApplyPlacementToAll(mapping.placementZone)}
                                className="px-3 py-1.5 border-2 border-black bg-yellow-100 hover:bg-yellow-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors rounded-none"
                              >
                                {t('apply_to_all')}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Design group */}
                        <div className="flex border-2 border-black rounded-none overflow-hidden text-[10px] sm:text-xs">
                          {['light','dark'].map(g => (
                            <button
                              key={g}
                              onClick={() => handleDesignGroupChange(color.colorName, g)}
                              className={`px-2.5 py-1.5 font-bold uppercase tracking-wider transition-colors ${
                                mapping.designGroup === g
                                  ? 'bg-black text-white'
                                  : 'bg-white text-black hover:bg-slate-100'
                              }`}
                            >
                              {g === 'light' ? t('light_shirt') : t('dark_shirt')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Thumbnail */}
                      {mapping.backgroundImageFilename && (
                        <img
                          src={`/api/backgrounds/${mapping.backgroundImageFilename}`}
                          alt="Background preview"
                          className="h-16 rounded-none object-cover border border-black"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 hdk-skew-btn-white text-black font-bold py-2.5 text-sm flex items-center justify-center rounded-none"
                >
                  <span className="hdk-unskew font-bold uppercase tracking-wider">{t('back')}</span>
                </button>
                <button
                  id="setup-step3-next"
                  onClick={handleStep3Next}
                  disabled={configuredCount < 1}
                  className="flex-1 hdk-skew-btn-yellow text-black font-bold py-2.5 text-sm flex items-center justify-center gap-2 rounded-none disabled:opacity-40"
                >
                  <span className="hdk-unskew font-bold uppercase tracking-wider">{t('next')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-black uppercase tracking-wider">{t('pricing_defaults_title')}</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1.5 uppercase tracking-wider">{t('default_price')}</label>
                  <input
                    id="setup-default-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={defaultPrice}
                    onChange={e => setDefaultPrice(e.target.value)}
                    className="w-full px-4 py-2.5 hdk-input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1.5 uppercase tracking-wider">{t('default_compare_price')}</label>
                  <input
                    id="setup-compare-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={defaultCompareAt}
                    onChange={e => setDefaultCompareAt(e.target.value)}
                    className="w-full px-4 py-2.5 hdk-input text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2 uppercase tracking-wider">{t('default_sizes')}</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleSize(s)}
                      className={`px-3 py-1.5 border text-sm font-bold transition-colors rounded-none ${
                        defaultSizes.includes(s)
                          ? 'bg-black text-white border-black font-bold'
                          : 'border-slate-300 text-slate-600 hover:border-black'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400 uppercase font-bold tracking-wider">{t('override_desc')}</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2 uppercase tracking-wider">{t('size_overrides')}</label>
                <p className="text-xs text-slate-500 mb-3 uppercase font-bold tracking-wider">{t('size_overrides_desc')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                  {ALL_SIZES.map(sz => {
                    const sp = sizePrices[sz] || { price: '', compareAtPrice: '' };
                    return (
                      <div key={sz} className="flex items-center justify-between border-2 border-black p-2 bg-white rounded-none">
                        <span className="font-extrabold text-xs text-black w-8">{sz}</span>
                        <div className="flex gap-2 flex-1 pl-2">
                          <div className="flex-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder={t('price_label')}
                              value={sp.price || ''}
                              onChange={e => handleSizePriceChange(sz, 'price', e.target.value)}
                              className="w-full px-2 py-1 hdk-input text-xs"
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder={t('compare_price_label')}
                              value={sp.compareAtPrice || ''}
                              onChange={e => handleSizePriceChange(sz, 'compareAtPrice', e.target.value)}
                              className="w-full px-2 py-1 hdk-input text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 hdk-skew-btn-white text-black font-bold py-2.5 text-sm flex items-center justify-center rounded-none"
                >
                  <span className="hdk-unskew font-bold uppercase tracking-wider">{t('back')}</span>
                </button>
                <button
                  id="setup-finish"
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-1 hdk-skew-btn-yellow text-black font-bold py-2.5 text-sm flex items-center justify-center gap-2 rounded-none"
                >
                  <span className="hdk-unskew flex items-center gap-2 font-bold uppercase tracking-wider">
                    {saving && <span className="step-spinning">⟳</span>}
                    {saving ? t('saving') : t('finish')}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Placement Editor Modal */}
      {placementColor && colorMappings[placementColor]?.backgroundImageFilename && (
        <PlacementEditor
          imageUrl={`/api/backgrounds/${colorMappings[placementColor].backgroundImageFilename}`}
          initialZone={colorMappings[placementColor].placementZone}
          onConfirm={(zone) => handlePlacementConfirm(placementColor, zone)}
          onClose={() => setPlacementColor(null)}
        />
      )}
    </div>
  );
}
