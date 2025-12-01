import { COINS, CURRENCY_CONFIG, STORAGE_KEYS } from "./constants.js";
import { el, state } from "./state.js";

/* ---------------------- Utils ---------------------- */
export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export function sanitizeString(value, fallback = "", maxLen = 160) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}
export function safeNumber(value, fallback = 0, { min = -Infinity, max = Infinity } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}
export function formatCurrency(v, overrideCurrency) {
  if (!isFinite(v)) return "--";
  const code = overrideCurrency || state.currency || "usd";
  const cfg = CURRENCY_CONFIG[code] || CURRENCY_CONFIG.usd;
  return v.toLocaleString(cfg.locale, { 
    style: "currency", 
    currency: cfg.currency,
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}
export function formatPercent(v) {
  if (!isFinite(v)) return "--";
  const sign = v > 0 ? "+" : "";
  return sign + v.toFixed(2) + "%";
}
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
export function findCoinMeta(id) {
  return COINS.find(c => c.id === id) || null;
}
export function shortenAddress(addr) {
  if (!addr) return "--";
  const clean = String(addr).trim();
  if (clean.length <= 14) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-6)}`;
}
export function describeChain(chain) {
  const map = {
    ethereum: "Ethereum",
    bitcoin: "Bitcoin",
    solana: "Solana",
    polygon: "Polygon",
    bsc: "BNB Chain"
  };
  return map[chain] || chain;
}
export function getExplorerUrl(chain, address) {
  const safe = encodeURIComponent(address.trim());
  switch (chain) {
    case "bitcoin":
      return `https://www.blockchain.com/btc/address/${safe}`;
    case "solana":
      return `https://solscan.io/account/${safe}`;
    case "polygon":
      return `https://polygonscan.com/address/${safe}`;
    case "bsc":
      return `https://bscscan.com/address/${safe}`;
    default:
      return `https://etherscan.io/address/${safe}`;
  }
}
export function defaultPortfolio() {
  return [
    { id: "bitcoin",  symbol: "BTC",  name: "Bitcoin",  amount: 0.35, buyPrice: 26000 },
    { id: "ethereum", symbol: "ETH",  name: "Ethereum", amount: 3.8,  buyPrice: 1800 },
    { id: "solana",   symbol: "SOL",  name: "Solana",   amount: 45,   buyPrice: 22 },
    { id: "tether",   symbol: "USDT", name: "Tether",   amount: 1500, buyPrice: 1 }
  ];
}
export function loadPortfolio() {
  const data = loadJson(STORAGE_KEYS.portfolio, null);
  if (data === null) return defaultPortfolio();
  if (!Array.isArray(data)) return [];
  if (data.length === 0) return [];
  return data
    .map(h => {
      const meta = findCoinMeta(h.id) || findCoinMeta(String(h.symbol || "").toLowerCase());
      const amount = safeNumber(h.amount, 0, { min: 0 });
      const buyPrice = safeNumber(h.buyPrice, 0, { min: 0 });
      const id = sanitizeString(meta ? meta.id : h.id, "").toLowerCase();
      const symbol = sanitizeString(meta ? meta.symbol : (h.symbol || ""), "").toUpperCase();
      const name = sanitizeString(meta ? meta.name : (h.name || h.symbol || h.id), "");
      return amount > 0 && id && symbol ? { id, symbol, name, amount, buyPrice } : null;
    })
    .filter(Boolean);
}
export function loadWatchlist() {
  const data = loadJson(STORAGE_KEYS.watchlist, ["cardano", "dogecoin"]);
  if (!Array.isArray(data)) return [];
  const ids = [...new Set(data)]
    .map(id => sanitizeString(id, "").toLowerCase())
    .filter(Boolean)
    .filter(id => COINS.some(c => c.id === id));
  return ids;
}
export function loadWallets() {
  const data = loadJson(STORAGE_KEYS.wallets, []);
  if (!Array.isArray(data)) return [];
  const allowedChains = new Set(["ethereum", "solana", "polygon", "bsc"]);
  return data
    .map(w => {
      const chainRaw = sanitizeString(w.chain || "ethereum", "ethereum").toLowerCase();
      const chain = allowedChains.has(chainRaw) ? chainRaw : "ethereum";
      const address = sanitizeString(w.address, "", 200);
      const label = sanitizeString(w.label, "", 80);
      const addedAt = safeNumber(w.addedAt, Date.now(), { min: 0 });
      const id = sanitizeString(w.id || `${Date.now()}-${Math.random()}`, "");
      if (!address) return null;
      return { id, chain, address, label, addedAt };
    })
    .filter(Boolean);
}
export function loadCgApiKey() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cgApiKey);
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      const value = typeof parsed === "string" ? parsed : parsed.value;
      const savedAt = typeof parsed === "object" && parsed ? parsed.savedAt : null;
      if (savedAt && Date.now() - savedAt > CG_API_KEY_TTL_MS) {
        localStorage.removeItem(STORAGE_KEYS.cgApiKey);
        return "";
      }
      return sanitizeString(value, "");
    } catch {
      return sanitizeString(raw, "");
    }
  } catch {
    return "";
  }
}
export function persistCgApiKey(value) {
  const payload = { value: sanitizeString(value, ""), savedAt: Date.now() };
  try { localStorage.setItem(STORAGE_KEYS.cgApiKey, JSON.stringify(payload)); } catch {}
}
export function loadAlerts() {
  const data = loadJson(STORAGE_KEYS.alerts, []);
  if (!Array.isArray(data)) return [];
  return data
    .map(a => {
      const meta = findCoinMeta(a.coinId) || findCoinMeta(String(a.symbol || "").toLowerCase());
      const id = sanitizeString(a.id || Date.now(), "");
      const coinId = meta ? meta.id : sanitizeString(a.coinId, "").toLowerCase();
      const symbol = meta ? meta.symbol : sanitizeString(a.symbol, "").toUpperCase();
      const name = meta ? meta.name : sanitizeString(a.name || a.symbol || a.coinId, "");
      const target = safeNumber(a.target, 0, { min: 0 });
      if (!coinId || !symbol || target <= 0) return null;
      return {
        id,
        coinId,
        symbol,
        name,
        direction: a.direction === "below" ? "below" : "above",
        target,
        repeat: !!a.repeat,
        active: a.active !== false,
        lastTriggered: a.lastTriggered || null
      };
    })
    .filter(Boolean);
}
export function persistPortfolio() {
  saveJson(STORAGE_KEYS.portfolio, state.portfolio);
}
export function persistWatchlist() {
  saveJson(STORAGE_KEYS.watchlist, state.watchlist);
}
export function persistWallets() {
  saveJson(STORAGE_KEYS.wallets, state.wallets);
}
export function persistAlerts() {
  saveJson(STORAGE_KEYS.alerts, state.alerts);
}
export function persistCurrencyPreference() {
  saveJson(STORAGE_KEYS.currency, state.currency);
}
export function loadCurrencyPreference() {
  const saved = loadJson(STORAGE_KEYS.currency, null);
  if (typeof saved !== "string") return null;
  const code = saved.toLowerCase();
  return CURRENCY_CONFIG[code] ? code : null;
}
export function loadThemePreference() {
  const saved = loadJson(STORAGE_KEYS.theme, "dark");
  return saved === "light" ? "light" : "dark";
}
export function persistThemePreference(theme) {
  saveJson(STORAGE_KEYS.theme, theme === "light" ? "light" : "dark");
}
export function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  state.theme = next;
  document.documentElement.classList.toggle("theme-light", next === "light");
  document.body.classList.toggle("theme-light", next === "light");
  if (el.themeLabel) el.themeLabel.textContent = next === "light" ? "Light" : "Dark";
  if (el.themeToggle) el.themeToggle.setAttribute("aria-pressed", next === "light");
  if (el.themeDot) {
    el.themeDot.classList.toggle("bg-emerald-400", next !== "light");
    el.themeDot.classList.toggle("bg-sky-500", next === "light");
  }
  persistThemePreference(next);
}
export function getDisplayPrice(coinId) {
  const info = state.priceData[coinId];
  if (!info) return null;
  const cur = state.currency;
  if (typeof info[cur] === "number") return info[cur];
  if (typeof info.usd === "number") {
    const rate = state.fxRates[cur] || 1;
    return info.usd * rate;
  }
  return null;
}
export function getDisplayChange(coinId) {
  const info = state.priceData[coinId];
  if (!info) return null;
  const cur = state.currency;
  const key = `${cur}_24h_change`;
  if (typeof info[key] === "number") return info[key];
  if (typeof info.usd_24h_change === "number") return info.usd_24h_change;
  return null;
}
export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
export function pseudoCorrelation(idA, idB) {
  const mix = (idA + idB).split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return Math.sin(mix) * 0.9;
}
export function seededRandom(seed) {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}
export function humanizeTimeAgo(timestamp) {
  if (!timestamp) return "just now";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
export function updateTrendClass(node, value) {
  if (!node) return;
  node.classList.remove("text-emerald-400", "text-emerald-300", "text-rose-400", "text-rose-300", "text-slate-300", "text-slate-400");
  if (!isFinite(value) || value === 0) node.classList.add("text-slate-300");
  else if (value > 0) node.classList.add("text-emerald-400");
  else node.classList.add("text-rose-400");
}
