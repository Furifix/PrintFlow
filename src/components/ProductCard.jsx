import { useState } from 'react';
import { useLanguage } from '../utils/i18n.jsx';
import { shopifySyncLibraryProduct } from '../utils/api.js';
import { showToast } from '../components/Toast.jsx';

// src/components/ProductCard.jsx — Library card
export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-none hdk-border shadow-none overflow-hidden">
      <div className="skeleton w-full aspect-square rounded-none" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-8 w-full mt-4" />
      </div>
    </div>
  );
}

export default function ProductCard({ product, onDuplicate }) {
  const image      = product.images?.[0]?.src || null;
  const published  = product.visible;
  const price      = product.variants?.[0]?.price;
  const variantCount = product.variants?.length || 0;
  const printifyUrl = `https://printify.com/app/store/products/${product.id}/edit`;
  const { lang, t } = useLanguage();
  
  const [syncing, setSyncing] = useState(false);

  const formatPrice = (cents) =>
    cents != null ? `$${(cents / 100).toFixed(2)}` : '—';

  const handleSyncMockups = async () => {
    if (!product.external?.id) return;
    setSyncing(true);
    try {
      await shopifySyncLibraryProduct(product.id, product.external.id);
      showToast(
        lang === 'de' 
          ? 'Bildersynchronisierung gestartet! Siehe Benachrichtigung.' 
          : 'Shopify image sync scheduled! Check notification widget.', 
        'success'
      );
    } catch (e) {
      showToast(e.message || (lang === 'de' ? 'Fehler beim Planen des Syncs' : 'Failed to schedule sync'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-none hdk-border shadow-none overflow-hidden flex flex-col transition-all">
      {/* Thumbnail */}
      <div className="aspect-square bg-slate-50 dark:bg-slate-900 border-b border-black dark:border-white flex items-center justify-center overflow-hidden">
        {image ? (
          <img src={image} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider leading-tight line-clamp-2">{product.title}</h3>
          <span
            className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-none border ${
              published
                ? 'bg-green-100 text-green-800 border-green-600'
                : 'bg-slate-100 text-slate-650 border-slate-400'
            }`}
          >
            {published ? t('published') : t('draft')}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-black dark:text-white">{formatPrice(price)}</span>
          <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">{variantCount} {lang === 'de' ? 'Varianten' : 'variants'}</span>
        </div>

        <div className="mt-auto pt-3 flex flex-wrap gap-2 border-t border-black dark:border-white">
          <a
            href={printifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[45%] text-center px-2 py-2 border border-black dark:border-white rounded-none text-[10px] font-bold uppercase tracking-wider text-black dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {t('open_in_printify')} ↗
          </a>
          <button
            onClick={() => onDuplicate(product)}
            className="flex-1 min-w-[45%] px-2 py-2 border border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 rounded-none text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            {t('duplicate_setup')}
          </button>
          {product.external?.id && (
            <button
              onClick={handleSyncMockups}
              disabled={syncing}
              className="w-full mt-1 px-3 py-2 border border-black bg-[#F5C400] text-black hover:bg-[#ffd500] disabled:bg-slate-200 disabled:border-slate-400 rounded-none text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center gap-2"
            >
              {syncing ? '⟳ Syncing...' : 'Sync Shopify Images'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
