// src/pages/Library.jsx — Product library with pagination, search, and status filter
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, getSettings } from '../utils/api.js';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard.jsx';
import { showToast } from '../components/Toast.jsx';
import { useLanguage } from '../utils/i18n.jsx';

export default function Library() {
  const navigate  = useNavigate();
  const [products,    setProducts]    = useState([]);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [setupDone,   setSetupDone]   = useState(true);
  const { lang, t }                   = useLanguage();

  useEffect(() => {
    getSettings().then(s => {
      if (!s.setupComplete) setSetupDone(false);
      else loadPage(1, true);
    }).catch(() => loadPage(1, true));
  }, []); // eslint-disable-line

  const loadPage = async (p, initial = false) => {
    if (initial) setLoading(true);
    else setLoadingMore(true);
    try {
      const data = await getProducts(p, 10);
      // Printify returns { data: [...], current_page, last_page }
      const items = Array.isArray(data) ? data : (data?.data || []);
      if (initial) {
        setProducts(items);
      } else {
        setProducts(prev => [...prev, ...items]);
      }
      setPage(p);
      const totalPages = data?.last_page || 1;
      setHasMore(p < totalPages && items.length === 10);
    } catch (e) {
      showToast(t('failed_load_products'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleDuplicate = (product) => {
    navigate('/', {
      state: {
        duplicateFrom: {
          title: product.title,
          price: product.variants?.[0]?.price,
        },
      },
    });
  };

  const filtered = products.filter(p => {
    const matchSearch = p.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'all'       ? true
      : statusFilter === 'published' ? p.visible === true
      : !p.visible;
    return matchSearch && matchStatus;
  });

  if (!setupDone) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-black dark:text-white uppercase tracking-wider mb-6">{t('library')}</h1>
        <div className="bg-white dark:bg-slate-800 p-12 text-center hdk-border rounded-none shadow-none">
          <p className="text-slate-550 uppercase font-bold text-sm tracking-wider mb-4">{t('setup_first')}</p>
          <button
            onClick={() => navigate('/setup')}
            className="px-6 py-3 hdk-skew-btn-yellow text-black font-bold text-sm rounded-none border border-black inline-block mx-auto"
          >
            <span className="hdk-unskew">{t('go_to_setup')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-black dark:text-white uppercase tracking-wider">{t('library')}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          id="library-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('search_products')}
          className="flex-1 px-4 py-2.5 hdk-input text-sm"
        />
        <div className="flex border border-black dark:border-white rounded-none overflow-hidden">
          {['all','published','draft'].map(f => (
            <button
              key={f}
              id={`filter-${f}`}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2.5 text-sm font-bold uppercase transition-colors ${
                statusFilter === f
                  ? 'bg-black text-white dark:bg-white dark:text-black border-r border-black dark:border-white last:border-r-0'
                  : 'text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-r border-black dark:border-white last:border-r-0'
              }`}
            >
              {t(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
            {products.length === 0
              ? t('no_products')
              : t('no_products_filter')}
          </p>
          {products.length === 0 && (
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-3 hdk-skew-btn-yellow text-black font-bold text-sm rounded-none border border-black"
            >
              <span className="hdk-unskew">{t('upload')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="mt-8 text-center">
          <button
            id="load-more-btn"
            onClick={() => loadPage(page + 1)}
            disabled={loadingMore}
            className="px-8 py-3 border border-black dark:border-white rounded-none text-sm font-bold uppercase text-black dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {loadingMore ? (
              <span className="flex items-center justify-center gap-2">
                <span className="step-spinning">⟳</span> {t('loading')}
              </span>
            ) : t('load_more')}
          </button>
        </div>
      )}
    </div>
  );
}
