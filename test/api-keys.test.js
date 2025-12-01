import assert from 'node:assert/strict';
import test from 'node:test';
import { CG_API_KEY_TTL_MS, DEFAULT_CG_API_KEY, STORAGE_KEYS } from '../scripts/constants.js';

const stubDocument = {
  getElementById: () => null,
  documentElement: { classList: { toggle: () => {} } },
  body: { classList: { toggle: () => {} } }
};

function createLocalStorage() {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear()
  };
}

globalThis.document = stubDocument;
globalThis.localStorage = createLocalStorage();

const utils = await import('../scripts/utils.js');
const services = await import('../scripts/services.js');
const { state } = await import('../scripts/state.js');

const { loadCgApiKey, persistCgApiKey } = utils;
const { fetchWithRetries } = services;

test('loadCgApiKey returns the demo key when nothing is stored', () => {
  localStorage.clear();
  assert.equal(loadCgApiKey(), DEFAULT_CG_API_KEY);
});

test('loadCgApiKey drops expired entries and falls back to demo key', () => {
  const expired = JSON.stringify({ value: 'old-pro-key', savedAt: Date.now() - CG_API_KEY_TTL_MS - 1000 });
  localStorage.setItem(STORAGE_KEYS.cgApiKey, expired);
  const value = loadCgApiKey();
  assert.equal(value, DEFAULT_CG_API_KEY);
  assert.equal(localStorage.getItem(STORAGE_KEYS.cgApiKey), null);
});

test('persistCgApiKey stores payload with a timestamp', () => {
  localStorage.clear();
  persistCgApiKey('pro-key-123');
  const savedRaw = localStorage.getItem(STORAGE_KEYS.cgApiKey);
  assert.ok(savedRaw, 'payload should be saved');
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.value, 'pro-key-123');
  assert.equal(typeof saved.savedAt, 'number');
});

test('fetchWithRetries uses demo header for default key', async t => {
  const originalFetch = globalThis.fetch;
  state.cgApiKey = DEFAULT_CG_API_KEY;

  let capturedHeaders = null;
  globalThis.fetch = async (_url, options) => {
    capturedHeaders = options.headers;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await fetchWithRetries('https://example.com');
  assert.equal(capturedHeaders['x-cg-demo-api-key'], DEFAULT_CG_API_KEY);
});

test('fetchWithRetries uses pro header for custom key', async t => {
  const originalFetch = globalThis.fetch;
  state.cgApiKey = 'secret-pro';

  let capturedHeaders = null;
  globalThis.fetch = async (_url, options) => {
    capturedHeaders = options.headers;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await fetchWithRetries('https://example.com', { method: 'GET' });
  assert.equal(capturedHeaders['x-cg-pro-api-key'], 'secret-pro');
  assert.equal(capturedHeaders['x-cg-demo-api-key'], undefined);
});
