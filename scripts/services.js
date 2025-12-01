import { CURRENCY_CONFIG, STORAGE_KEYS } from "./constants.js";
import { el, state } from "./state.js";
import { calculatePortfolio } from "./analytics.js";
import { renderAll, checkAlerts, renderNews, showToast } from "./renderers.js";
import { saveJson, seededRandom } from "./utils.js";

function buildFallbackPrices(ids) {
  const now = Date.now();
  const prices = {};
  ids.forEach((id, idx) => {
    const base = 12 + seededRandom(now + idx) * 800; // keep numbers reasonable for UI
    const change = (seededRandom(now - idx) - 0.5) * 18; // -9% to +9%
    const fx = state.fxRates || {};
    prices[id] = {
      usd: Number(base.toFixed(2)),
      eur: Number((base * (fx.eur || 0.92)).toFixed(2)),
      gbp: Number((base * (fx.gbp || 0.79)).toFixed(2)),
      jpy: Number((base * (fx.jpy || 150)).toFixed(0)),
      aud: Number((base * (fx.aud || 1.5)).toFixed(2)),
      cad: Number((base * (fx.cad || 1.35)).toFixed(2)),
      usd_24h_change: Number(change.toFixed(2)),
    };
  });
  return prices;
}

/* ---------------------- Price fetching ---------------------- */
export async function fetchWithRetries(url, options = {}, attempts = 3, backoffMs = 500, timeoutMs = 12000) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
    try {
      const headers = options.headers ? { ...options.headers } : {};
      const apiKey = (state.cgApiKey || "").trim();
      if (apiKey) {
        const headerName = apiKey.toUpperCase() === "CG-DATA-API" ? "x-cg-demo-api-key" : "x-cg-pro-api-key";
        headers[headerName] = apiKey;
      }
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = backoffMs * Math.pow(2, i);
      await new Promise(r => setTimeout(r, delay));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error("Request failed");
}

export function updatePriceStaleness(success) {
  if (success) {
    state.lastPriceSuccess = Date.now();
    if (el.priceStale) el.priceStale.classList.add("hidden");
    if (el.refreshDot) {
      el.refreshDot.classList.remove("bg-amber-400","shadow-[0_0_10px_rgba(251,191,36,0.9)]");
      el.refreshDot.classList.add("bg-emerald-400","shadow-[0_0_14px_rgba(16,185,129,0.95)]");
    }
    return;
  }
  if (!state.lastPriceSuccess) {
    if (el.priceStale) el.priceStale.textContent = "No data";
    if (el.priceStale) el.priceStale.classList.remove("hidden");
    if (el.refreshDot) {
      el.refreshDot.classList.remove("bg-emerald-400","shadow-[0_0_14px_rgba(16,185,129,0.95)]");
      el.refreshDot.classList.add("bg-amber-400","shadow-[0_0_10px_rgba(251,191,36,0.9)]");
    }
    return;
  }
  if (el.priceStale) {
    const time = new Date(state.lastPriceSuccess).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    el.priceStale.textContent = `Stale since ${time}`;
    el.priceStale.classList.remove("hidden");
  }
  if (el.refreshDot) {
    el.refreshDot.classList.remove("bg-emerald-400","shadow-[0_0_14px_rgba(16,185,129,0.95)]");
    el.refreshDot.classList.add("bg-amber-400","shadow-[0_0_10px_rgba(251,191,36,0.9)]");
  }
}

export async function refreshPrices(opts={light:false}) {
  // If a refresh is already underway we skip launching a new one.  Frequent actions
  // (like editing holdings or the auto timer) can trigger refreshPrices() repeatedly.
  // Without a guard we end up with overlapping network requests and confusing UI
  // states. When a manual refresh (non-light call) is attempted during an active
  // refresh we notify the user.
  if (state.priceRefreshing) {
    if (!opts || !opts.light) {
      try {
        // Avoid spamming toasts on rapid auto refreshes; only notify for deliberate
        // user actions. The toast container may not be defined in all contexts so
        // guard against exceptions.
        showToast("Price refresh already in progress", "info");
      } catch (e) {}
    }
    return;
  }

  state.priceRefreshing = true;

  const idsSet = new Set();
  state.portfolio.forEach(h=>idsSet.add(h.id));
  state.watchlist.forEach(id=>idsSet.add(id));
  state.alerts.forEach(a=>idsSet.add(a.coinId));
  const ids = Array.from(idsSet).filter(Boolean);

  try {
    if (el.refreshBtn) el.refreshBtn.disabled=true;
    if (el.priceStatus) el.priceStatus.textContent="Refreshing…";
    if (el.refreshDot) el.refreshDot.classList.add("bg-emerald-300","animate-pulse");
    
    if (!ids.length) {
      state.priceData = {};
      const now = new Date();
      if (el.lastUpdated) el.lastUpdated.textContent = now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
      if (el.priceStatus) el.priceStatus.textContent="No assets";
      const data = calculatePortfolio(state.portfolio, state.priceData);
      state.lastPortfolioData = data;
      renderAll();
      return;
    }

    const vsCurrencies = Object.keys(CURRENCY_CONFIG).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?vs_currencies=${vsCurrencies}&include_24hr_change=true&ids=`+ids.map(encodeURIComponent).join(",");
    
    const res = await fetchWithRetries(url, {}, 3, 600);
    const data = await res.json();
    
    if (data.tether) {
      const t = data.tether;
      const usdVal = t.usd || 1;
      Object.keys(CURRENCY_CONFIG).forEach(k => {
         if (t[k]) state.fxRates[k] = t[k] / usdVal;
      });
      // Save FX to local storage so it doesn't reset on reload
      saveJson(STORAGE_KEYS.fx, state.fxRates);
    }
    
    state.priceData = data || {};
    const now = new Date();
    state.lastPriceSuccess = now.getTime();
    if (el.lastUpdated) el.lastUpdated.textContent = now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    if (el.priceStatus) el.priceStatus.textContent="Live prices";
    updatePriceStaleness(true);
    const portfolioData = calculatePortfolio(state.portfolio,state.priceData);
    state.lastPortfolioData=portfolioData;
    renderAll();
    checkAlerts();
  } catch (err) {
    console.warn(err);
    if (ids.length) {
      const fallback = buildFallbackPrices(ids);
      state.priceData = fallback;
      const now = new Date();
      state.lastPriceSuccess = now.getTime();
      if (el.lastUpdated) el.lastUpdated.textContent = now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
      if (el.priceStatus) el.priceStatus.textContent="Offline demo prices";
      showToast("Live price API unavailable; showing synthetic demo prices instead.","warn");
      renderAll();
      updatePriceStaleness(true);
    } else {
      if (el.priceStatus) el.priceStatus.textContent="Price error";
      showToast("Could not refresh prices. Try again shortly.","error");
      updatePriceStaleness(false);
    }
  } finally {
    if (el.refreshBtn) el.refreshBtn.disabled=false;
    if (el.refreshDot) el.refreshDot.classList.remove("animate-pulse");

    // Mark the refresh cycle complete so subsequent calls can proceed.
    state.priceRefreshing = false;
  }
}

export function fetchNewsFallback() {
  state.news = [
    {
      id: "fallback-1",
      title: "Crypto markets consolidate ahead of macro data",
      url: "https://news.example.com/market",
      source: "Fallback",
      summary: "Key majors hold support while traders watch liquidity across L2 ecosystems.",
      publishedAt: Date.now() - 3600000,
      coins: ["BTC","ETH","SOL"]
    },
    {
      id: "fallback-2",
      title: "Layer 2 growth sparks optimism",
      url: "https://news.example.com/l2",
      source: "Fallback",
      summary: "Bridge flows into Base, Blast and Mantle continue to climb with healthy fees.",
      publishedAt: Date.now() - 7200000,
      coins: ["BASE","BLAST","MNT"]
    }
  ];
  renderNews(true);
}

export async function fetchNews() {
  // Avoid launching multiple news requests simultaneously.  If a fetch is already
  // underway (e.g. from the auto refresh timer) simply return.
  if (state.newsRefreshing) return;

  state.newsRefreshing = true;
  try {
    // Clear existing news and show the loading message. renderNews() will display
    // "Loading news..." when state.news is empty and isFallback is false.
    state.news = [];
    renderNews();

    const url = "https://min-api.cryptocompare.com/data/v2/news/?lang=EN";
    // Use the unified retry/backoff helper. Setting a modest backoff reduces the
    // chance of overwhelming the API if it is temporarily unreachable.
    const res = await fetchWithRetries(url, {}, 3, 700);
    const json = await res.json();
    if (!json || !Array.isArray(json.Data)) throw new Error("Bad news payload");
    state.news = json.Data.slice(0, 25).map(item => ({
      id: item.id,
      title: item.title,
      url: item.url,
      source: item.source_info?.name || item.source || "CryptoCompare",
      summary: item.body?.slice(0, 140) || "",
      publishedAt: (item.published_on || 0) * 1000,
      coins: (item.tags || "BTC").split("|").map(tag => tag.trim().toUpperCase()).filter(Boolean)
    }));
    renderNews();
  } catch (err) {
    console.warn("News fetch failed", err);
    showToast("News feed unavailable", "warn");
    // If the remote API fails entirely after retries, fall back to a synthetic set
    // of news items and inform the renderer that this is a fallback.
    fetchNewsFallback();
  } finally {
    state.newsRefreshing = false;
  }
}
