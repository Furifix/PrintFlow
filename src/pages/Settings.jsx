// src/pages/Settings.jsx — Editable settings panel for PrintFlow
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSettings,
  saveSettings,
  getShops,
  getBlueprints,
  getProviders,
  getVariants,
  uploadBackground,
  resetSetup,
  testShopifyConnection
} from '../utils/api.js';
import { showToast } from '../components/Toast.jsx';
import PlacementEditor from '../components/PlacementEditor.jsx';

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

// Helper to safely access object property to prevent prototype lookup warnings
function safeGet(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) return null;
  return obj[key];
}

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'colors', 'danger'
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  // General Settings States
  const [apiKey, setApiKey] = useState('');
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('29.99');
  const [defaultCompareAt, setDefaultCompareAt] = useState('39.99');
  const [defaultSizes, setDefaultSizes] = useState(['S', 'M', 'L', 'XL', '2XL']);
  const [blueprintId, setBlueprintId] = useState(null);
  const [blueprintName, setBlueprintName] = useState('');
  const [printProviderId, setPrintProviderId] = useState(null);
  const [printProviderName, setPrintProviderName] = useState('');
  const [websiteBgColor, setWebsiteBgColor] = useState('');

  // Shopify direct API
  const [shopifyAdminToken, setShopifyAdminToken] = useState('');
  const [shopifyDomain, setShopifyDomain] = useState('');
  const [shopifyClientId, setShopifyClientId] = useState('');
  const [shopifyClientSecret, setShopifyClientSecret] = useState('');

  // Size Pricing States
  const [sizePrices, setSizePrices] = useState({});

  // Colors Settings States
  const [colors, setColors] = useState([]);
  const [colorMappings, setColorMappings] = useState({});
  const [colorFilter, setColorFilter] = useState('');
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [uploading, setUploading] = useState({});
  const [placementColor, setPlacementColor] = useState(null);

  // API verification loading state
  const [loadingShops, setLoadingShops] = useState(false);
  const [testingShopify, setTestingShopify] = useState(false);

  // Blueprint Changing Modal States
  const [showBpModal, setShowBpModal] = useState(false);
  const [bpModalFilter, setBpModalFilter] = useState('');
  const [blueprintsList, setBlueprintsList] = useState([]);
  const [bpLoading, setBpLoading] = useState(false);
  const [bpModalPage, setBpModalPage] = useState(1);
  const [bpHasMore, setBpHasMore] = useState(true);
  const [bpModalSelectedBp, setBpModalSelectedBp] = useState(null);
  const [bpModalProviders, setBpModalProviders] = useState([]);
  const [bpModalProviderId, setBpModalProviderId] = useState('');
  const [bpModalProviderName, setBpModalProviderName] = useState('');
  const [providersLoading, setProvidersLoading] = useState(false);

  // Restart Setup States
  const [showConfirmRestart, setShowConfirmRestart] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Bulk folder upload
  const [bulkImages, setBulkImages] = useState([]); // [{file, url, name, assignedTo}]
  const bulkFolderRef = useRef(null);
  const [dragOverColor, setDragOverColor] = useState(null);

  // Fetch settings on mount
  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = () => {
    getSettings()
      .then(async (s) => {
        setSettings(s);
        setApiKey(s.printifyApiKey || '');
        setShopId(s.shopId || '');
        setShopName(s.shopName || '');
        setBlueprintId(s.blueprintId || null);
        setBlueprintName(s.blueprintName || s.blueprintTitle || '');
        setPrintProviderId(s.printProviderId || null);
        setPrintProviderName(s.printProviderName || '');
        setDefaultPrice(s.defaultPrice != null ? (s.defaultPrice / 100).toFixed(2) : '29.99');
        setDefaultCompareAt(s.defaultCompareAtPrice != null ? (s.defaultCompareAtPrice / 100).toFixed(2) : '39.99');
        setDefaultSizes(s.defaultSizes || ['S', 'M', 'L', 'XL', '2XL']);
        setShopifyAdminToken(s.shopifyAdminToken || '');
        setShopifyDomain(s.shopifyDomain || '');
        setWebsiteBgColor(s.websiteBgColor || '');
        if (s.websiteBgColor) {
          localStorage.setItem('printflow-bg-color', s.websiteBgColor);
        } else {
          localStorage.removeItem('printflow-bg-color');
        }
        window.dispatchEvent(new Event('printflow-bg-color-change'));

        // Load sizePrices
        const loadedSizePrices = {};
        if (s.sizePrices && typeof s.sizePrices === 'object') {
          Object.keys(s.sizePrices).forEach((sz) => {
            const szObj = safeGet(s.sizePrices, sz);
            if (szObj) {
              loadedSizePrices[sz] = {
                price: szObj.price != null && szObj.price !== '' ? (szObj.price / 100).toFixed(2) : '',
                compareAtPrice: szObj.compareAtPrice != null && szObj.compareAtPrice !== '' ? (szObj.compareAtPrice / 100).toFixed(2) : '',
              };
            }
          });
        }
        ALL_SIZES.forEach((sz) => {
          if (!loadedSizePrices[sz]) {
            loadedSizePrices[sz] = { price: '', compareAtPrice: '' };
          }
        });
        setSizePrices(loadedSizePrices);

        // Load shops if API key exists
        if (s.printifyApiKey) {
          getShops()
            .then((data) => {
              setShops(Array.isArray(data) ? data : []);
            })
            .catch(() => {});
        }

        // Load variants if blueprint & print provider exist
        if (s.blueprintId && s.printProviderId) {
          setVariantsLoading(true);
          try {
            const data = await getVariants(s.blueprintId, s.printProviderId);
            const colorOpt = data?.available_variants || data?.variants || [];
            const seen = new Map();
            colorOpt.forEach((v) => {
              let colorName = '';
              let colorHex = '#888888';
              if (Array.isArray(v.options)) {
                const cOpt = v.options.find((o) => o.name === 'Colors' || o.name === 'Color');
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
              s.colorMappings.forEach((m) => {
                savedMappingsMap.set(m.colorName, m);
              });
            }

            uniqueColors.forEach((c) => {
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
          } catch (e) {
            console.error('Failed to load variants:', e);
          } finally {
            setVariantsLoading(false);
          }
        }
      })
      .catch(() => {});
  };

  // Verify API Key and load shops
  const handleVerifyApiKey = async () => {
    if (!apiKey) return;
    setLoadingShops(true);
    const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, '').replace(/[^A-Za-z0-9._-]/g, '');
    setApiKey(cleanKey);
    try {
      await saveSettings({ printifyApiKey: cleanKey });
      const data = await getShops();
      const list = Array.isArray(data) ? data : [];
      setShops(list);
      showToast('API key verified and shops loaded.', 'success');
      if (list.length === 1) {
        setShopId(String(list[0].id));
        setShopName(list[0].title);
      }
    } catch (e) {
      showToast('Failed to load shops: ' + e.message, 'error');
    } finally {
      setLoadingShops(false);
    }
  };

  // Verify Shopify API token and domain
  const handleVerifyShopifyConnection = async () => {
    if (!shopifyAdminToken || !shopifyDomain) {
      showToast('Please enter both Store Domain and Admin API Token first.', 'warning');
      return;
    }
    setTestingShopify(true);
    const cleanToken = shopifyAdminToken.trim().replace(/^Bearer\s+/i, '').replace(/[^A-Za-z0-9._-]/g, '');
    const cleanDomain = shopifyDomain.trim();
    setShopifyAdminToken(cleanToken);
    setShopifyDomain(cleanDomain);
    try {
      const data = await testShopifyConnection(cleanToken, cleanDomain);
      if (data.success) {
        showToast(`Connected successfully to Shopify shop: "${data.shopName || shopifyDomain}"`, 'success');
      } else {
        showToast('Verification failed: invalid response received', 'error');
      }
    } catch (e) {
      showToast('Shopify connection failed: ' + e.message, 'error');
    } finally {
      setTestingShopify(false);
    }
  };

  // Size Pricing Change
  const handleSizePriceChange = (size, field, val) => {
    setSizePrices((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        [field]: val,
      },
    }));
  };

  const handleBgColorChange = (color) => {
    setWebsiteBgColor(color);
    if (color) {
      localStorage.setItem('printflow-bg-color', color);
    } else {
      localStorage.removeItem('printflow-bg-color');
    }
    window.dispatchEvent(new Event('printflow-bg-color-change'));
  };

  // General Settings Save
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const mappingsArr = Object.values(colorMappings).filter(
        (c) => c.backgroundImageFilename || c.placementZone
      );

      // Convert size prices to cents
      const savedSizePrices = {};
      Object.keys(sizePrices).forEach((sz) => {
        const spObj = safeGet(sizePrices, sz) || {};
        const centsPrice = spObj.price && !isNaN(parseFloat(spObj.price)) ? Math.round(parseFloat(spObj.price) * 100) : '';
        const centsCompare = spObj.compareAtPrice && !isNaN(parseFloat(spObj.compareAtPrice)) ? Math.round(parseFloat(spObj.compareAtPrice) * 100) : '';
        
        if (centsPrice !== '' || centsCompare !== '') {
          savedSizePrices[sz] = {
            price: centsPrice,
            compareAtPrice: centsCompare
          };
        }
      });

      const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, '').replace(/[^A-Za-z0-9._-]/g, '');
      const cleanShopifyToken = shopifyAdminToken.trim().replace(/^Bearer\s+/i, '').replace(/[^A-Za-z0-9._-]/g, '');
      const cleanShopifyDomain = shopifyDomain.trim();
      setApiKey(cleanKey);
      setShopifyAdminToken(cleanShopifyToken);
      setShopifyDomain(cleanShopifyDomain);

      const payload = {
        printifyApiKey: cleanKey,
        shopId,
        shopName,
        blueprintId,
        blueprintName,
        printProviderId: printProviderId ? parseInt(printProviderId) : null,
        printProviderName,
        defaultPrice: Math.round(parseFloat(defaultPrice) * 100),
        defaultCompareAtPrice: Math.round(parseFloat(defaultCompareAt) * 100),
        defaultSizes,
        colorMappings: mappingsArr,
        sizePrices: savedSizePrices,
        setupComplete: true,
        shopifyAdminToken: cleanShopifyToken,
        shopifyDomain: cleanShopifyDomain,
        websiteBgColor,
      };

      await saveSettings(payload);
      showToast('Settings saved successfully', 'success');
    } catch (e) {
      showToast('Failed to save settings: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Background Upload
  const handleBgUpload = async (colorName, file) => {
    if (!file) return false;
    setUploading((prev) => ({ ...prev, [colorName]: true }));
    try {
      const { filename } = await uploadBackground(file);
      setColorMappings((prev) => ({
        ...prev,
        [colorName]: {
          ...prev[colorName],
          backgroundImageFilename: filename,
        },
      }));
      showToast(`Uploaded background for ${colorName}`, 'success');
      return true;
    } catch (e) {
      showToast(e.message || 'Upload failed', 'error');
      return false;
    } finally {
      setUploading((prev) => ({ ...prev, [colorName]: false }));
    }
  };

  // Bulk Upload Handlers
  const handleBulkFolderUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const imgFiles = files.filter(f => 
      f.type.startsWith('image/') || 
      f.name.toLowerCase().endsWith('.png') || 
      f.name.toLowerCase().endsWith('.jpg') || 
      f.name.toLowerCase().endsWith('.jpeg')
    );

    if (imgFiles.length === 0) {
      showToast('No images found in selection', 'warning');
      return;
    }

    const mapped = imgFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      assignedTo: ''
    }));

    setBulkImages(prev => [...prev, ...mapped]);
    showToast(`Loaded ${imgFiles.length} images`, 'success');
  };

  const handleBulkAssign = async (imgId, colorName) => {
    const img = bulkImages.find(x => x.id === imgId);
    if (!img || !colorName) return;
    const success = await handleBgUpload(colorName, img.file);
    if (success) {
      setBulkImages(prev => prev.filter(x => x.id !== imgId));
    }
  };

  const handleBulkDragStart = (e, imgId) => {
    e.dataTransfer.setData('text/plain', imgId);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDropOnColor = async (e, colorName) => {
    e.preventDefault();
    setDragOverColor(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
        await handleBgUpload(colorName, file);
      } else {
        showToast('Only image files (PNG/JPEG) are accepted', 'error');
      }
    } else {
      const imgId = e.dataTransfer.getData('text/plain');
      if (imgId) {
        await handleBulkAssign(imgId, colorName);
      }
    }
  };

  // Placement Editor Confirmations
  const handlePlacementConfirm = (colorName, zone) => {
    setColorMappings((prev) => ({
      ...prev,
      [colorName]: {
        ...prev[colorName],
        placementZone: zone,
      },
    }));
    setPlacementColor(null);
    showToast(`Placement set for ${colorName}`, 'success');
  };

  const handleApplyPlacementToAll = (zone) => {
    if (!zone) return;
    setColorMappings((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        next[k] = { ...next[k], placementZone: zone };
      });
      return next;
    });
    showToast('Placement copied to all colors', 'success');
  };

  // Sizes Toggling
  const toggleSize = (s) => {
    setDefaultSizes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  // Reset Setup flow
  const handleRestart = async () => {
    setResetting(true);
    try {
      await resetSetup();
      setShowConfirmRestart(false);
      showToast('Setup reset. Redirecting to setup wizard…', 'info');
      setTimeout(() => navigate('/setup'), 1000);
    } catch {
      showToast('Reset failed', 'error');
    } finally {
      setResetting(false);
    }
  };

  // Blueprint changer modal methods
  const loadBlueprintsInModal = async (page, reset = false) => {
    setBpLoading(true);
    try {
      const data = await getBlueprints(page, 20);
      const items = Array.isArray(data) ? data : data?.data || [];
      setBpModalPage(page);
      if (reset) {
        setBlueprintsList(items);
      } else {
        setBlueprintsList((prev) => [...prev, ...items]);
      }
      setBpHasMore(items.length === 20);
    } catch (e) {
      showToast('Failed to load blueprints');
    } finally {
      setBpLoading(false);
    }
  };

  const handleOpenBpChangeModal = () => {
    setBpModalSelectedBp(null);
    setBpModalProviderId('');
    setBpModalProviderName('');
    setBpModalFilter('');
    setShowBpModal(true);
    loadBlueprintsInModal(1, true);
  };

  const handleBpModalSelectBp = async (bp) => {
    setBpModalSelectedBp(bp);
    setBpModalProviders([]);
    setBpModalProviderId('');
    setBpModalProviderName('');
    setProvidersLoading(true);
    try {
      const data = await getProviders(bp.id);
      const list = Array.isArray(data) ? data : [];
      setBpModalProviders(list);
      if (list.length === 1) {
        setBpModalProviderId(String(list[0].id));
        setBpModalProviderName(list[0].title);
      }
    } catch {
      showToast('Failed to load print providers');
    } finally {
      setProvidersLoading(false);
    }
  };

  const handleBpProviderConfirm = async (newBp, newProviderId, newProviderName) => {
    setVariantsLoading(true);
    try {
      const data = await getVariants(newBp.id, newProviderId);
      const colorOpt = data?.available_variants || data?.variants || [];
      const seen = new Map();
      colorOpt.forEach((v) => {
        let colorName = '';
        let colorHex = '#888888';
        if (Array.isArray(v.options)) {
          const cOpt = v.options.find((o) => o.name === 'Colors' || o.name === 'Color');
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

      const newMappings = {};
      uniqueColors.forEach((c) => {
        const existing = safeGet(colorMappings, c.colorName) || {};
        newMappings[c.colorName] = {
          colorId: c.colorName,
          colorName: c.colorName,
          colorHex: c.colorHex,
          variantIds: c.variantIds,
          backgroundImageFilename: existing.backgroundImageFilename || '',
          placementZone: existing.placementZone || null,
          designGroup: existing.designGroup || 'light',
        };
      });
      setColorMappings(newMappings);
      setBlueprintId(newBp.id);
      setBlueprintName(newBp.title);
      setPrintProviderId(newProviderId);
      setPrintProviderName(newProviderName);

      showToast('Blueprint changed. Save settings to apply changes.', 'success');
      setShowBpModal(false);
    } catch (e) {
      showToast('Failed to load variants for new blueprint: ' + e.message, 'error');
    } finally {
      setVariantsLoading(false);
    }
  };

  const filteredBlueprints = blueprintsList.filter(
    (b) =>
      b.title?.toLowerCase().includes(bpModalFilter.toLowerCase()) ||
      b.brand?.toLowerCase().includes(bpModalFilter.toLowerCase())
  );

  const filteredColors = colors.filter((c) =>
    c.colorName.toLowerCase().includes(colorFilter.toLowerCase())
  );

  if (!settings) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto">
        <div className="skeleton h-10 w-48 mb-6" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-black dark:border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-widest text-black dark:text-white">Settings</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Configure default pricing, sizes, API connections and color mappings</p>
        </div>
        <button
          id="save-settings-btn"
          onClick={handleSaveSettings}
          disabled={saving}
          className="hdk-skew-btn-yellow text-black font-bold px-6 py-2.5 text-sm flex items-center gap-2"
        >
          <span className="hdk-unskew flex items-center gap-2">
            {saving && <span className="step-spinning">⟳</span>}
            {saving ? 'Saving...' : 'Save Settings'}
          </span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black dark:border-slate-700 mb-6 overflow-x-auto">
        {['general', 'colors', 'danger'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-5 py-3 text-xs font-extrabold uppercase tracking-widest border-t border-l border-r border-transparent -mb-[1px] whitespace-nowrap transition-all ${
              activeTab === t
                ? 'border-black dark:border-slate-700 bg-white dark:bg-slate-800 text-black dark:text-white border-b-white dark:border-b-[#1a1d2e]'
                : 'text-slate-500 hover:text-black dark:hover:text-white'
            }`}
          >
            {t === 'general' ? 'General & Size Pricing' : t === 'colors' ? 'Color & Mockup Mappings' : 'Danger Zone'}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* API Key section */}
          <div className="bg-white dark:bg-slate-800 p-6 hdk-border space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
              Printify Authentication &amp; Shop
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Printify API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your Printify API personal access token"
                    className="flex-1 px-3 py-2 hdk-input text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyApiKey}
                    disabled={loadingShops || !apiKey}
                    className="px-4 py-2 border border-black dark:border-slate-600 bg-slate-50 dark:bg-slate-700 font-bold text-xs uppercase text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40"
                  >
                    {loadingShops ? 'Loading...' : 'Verify key'}
                  </button>
                </div>
              </div>

              {shops.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Active Shop
                  </label>
                  <select
                    value={shopId}
                    onChange={(e) => {
                      const s = shops.find((x) => String(x.id) === e.target.value);
                      setShopId(e.target.value);
                      setShopName(s?.title || '');
                    }}
                    className="w-full px-3 py-2 hdk-select text-sm"
                  >
                    <option value="">Select a shop...</option>
                    {shops.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Shopify Direct API (for mockup image replacement) */}
          <div className="bg-white dark:bg-slate-800 p-6 hdk-border space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
              Shopify Direct API — Mockup Image Replacement
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Optional. If configured, custom mockup images will automatically replace the generic Printify mockups
              on Shopify after publishing. Requires a Shopify custom app Admin API token with{' '}
              <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">write_products</code> scope.
              {' '}Create one at <strong>Shopify Admin → Apps → Develop apps</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Store Domain
                </label>
                <input
                  type="text"
                  value={shopifyDomain}
                  onChange={(e) => setShopifyDomain(e.target.value.trim())}
                  placeholder="yourstore.myshopify.com"
                  className="w-full px-3 py-2 hdk-input text-sm font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">e.g. <code>rc4xc6-sg.myshopify.com</code></p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Admin API Token
                </label>
                <input
                  type="password"
                  value={shopifyAdminToken}
                  onChange={(e) => setShopifyAdminToken(e.target.value.trim())}
                  placeholder="shpat_…"
                  className="w-full px-3 py-2 hdk-input text-sm font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">Starts with <code>shpat_</code></p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={handleVerifyShopifyConnection}
                disabled={testingShopify || !shopifyDomain || !shopifyAdminToken}
                className="px-4 py-2 border border-black dark:border-slate-600 bg-slate-50 dark:bg-slate-700 font-bold text-xs uppercase text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 flex items-center gap-1.5"
              >
                {testingShopify && <span className="step-spinning">⟳</span>}
                {testingShopify ? 'Verifying...' : 'Verify Shopify Connection'}
              </button>

              {shopifyAdminToken && shopifyDomain && (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <span>✓</span>
                  <span>Shopify integration configured — mockups will be replaced automatically after publishing.</span>
                </div>
              )}
              {(!shopifyAdminToken || !shopifyDomain) && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <span>⚠</span>
                  <span>Not configured — products will publish with default Printify mockups.</span>
                </div>
              )}
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="bg-white dark:bg-slate-800 p-6 hdk-border space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
              Appearance Settings
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Website Background Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={websiteBgColor || '#ffffff'}
                  onChange={(e) => handleBgColorChange(e.target.value)}
                  className="w-12 h-10 border border-black dark:border-slate-600 cursor-pointer bg-transparent"
                  title="Choose background color"
                />
                <input
                  type="text"
                  value={websiteBgColor}
                  onChange={(e) => handleBgColorChange(e.target.value)}
                  placeholder="e.g. #ffffff (Default)"
                  className="px-3 py-2 hdk-input text-sm w-36 font-mono"
                />
                {websiteBgColor && (
                  <button
                    type="button"
                    onClick={() => handleBgColorChange('')}
                    className="px-3 py-2 border border-red-500 text-red-500 font-bold text-xs uppercase hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Select a custom background color using the color wheel or hex code. Applies instantly across all pages.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 hdk-border space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
              Default Pricing &amp; Sizes
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Default Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  className="w-full px-3 py-2 hdk-input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Default Compare-At Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={defaultCompareAt}
                  onChange={(e) => setDefaultCompareAt(e.target.value)}
                  className="w-full px-3 py-2 hdk-input text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Default Sizes
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_SIZES.map((size) => {
                  const active = defaultSizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleSize(size)}
                      className={`px-3.5 py-1.5 text-xs font-extrabold uppercase border border-black dark:border-slate-600 transition-all ${
                        active
                          ? 'bg-black dark:bg-white text-white dark:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]'
                          : 'bg-white dark:bg-slate-700 text-black dark:text-white hover:bg-slate-50'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Size pricing overrides */}
          <div className="bg-white dark:bg-slate-800 p-6 hdk-border space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
              Size-Specific Pricing Overrides (Optional)
            </h3>
            <p className="text-xs text-slate-500">
              Set custom prices and compare-at prices for specific sizes. Leave empty to use the defaults above.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ALL_SIZES.map((sz) => {
                const sp = safeGet(sizePrices, sz) || { price: '', compareAtPrice: '' };
                return (
                  <div key={sz} className="flex items-center justify-between border border-slate-100 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-900/30">
                    <span className="font-extrabold text-sm text-black dark:text-white w-12">{sz}</span>
                    <div className="flex gap-2 flex-1">
                      <div className="flex-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Default"
                          value={sp.price}
                          onChange={(e) => handleSizePriceChange(sz, 'price', e.target.value)}
                          className="w-full px-2 py-1 hdk-input text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Compare-At ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Default"
                          value={sp.compareAtPrice}
                          onChange={(e) => handleSizePriceChange(sz, 'compareAtPrice', e.target.value)}
                          className="w-full px-2 py-1 hdk-input text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blueprint catalog details */}
          <div className="bg-white dark:bg-slate-800 p-6 hdk-border space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-black dark:text-white">
                Product Blueprint &amp; Provider
              </h3>
              <button
                type="button"
                onClick={handleOpenBpChangeModal}
                className="px-3 py-1 border border-black dark:border-slate-600 bg-yellow-100 dark:bg-yellow-900/30 text-black dark:text-yellow-400 font-bold text-xs uppercase hover:bg-yellow-200"
              >
                Change Blueprint
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400">Blueprint ID</p>
                <p className="font-bold text-black dark:text-white">{blueprintId || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Blueprint Name</p>
                <p className="font-bold text-black dark:text-white">{blueprintName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Print Provider ID</p>
                <p className="font-bold text-black dark:text-white">{printProviderId || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Print Provider Name</p>
                <p className="font-bold text-black dark:text-white">{printProviderName || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'colors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-800 p-4 hdk-border">
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="Filter colors (e.g. Black, White, Navy)..."
                value={colorFilter}
                onChange={(e) => setColorFilter(e.target.value)}
                className="w-full px-3 py-2 hdk-input text-sm"
              />
            </div>
            <span className="text-xs font-bold uppercase text-slate-500 bg-slate-50 dark:bg-slate-700 px-3 py-1.5">
              {colors.length} Colors • {Object.values(colorMappings).filter((c) => c.backgroundImageFilename && c.placementZone).length} Configured
            </span>
          </div>

          {/* Bulk Folder Upload Panel */}
          <div className="bg-white dark:bg-slate-800 p-6 hdk-border space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold uppercase text-black dark:text-white tracking-wider">Bulk Folder Upload</h3>
                <p className="text-xs text-slate-550 dark:text-slate-400">Upload a folder of background mockups, then select color mapping or drag images directly onto color cards below.</p>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={bulkFolderRef}
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={handleBulkFolderUpload}
                />
                <button
                  type="button"
                  onClick={() => bulkFolderRef.current?.click()}
                  className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-bold text-xs uppercase hover:bg-slate-850 dark:hover:bg-slate-100 transition-colors"
                >
                  Upload Folder
                </button>
                {bulkImages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBulkImages([])}
                    className="px-4 py-2 border border-red-500 text-red-500 font-bold text-xs uppercase hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    Clear All ({bulkImages.length})
                  </button>
                )}
              </div>
            </div>

            {bulkImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[320px] overflow-y-auto p-1">
                {bulkImages.map((img) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={(e) => handleBulkDragStart(e, img.id)}
                    className="border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-900 rounded-none flex flex-col justify-between space-y-2 cursor-grab active:cursor-grabbing hover:border-black dark:hover:border-white transition-all relative group"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-850">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white bg-black/80 px-2 py-1 uppercase tracking-wider">Drag Me</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold truncate text-slate-700 dark:text-slate-350" title={img.name}>
                        {img.name}
                      </p>
                      <select
                        value={img.assignedTo}
                        onChange={(e) => handleBulkAssign(img.id, e.target.value)}
                        className="w-full text-[10px] p-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white"
                      >
                        <option value="">Select color...</option>
                        {colors.map((c) => (
                          <option key={c.colorName} value={c.colorName}>
                            {c.colorName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {variantsLoading ? (
            <div className="text-center py-12">
              <span className="step-spinning inline-block text-2xl mb-2">⟳</span>
              <p className="text-sm text-slate-500">Loading catalog variants...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredColors.map((color) => {
                const mapping = safeGet(colorMappings, color.colorName) || {};
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
                    className={`border p-4 bg-white dark:bg-slate-800 space-y-4 transition-all duration-200 ${
                      dragOverColor === color.colorName
                        ? 'border-yellow-500 dark:border-yellow-400 bg-yellow-50/10 dark:bg-yellow-950/20 scale-[1.01] shadow-md'
                        : 'border-black dark:border-slate-700'
                    }`}
                  >
                    {/* Color Swatch & Title */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full border border-black shadow-sm"
                          style={{ backgroundColor: color.colorHex || '#888' }}
                        />
                        <span className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">{color.colorName}</span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 ${
                        isConfigured
                          ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400'
                      }`}>
                        {isConfigured ? 'Configured' : 'Incomplete'}
                      </span>
                    </div>

                    {/* Design Group & Background Controls */}
                    <div className="flex flex-wrap gap-3 items-center justify-between pt-2">
                      <div>
                        <label className="block text-slate-500 font-bold uppercase text-[10px] mb-1">Design Group</label>
                        <div className="flex border border-black dark:border-slate-600 overflow-hidden text-xs">
                          {['light', 'dark'].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                setColorMappings((prev) => ({
                                  ...prev,
                                  [color.colorName]: { ...prev[color.colorName], designGroup: g },
                                }));
                              }}
                              className={`px-3 py-1 font-bold transition-colors ${
                                (mapping.designGroup || 'light') === g
                                  ? 'bg-black text-white dark:bg-white dark:text-black'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                              }`}
                            >
                              {g === 'light' ? 'Light' : 'Dark'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {/* Background File Upload */}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            className="hidden"
                            onChange={(e) => handleBgUpload(color.colorName, e.target.files?.[0])}
                          />
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-black dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-bold text-black dark:text-white transition-colors hover:bg-slate-100 dark:hover:bg-slate-600 ${
                            safeGet(uploading, color.colorName) ? 'opacity-60 cursor-wait' : ''
                          }`}>
                            {safeGet(uploading, color.colorName) ? <span className="step-spinning">⟳</span> : 'Upload'}
                          </span>
                        </label>

                        {/* Placement editor trigger */}
                        {mapping.backgroundImageFilename && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPlacementColor(color.colorName)}
                              className={`px-3 py-1.5 border text-xs font-bold transition-colors ${
                                mapping.placementZone
                                  ? 'border-black dark:border-slate-600 bg-yellow-100 dark:bg-yellow-950/40 text-black dark:text-yellow-400'
                                  : 'border-black dark:border-slate-600 bg-white dark:bg-slate-700 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600'
                              }`}
                            >
                              {mapping.placementZone ? 'Placement Set' : 'Set Placement'}
                            </button>
                            {mapping.placementZone && (
                              <button
                                type="button"
                                onClick={() => handleApplyPlacementToAll(mapping.placementZone)}
                                className="px-2 py-1.5 border border-black dark:border-slate-600 bg-blue-100 dark:bg-blue-950/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-xs font-bold text-black dark:text-blue-400"
                                title="Apply placement to all colors"
                              >
                                Apply All
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Thumbnail of Uploaded Image */}
                    {mapping.backgroundImageFilename && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <img
                          src={`/api/backgrounds/${mapping.backgroundImageFilename}`}
                          alt="Background Preview"
                          className="h-16 w-24 object-cover border border-slate-200 dark:border-slate-600 rounded-none bg-slate-50 dark:bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setColorMappings((prev) => ({
                              ...prev,
                              [color.colorName]: {
                                ...prev[color.colorName],
                                backgroundImageFilename: '',
                                placementZone: null,
                              },
                            }));
                          }}
                          className="text-xs text-red-500 hover:underline font-bold"
                        >
                          Clear Background
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredColors.length === 0 && (
                <div className="col-span-full text-center py-8 text-slate-500 font-bold uppercase tracking-wider">
                  No colors matching "{colorFilter}"
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'danger' && (
        <div className="bg-white dark:bg-slate-800 p-6 hdk-border border-red-500 dark:border-red-900 space-y-4">
          <h2 className="text-base font-extrabold uppercase text-red-600 dark:text-red-400">Danger Zone</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Restarting setup will clear all configuration including color mappings, active blueprint selections, and background images.
          </p>
          <button
            id="restart-setup-btn"
            onClick={() => setShowConfirmRestart(true)}
            className="px-5 py-2.5 border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold text-xs uppercase"
          >
            Restart Setup
          </button>
        </div>
      )}

      {/* Save Settings confirmation at the bottom */}
      <div className="flex justify-end pt-8 border-t border-slate-100 dark:border-slate-700 mt-8">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="hdk-skew-btn-yellow text-black font-bold px-8 py-3 text-sm flex items-center gap-2"
        >
          <span className="hdk-unskew flex items-center gap-2">
            {saving && <span className="step-spinning">⟳</span>}
            {saving ? 'Saving...' : 'Save Settings'}
          </span>
        </button>
      </div>

      {/* Placement Editor Modal */}
      {placementColor && safeGet(colorMappings, placementColor) && (
        <PlacementEditor
          imageUrl={`/api/backgrounds/${safeGet(colorMappings, placementColor).backgroundImageFilename}`}
          initialZone={safeGet(colorMappings, placementColor).placementZone}
          onConfirm={(zone) => handlePlacementConfirm(placementColor, zone)}
          onClose={() => setPlacementColor(null)}
        />
      )}

      {/* Change Blueprint Modal */}
      {showBpModal && (
        <div className="fullscreen-overlay" onClick={() => setShowBpModal(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-none hdk-border border-black dark:border-slate-700 shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 border-b border-black dark:border-slate-700 pb-2">
              <h3 className="text-lg font-bold text-black dark:text-white uppercase tracking-wider">Change Blueprint</h3>
              <button onClick={() => setShowBpModal(false)} className="text-black dark:text-white font-bold text-xl leading-none">
                ×
              </button>
            </div>

            {!bpModalSelectedBp ? (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Search blueprints..."
                  value={bpModalFilter}
                  onChange={(e) => setBpModalFilter(e.target.value)}
                  className="w-full px-3 py-2 hdk-input text-sm"
                />
                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {filteredBlueprints.map((bp) => (
                    <button
                      key={bp.id}
                      onClick={() => handleBpModalSelectBp(bp)}
                      className="border border-black dark:border-slate-700 p-2 text-left bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                    >
                      {bp.images?.[0]?.src && (
                        <img src={bp.images[0].src} alt={bp.title} className="w-full aspect-square object-cover mb-1" />
                      )}
                      <p className="text-xs font-bold text-black dark:text-white line-clamp-1">{bp.title}</p>
                      <p className="text-[10px] text-slate-500">{bp.brand}</p>
                    </button>
                  ))}
                  {bpLoading && (
                    <div className="col-span-full text-center text-xs py-4 text-slate-500">
                      Loading blueprints...
                    </div>
                  )}
                </div>
                {bpHasMore && !bpLoading && (
                  <button
                    onClick={() => loadBlueprintsInModal(bpModalPage + 1)}
                    className="w-full py-1.5 border border-black dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-bold"
                  >
                    Load More Blueprints
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Selected Blueprint</p>
                  <p className="text-sm font-bold text-black dark:text-white">{bpModalSelectedBp.title}</p>
                  <button
                    onClick={() => setBpModalSelectedBp(null)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 underline font-bold mt-1"
                  >
                    ← Back to search
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black dark:text-white uppercase tracking-wider mb-1.5">
                    Select Print Provider
                  </label>
                  {providersLoading ? (
                    <p className="text-xs text-slate-500">Loading print providers...</p>
                  ) : (
                    <select
                      value={bpModalProviderId}
                      onChange={(e) => {
                        const p = bpModalProviders.find((x) => String(x.id) === e.target.value);
                        setBpModalProviderId(e.target.value);
                        setBpModalProviderName(p?.title || '');
                      }}
                      className="w-full px-3 py-2 hdk-select text-sm"
                    >
                      <option value="">Select provider...</option>
                      {bpModalProviders.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.title}
                          {p.location?.country ? ` — ${p.location.country}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  onClick={() =>
                    handleBpProviderConfirm(bpModalSelectedBp, bpModalProviderId, bpModalProviderName)
                  }
                  disabled={!bpModalProviderId || variantsLoading}
                  className="w-full py-2.5 bg-yellow-100 dark:bg-yellow-950/40 border border-black dark:border-slate-600 text-black dark:text-yellow-400 hover:bg-yellow-200 text-xs font-bold disabled:opacity-40"
                >
                  {variantsLoading ? 'Loading variants...' : 'Confirm Blueprint & Provider'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restart Setup Confirmation Modal */}
      {showConfirmRestart && (
        <div className="fullscreen-overlay" onClick={() => setShowConfirmRestart(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-none hdk-border border-black dark:border-slate-700 shadow-2xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-black dark:text-white uppercase tracking-wider mb-2">Restart Setup?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              This will clear all color mappings and delete all uploaded background images. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmRestart(false)}
                className="flex-1 py-2.5 border border-black dark:border-slate-600 rounded-none text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                id="confirm-restart-btn"
                onClick={handleRestart}
                disabled={resetting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-none text-sm font-bold uppercase transition-colors flex items-center justify-center gap-2"
              >
                {resetting && <span className="step-spinning">⟳</span>}
                {resetting ? 'Resetting...' : 'Yes, Restart'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
