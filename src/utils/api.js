// src/utils/api.js — All fetch calls to /api/*
// Security: all Printify API calls go through the Express backend (BFF pattern).
// API keys never leave the server.

const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export const verifyPrintifyKey = async (key) => {
  try {
    const resp = await fetch('https://api.printify.com/v1/me.json', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data && data.id;
  } catch (e) {
    return false;
  }
};
export const getSettings   = () => request('GET',  '/settings');
export const saveSettings  = (body) => request('POST', '/settings', body);
export const resetSetup    = () => fetch(`${BASE}/settings/reset`, { method: 'DELETE' }).then(r => r.json());

export async function uploadBackground(file) {
  const fd = new FormData();
  fd.append('background', file);
  const res = await fetch(`${BASE}/settings/background`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

// ─── History ──────────────────────────────────────────────────────────────────
export const getHistory    = () => request('GET',  '/history');

export const appendHistory = (entry) => request('POST', '/history', entry);

// ─── Printify ─────────────────────────────────────────────────────────────────
export const getShops      = () => request('GET', '/printify/shops');

export const getBlueprints = (page = 1, limit = 20) =>
  request('GET', `/printify/blueprints?page=${page}&limit=${limit}`);

export const getProviders  = (blueprintId) =>
  request('GET', `/printify/blueprints/${blueprintId}/providers`);

export const getVariants   = (blueprintId, providerId) =>
  request('GET', `/printify/blueprints/${blueprintId}/providers/${providerId}/variants`);

export const uploadImage   = async (file_name, contents) => {
  try {
    console.log(`[API] Uploading image: ${file_name} (Length: ${contents?.length || 0})`);
    const data = await request('POST', '/printify/upload-image', { file_name, contents });
    console.log(`[API] Upload successful for ${file_name}, ID: ${data.id}`);
    return data;
  } catch (err) {
    console.error(`[API] Upload failed for ${file_name}:`, err.message);
    throw err;
  }
};

export const getProducts   = (page = 1, limit = 10) =>
  request('GET', `/printify/products?page=${page}&limit=${limit}`);

export const getProduct    = (productId) =>
  request('GET', `/printify/products/${productId}`);

export const createProduct = (payload) =>
  request('POST', '/printify/products', payload);

export const publishProduct = (productId) =>
  request('POST', `/printify/products/${productId}/publish`);

export const updateProduct = (productId, payload) =>
  request('PUT', `/printify/products/${productId}`, payload);

// ─── Shopify ─────────────────────────────────────────────────────────────────
// Replaces all product images on Shopify with custom mockup URLs.
// Requires shopifyAdminToken + shopifyDomain configured in Settings.
export const shopifySyncMockups = (printifyProductId, shopifyProductId) =>
  request('POST', '/shopify/sync-mockups', { printifyProductId, shopifyProductId });

export const stageMockups = (printifyProductId, mockups) =>
  request('POST', `/mockups/${printifyProductId}`, { mockups });

export const testShopifyConnection = (shopifyAdminToken, shopifyDomain) =>
  request('POST', '/shopify/test-connection', { shopifyAdminToken, shopifyDomain });

export const saveMockupsToDownloads = (title, images) =>
  request('POST', '/save-mockups', { title, images });

export const shopifySyncLibraryProduct = (printifyProductId, shopifyProductId) =>
  request('POST', '/shopify/sync-library-product', { printifyProductId, shopifyProductId });
