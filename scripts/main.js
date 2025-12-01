import {
  BENCHMARK_RETURNS,
  CG_API_KEY_TTL_MS,
  COINS,
  CURRENCY_CONFIG,
  STORAGE_KEYS
} from "./constants.js";
import {
  audioCtx,
  chartLayout,
  editingCoinId,
  el,
  setAudioCtx,
  setChartLayout,
  setEditingCoinId,
  state
} from "./state.js";
import {
  applyTheme,
  clamp,
  defaultPortfolio,
  describeChain,
  escapeHtml,
  findCoinMeta,
  formatCurrency,
  formatPercent,
  getDisplayChange,
  getDisplayPrice,
  getExplorerUrl,
  humanizeTimeAgo,
  loadAlerts,
  loadCgApiKey,
  loadCurrencyPreference,
  loadJson,
  loadPortfolio,
  loadThemePreference,
  loadWallets,
  loadWatchlist,
  persistAlerts,
  persistCgApiKey,
  persistCurrencyPreference,
  persistPortfolio,
  persistThemePreference,
  persistWallets,
  persistWatchlist,
  saveJson,
  safeNumber,
  sanitizeString,
  seededRandom,
  shortenAddress,
  updateTrendClass
} from "./utils.js";
import {
  calculatePortfolio,
  computeIndicators,
  computeSeriesMetrics,
  ensureChartSeries,
  generateSyntheticSeries
} from "./analytics.js";
import {
  checkAlerts,
  renderAlerts,
  renderAll,
  renderAllocationMini,
  renderBenchmarksAndScenario,
  fetchBenchmarks,
  renderChartSection,
  renderHoldings,
  renderNews,
  renderRiskMetrics,
  renderSummary,
  renderWallets,
  renderWatchlist,
  showToast,
  updateStressSummary
} from "./renderers.js";
import { fetchNews, fetchNewsFallback, fetchWithRetries, refreshPrices, updatePriceStaleness } from "./services.js";

const PRICE_REFRESH_MS = 60_000;
const NEWS_REFRESH_MS = 5 * 60_000;
const SENTIMENT_REFRESH_MS = 10 * 60_000;
const STALE_CHECK_MS = 20_000;
let priceRefreshTimer = null;
let newsRefreshTimer = null;
let sentimentRefreshTimer = null;
let priceStaleTimer = null;

/* ---------------------- Sentiment ---------------------- */
async function fetchSentiment() {
  try {
    const fngRes = await fetch("https://api.alternative.me/fng/?limit=1");
    if (fngRes.ok) {
      const json = await fngRes.json();
      const data = json.data[0];
      if (el.fngValue) el.fngValue.textContent = data.value;
      if (el.fngLabel) el.fngLabel.textContent = data.value_classification;
      if (el.fngBar) {
        el.fngBar.style.width = data.value + "%";
        el.fngBar.className = `h-full transition-all duration-500 ${
          data.value < 25 ? "bg-rose-500" : data.value < 50 ? "bg-orange-400" : data.value < 75 ? "bg-emerald-400" : "bg-emerald-500"
        }`;
      }
    }
    const globRes = await fetch("https://api.coingecko.com/api/v3/global");
    if (globRes.ok) {
      const json = await globRes.json();
      const btc = json.data.market_cap_percentage.btc;
      const eth = json.data.market_cap_percentage.eth;
      const mcap = json.data.total_market_cap.usd;
      
      if (el.btcDom) el.btcDom.textContent = btc.toFixed(1) + "%";
      if (el.globalMcap) el.globalMcap.textContent = "$" + (mcap / 1e12).toFixed(2) + "T";

      if (el.altMcap) {
         const altShare = 100 - btc - (eth || 0);
         const altVal = mcap * (altShare / 100);
         el.altMcap.textContent = "$" + (altVal / 1e12).toFixed(2) + "T";
      }
      
      if (el.altSeason) {
        const altIndex = Math.max(0, Math.min(100, (60 - btc) * 3.5));
        el.altSeason.textContent = altIndex.toFixed(0);
        el.altSeason.classList.remove("text-emerald-400", "font-bold", "text-slate-200");
        el.altSeason.classList.add("font-mono");
        if (altIndex > 75) {
            el.altSeason.classList.add("text-emerald-400", "font-bold");
        } else {
            el.altSeason.classList.add("text-slate-200");
        }
      }
    }
  } catch (e) { console.log("Sentiment fetch failed", e); }
}

function checkPriceFreshness() {
  if (!state.lastPriceSuccess) return;
  const age = Date.now() - state.lastPriceSuccess;
  if (age > PRICE_REFRESH_MS * 2) updatePriceStaleness(false);
}

function scheduleAutoRefresh() {
  if (priceRefreshTimer) clearInterval(priceRefreshTimer);
  if (newsRefreshTimer) clearInterval(newsRefreshTimer);
  if (sentimentRefreshTimer) clearInterval(sentimentRefreshTimer);
  if (priceStaleTimer) clearInterval(priceStaleTimer);

  priceRefreshTimer = setInterval(() => refreshPrices({ light: true }), PRICE_REFRESH_MS);
  newsRefreshTimer = setInterval(() => fetchNews(), NEWS_REFRESH_MS);
  sentimentRefreshTimer = setInterval(() => fetchSentiment(), SENTIMENT_REFRESH_MS);
  priceStaleTimer = setInterval(checkPriceFreshness, STALE_CHECK_MS);
}

/* ---------------------- Backtesting ---------------------- */
async function fetchHistoricalPrices(ids, days) {
  const currency = state.currency || "usd";
  const result = {};
  const cacheKey = `${days}-${currency}`;

  for (const id of ids) {
    if (!id) continue;
    const cached = state.priceHistory[id]?.[cacheKey];
    if (cached) {
      result[id] = cached;
      continue;
    }
    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${currency}&days=${days}&interval=daily`;
    try {
      const res = await fetchWithRetries(url, {}, 3, 700);
      const json = await res.json();
      if (!Array.isArray(json.prices)) continue;
      result[id] = json.prices;
      state.priceHistory[id] = state.priceHistory[id] || {};
      state.priceHistory[id][cacheKey] = json.prices;
    } catch (err) {
      console.warn(`Failed to fetch history for ${id}:`, err);
      // Don't explode the whole backtest on one bad asset; continue with others.
    }
  }

  return result;
}

async function runBacktest() {
  if (!el.btResults || !state.lastPortfolioData) return;
  el.btResults.classList.remove("hidden");

  const strategy = el.btStrategy.value;
  const days = parseInt(el.btPeriod.value);
  const portfolio = state.lastPortfolioData;
  const holdings = (portfolio.holdings || []).filter(h => h.value > 0);
  if (!holdings.length) {
    showToast("Add holdings to run a backtest.", "warn");
    return;
  }

  if (el.btRunBtn) {
    el.btRunBtn.disabled = true;
    el.btRunBtn.textContent = "Running…";
  }

  try {
    const ids = holdings.map(h => h.id);
    const history = await fetchHistoricalPrices(ids, days + 1);
    if (!Object.keys(history).length) {
      showToast("Historical prices unavailable.", "error");
      return;
    }

    const weights = holdings.map(h => h.value / portfolio.totals.totalValue);
    const series = holdings.map(h => history[h.id] || []);
    const minLen = Math.min(...series.map(s => s.length));
    if (!isFinite(minLen) || minLen < 2) {
      showToast("Not enough history to backtest.", "warn");
      return;
    }

    const startValue = 10000;
    const pricePath = [];
    for (let i = 0; i < minLen; i++) {
      let valueNorm = 0;
      series.forEach((s, idx) => {
        const start = s[0][1];
        const price = s[i][1];
        valueNorm += weights[idx] * (price / start);
      });
      pricePath.push(startValue * valueNorm);
    }

    const equityCurve = [startValue];
    let cash = startValue;
    let invested = 0;

    function calcSMA(arr, period, idx) {
      if (idx < period) return null;
      let sum=0; for(let k=0; k<period; k++) sum+=arr[idx-k];
      return sum/period;
    }

    for (let i=0; i<pricePath.length; i++) {
      const price = pricePath[i];

      const fast = calcSMA(pricePath, 20, i);
      const slow = calcSMA(pricePath, 50, i);
      let rsiVal = 50;
      if (i > 14) {
         let gains=0, losses=0;
         for(let k=0; k<14; k++) {
           const d = pricePath[i-k] - pricePath[i-k-1];
           if (d>0) gains+=d; else if (d<0) losses-=d;
         }
         if (losses === 0) rsiVal = 100;
         else rsiVal = 100 - 100/(1+(gains/losses));
      }

      let action = "hold";
      if (strategy === "hold") {
        if (i===0) action = "buy";
      } else if (strategy === "sma_cross") {
        if (fast && slow) {
          if (fast > slow && invested === 0) action = "buy";
          if (fast < slow && invested > 0) action = "sell";
        }
      } else if (strategy === "rsi_strat") {
        if (rsiVal < 30 && invested === 0) action = "buy";
        if (rsiVal > 70 && invested > 0) action = "sell";
      } else if (strategy === "bollinger") {
        if (fast) {
           if (price > fast*1.05 && invested === 0) action = "buy";
           if (price < fast*0.95 && invested > 0) action = "sell";
        }
      }

      if (action === "buy") {
        invested = cash / price;
        cash = 0;
      } else if (action === "sell") {
        cash = invested * price;
        invested = 0;
      }

      const curVal = cash + (invested * price);
      equityCurve.push(curVal);
    }

    const returns = [];
    let peak = equityCurve[0];
    let maxDD = 0;
    let downsideSum = 0;

    for(let i=1; i<equityCurve.length; i++) {
      const r = (equityCurve[i] - equityCurve[i-1]) / equityCurve[i-1];
      returns.push(r);

      if (equityCurve[i] > peak) peak = equityCurve[i];
      const dd = (peak - equityCurve[i]) / peak;
      if (dd > maxDD) maxDD = dd;

      if (r < 0) downsideSum += r*r;
    }

    const avgRet = returns.reduce((a,b)=>a+b,0)/returns.length;
    const stdDev = Math.sqrt(returns.reduce((s,r)=>s+(r-avgRet)**2, 0)/returns.length);
    const downDev = Math.sqrt(downsideSum / returns.length);
    const annRet = avgRet * 365;
    const annVol = stdDev * Math.sqrt(365);
    const riskFree = 0.02;

    const sharpe = annVol > 0 ? (annRet - riskFree) / annVol : 0;
    const sortino = downDev > 0 ? (annRet - riskFree) / (downDev * Math.sqrt(365)) : 0;

    if (el.btSharpe) el.btSharpe.textContent = sharpe.toFixed(2);
    if (el.btSortino) el.btSortino.textContent = sortino.toFixed(2);
    if (el.btMaxDD) el.btMaxDD.textContent = "-" + (maxDD*100).toFixed(1) + "%";

    updateTrendClass(el.btSharpe, sharpe);
    updateTrendClass(el.btSortino, sortino);

    state.lastBacktest = { buyHold: pricePath, strategy: equityCurve };
    drawBacktestChart(el.btChart, pricePath, equityCurve);
  } catch (err) {
    console.warn(err);
    showToast("Backtest failed. Please retry.", "error");
  } finally {
    if (el.btRunBtn) {
      el.btRunBtn.disabled = false;
      el.btRunBtn.textContent = "Run backtest";
    }
  }
}

function drawBacktestChart(canvas, buyHold, strategy) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const light = state.theme === "light";
  const palette = light ? {
    buyHold: "rgba(100,116,139,0.6)",
    strategy: "rgba(37,99,235,0.9)"
  } : {
    buyHold: "rgba(148,163,184,0.5)",
    strategy: "rgba(129,140,248,1)"
  };
  
  const pad = 4;
  const w = rect.width - pad*2;
  const h = rect.height - pad*2;
  
  const all = [...buyHold, ...strategy];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  
  function plot(data, color, dash=[]) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash);
    data.forEach((v, i) => {
      const x = pad + (i / (data.length - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  plot(buyHold, palette.buyHold, [3,3]);
  plot(strategy, palette.strategy);
}

/* ---------------------- Event handlers ---------------------- */
function populateSelects(searchTerm = "") {
  const term = searchTerm.trim().toLowerCase();
  let list = COINS;
  if (term) {
    list = COINS.filter(c => c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term));
  }
  const assetOptions = list.slice(0, 150);
  const current = el.assetSelect.value;
  el.assetSelect.innerHTML = assetOptions.map(c => `<option value="${c.id}">${c.symbol} · ${c.name}</option>`).join("");
  if (!term && current && assetOptions.every(o => o.id !== current)) {
    const existing = findCoinMeta(current);
    if (existing) {
      const opt = document.createElement("option");
      opt.value = existing.id;
      opt.textContent = `${existing.symbol} · ${existing.name}`;
      el.assetSelect.prepend(opt);
    }
  }
  if (!term && current) {
    el.assetSelect.value = current;
  }

  if (el.assetSuggestions) {
    const suggestionItems = (term ? list : COINS).slice(0, 20);
    el.assetSuggestions.innerHTML = suggestionItems
      .map(c => `<option value="${escapeHtml(c.symbol.toUpperCase())}">${escapeHtml(c.name)}</option>`)
      .join("");
  }

  if (!el.assetSelect.value && assetOptions.length) {
    el.assetSelect.value = assetOptions[0].id;
  }

  el.watchlistSelect.innerHTML = COINS.slice(0, 200).map(c => `<option value="${c.id}">${c.symbol} · ${c.name}</option>`).join("");
  el.alertsAsset.innerHTML = COINS.map(c => `<option value="${c.id}">${c.symbol} · ${c.name}</option>`).join("");

  const filterSet = new Set(["all", ...state.portfolio.map(h => h.id), ...state.watchlist]);
  el.newsCoinFilter.innerHTML = Array.from(filterSet).map(id => {
    if (id === "all") return '<option value="all">All</option>';
    const meta = findCoinMeta(id) || { symbol: id.toUpperCase(), name: id };
    return `<option value="${escapeHtml(id)}">${escapeHtml(meta.symbol)}</option>`;
  }).join("");
  el.newsCoinFilter.value = filterSet.has(state.newsFilter) ? state.newsFilter : "all";
}

function handleSaveCgApiKey(e) {
  e.preventDefault();
  const val = sanitizeString(el.cgApiKeyInput?.value || "", "");
  state.cgApiKey = val;
  persistCgApiKey(val);
  if (el.cgApiKeyInput) el.cgApiKeyInput.value = val;
  showToast(val ? "API key saved. Lower rate limits." : "Cleared API key.", "info");
}

function handleThemeToggle() {
  const next = state.theme === "light" ? "dark" : "light";
  applyTheme(next);
  if (state.lastPortfolioData) {
    renderChartSection(state.lastPortfolioData);
  }
  if (state.lastBacktest && el.btChart) {
    drawBacktestChart(el.btChart, state.lastBacktest.buyHold, state.lastBacktest.strategy);
  }
}

function handleTimeframeClick(e) {
  const timeframe = e.currentTarget.dataset.timeframe;
  if (!timeframe || timeframe === state.timeframe) return;
  state.timeframe = timeframe;
  renderChartSection(state.lastPortfolioData || calculatePortfolio(state.portfolio, state.priceData));
}

function handleChartTypeClick(e) {
  const chartType = e.currentTarget.dataset.chartType;
  if (!chartType || chartType === state.chartSettings.chartType) return;
  state.chartSettings.chartType = chartType;
  renderChartSection(state.lastPortfolioData || calculatePortfolio(state.portfolio, state.priceData));
}

function handleAssetForm(event) {
  event.preventDefault();
  const coinId = el.assetSelect.value;
  const amount = parseFloat(el.assetAmount.value);
  if (!coinId || !isFinite(amount) || amount <= 0) {
    el.assetFormError.textContent = "Select an asset and enter a valid amount.";
    el.assetFormError.classList.remove("hidden");
    return;
  }
  el.assetFormError.classList.add("hidden");
  const buyPriceInput = parseFloat(el.assetBuyPrice.value);
  const entryCur = el.assetEntryCurrency.value || "usd";
  const fx = state.fxRates[entryCur] || 1;
  const buyPriceUsd = isFinite(buyPriceInput) && buyPriceInput > 0 ? buyPriceInput / fx : 0;
  const meta = findCoinMeta(coinId) || { id: coinId, symbol: coinId.toUpperCase(), name: coinId };
  const existingIndex = state.portfolio.findIndex(h => h.id === coinId);
  if (editingCoinId && existingIndex >= 0 && editingCoinId !== coinId) {
    showToast("Cannot change to a new asset while editing. Remove and add again.", "warn");
    return;
  }
  if (editingCoinId) {
    const idx = state.portfolio.findIndex(h => h.id === editingCoinId);
    if (idx >= 0) {
      state.portfolio[idx].amount = amount;
      state.portfolio[idx].buyPrice = buyPriceUsd;
    }
    showToast("Position updated", "success");
  } else if (existingIndex >= 0) {
    const holding = state.portfolio[existingIndex];
    const totalAmount = holding.amount + amount;
    const newCost = (holding.buyPrice * holding.amount + (buyPriceUsd || holding.buyPrice) * amount) / totalAmount;
    holding.amount = totalAmount;
    holding.buyPrice = newCost || holding.buyPrice;
    showToast("Position topped up", "success");
  } else {
    state.portfolio.push({
      id: meta.id,
      symbol: meta.symbol,
      name: meta.name,
      amount,
      buyPrice: buyPriceUsd
    });
    showToast("Position added", "success");
  }
  persistPortfolio();
  clearEditMode();
  el.assetForm.reset();
  renderAll();
  refreshPrices({ light: true });
}

function clearEditMode() {
  setEditingCoinId(null);
  el.assetForm.reset();
  el.assetSearch.value = "";
  el.assetFormTitle.textContent = "Add position";
  el.assetSubmitLabel.textContent = "Add position";
  el.assetCancelEdit.classList.add("hidden");
  populateSelects();
}

function handleHoldingsClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (!id) return;
  const holding = state.portfolio.find(h => h.id === id);
  if (!holding) return;
  if (action === "edit") {
    setEditingCoinId(id);
    populateSelects();
    el.assetSelect.value = id;
    el.assetAmount.value = holding.amount;
    el.assetBuyPrice.value = holding.buyPrice ? holding.buyPrice : "";
    el.assetFormTitle.textContent = `Editing ${holding.symbol}`;
    el.assetSubmitLabel.textContent = "Update position";
    el.assetCancelEdit.classList.remove("hidden");
    el.assetFormError.classList.add("hidden");
  } else if (action === "delete") {
    state.portfolio = state.portfolio.filter(h => h.id !== id);
    persistPortfolio();
    showToast(`${holding.symbol} removed`, "warn");
    clearEditMode();
    renderAll();
  }
}

function handleWatchlistForm(e) {
  e.preventDefault();
  const id = el.watchlistSelect.value;
  if (!id) return;
  if (state.watchlist.includes(id)) {
    showToast("Already on watchlist", "info");
    return;
  }
  state.watchlist.push(id);
  persistWatchlist();
  renderWatchlist();
  populateSelects(el.assetSearch.value);
  showToast("Watchlist updated", "success");
}

function handleWatchlistClick(e) {
  const btn = e.target.closest("button.watchlist-remove");
  if (!btn) return;
  const id = btn.dataset.id;
  state.watchlist = state.watchlist.filter(item => item !== id);
  persistWatchlist();
  renderWatchlist();
  populateSelects(el.assetSearch.value);
}

function handleWalletForm(e) {
  e.preventDefault();
  const chain = (el.walletChain.value || "ethereum").toLowerCase();
  const address = (el.walletAddress.value || "").trim();
  const label = (el.walletLabel.value || "").trim();
  if (!address) {
    showToast("Enter a wallet address to track", "error");
    return;
  }
  const normalized = address.toLowerCase();
  const exists = state.wallets.some(w => w.chain === chain && w.address.toLowerCase() === normalized);
  if (exists) {
    showToast("Already tracking that wallet", "info");
    return;
  }
  state.wallets.push({
    id: String(Date.now()),
    chain,
    address,
    label,
    addedAt: Date.now()
  });
  persistWallets();
  renderWallets();
  el.walletForm.reset();
  showToast("Wallet added", "success");
}

function handleWalletListClick(e) {
  const btn = e.target.closest("button.wallet-remove");
  if (!btn) return;
  const id = btn.dataset.id;
  state.wallets = state.wallets.filter(w => w.id !== id);
  persistWallets();
  renderWallets();
}

function handleAlertsForm(e) {
  e.preventDefault();
  const coinId = el.alertsAsset.value;
  const direction = el.alertsDirection.value;
  const target = parseFloat(el.alertsPrice.value);
  if (!coinId || !isFinite(target) || target <= 0) {
    showToast("Enter a valid alert target", "error");
    return;
  }
  const meta = findCoinMeta(coinId) || { symbol: coinId.toUpperCase(), name: coinId };
  state.alerts.push({
    id: String(Date.now()),
    coinId,
    symbol: meta.symbol,
    name: meta.name,
    direction,
    target,
    repeat: el.alertsRepeat.checked,
    active: true,
    lastTriggered: null
  });
  persistAlerts();
  el.alertsForm.reset();
  renderAlerts();
  showToast("Alert added", "success");
}

function handleAlertsListClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const alert = state.alerts.find(a => a.id === id);
  if (!alert) return;
  if (btn.dataset.action === "toggle") {
    alert.active = !alert.active;
    showToast(`Alert ${alert.active?"resumed":"paused"}`, "info");
  } else if (btn.dataset.action === "delete") {
    state.alerts = state.alerts.filter(a => a.id !== id);
    showToast("Alert deleted", "warn");
  }
  persistAlerts();
  renderAlerts();
}

function handleNewsFilter(e) {
  state.newsFilter = e.target.value;
  renderNews();
}

function handleIndicatorToggle() {
  state.chartSettings.indicators.bb = el.indicatorBB.checked;
  state.chartSettings.indicators.rsi = el.indicatorRSI.checked;
  state.chartSettings.indicators.macd = el.indicatorMACD.checked;
  renderChartSection(state.lastPortfolioData || calculatePortfolio(state.portfolio, state.priceData));
}

function handleDrawToolChange(e) {
  state.chartSettings.drawing.tool = e.target.value;
  state.chartSettings.drawing.pending = null;
  showToast(state.chartSettings.drawing.tool === "none" ? "Drawing disabled" : `Drawing ${state.chartSettings.drawing.tool}`, "info");
}

function handleDrawClear() {
  state.chartSettings.drawing.trendlines = [];
  state.chartSettings.drawing.fibs = [];
  state.chartSettings.drawing.pending = null;
  renderChartSection(state.lastPortfolioData || calculatePortfolio(state.portfolio, state.priceData));
  showToast("Drawing overlays cleared", "success");
}

function handleChartClick(e) {
  const tool = state.chartSettings.drawing.tool;
  if (tool === "none" || !chartLayout) return;
  const rect = el.chartCanvas.getBoundingClientRect();
  const xNorm = clamp((e.clientX - rect.left - chartLayout.paddingX) / chartLayout.innerWidth);
  const yNorm = clamp((e.clientY - rect.top - chartLayout.mainTop) / chartLayout.mainHeight);
  if (!state.chartSettings.drawing.pending) {
    state.chartSettings.drawing.pending = { type: tool, first: { xNorm, yNorm } };
    showToast("First point locked. Click again to finish.", "info");
    return;
  }
  const pending = state.chartSettings.drawing.pending;
  if (pending.type !== tool) {
    state.chartSettings.drawing.pending = { type: tool, first: { xNorm, yNorm } };
    return;
  }
  if (tool === "trendline") {
    state.chartSettings.drawing.trendlines.push({ p1: pending.first, p2: { xNorm, yNorm } });
  } else if (tool === "fib") {
    state.chartSettings.drawing.fibs.push({ top: pending.first, bottom: { xNorm, yNorm } });
  }
  state.chartSettings.drawing.pending = null;
  renderChartSection(state.lastPortfolioData || calculatePortfolio(state.portfolio, state.priceData));
}

function handleScenarioSubmit(e) {
  e.preventDefault();
  const base = state.lastPortfolioData?.totals?.totalValue || 0;
  if (!base) {
    showToast("Add holdings to run scenarios.", "warn");
    return;
  }
  const extra = parseFloat(el.scenarioAmount.value) || 0;
  const move = parseFloat(el.scenarioMove.value) || 0;
  const future = (base + extra) * (1 + move);
  const pnl = future - base;
  el.scenarioResultValue.textContent = formatCurrency(future);
  el.scenarioResultPnl.textContent = formatCurrency(pnl);
  updateTrendClass(el.scenarioResultPnl, pnl);
  el.scenarioNote.textContent = `Shock ${formatPercent(move*100)} applied to current holdings plus extra capital.`;
}

function unlockAudio() {
  if (!audioCtx) {
    setAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
  }
  if (audioCtx?.state === "suspended") {
    audioCtx.resume();
  }
}

function ensureAudioContext() {
  if (!audioCtx) setAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
  return audioCtx;
}

function playAlertTone() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
}

/* ---------------------- Init ---------------------- */
async function init() {
  const savedTheme = loadThemePreference();
  applyTheme(savedTheme);

  state.portfolio = loadPortfolio();
  state.watchlist = loadWatchlist();
  state.alerts    = loadAlerts();
  state.wallets   = loadWallets();

  // Load persistent FX rates
  const savedFx = loadJson(STORAGE_KEYS.fx, null);
  if (savedFx) state.fxRates = savedFx;

  const savedCurrency = loadCurrencyPreference();
  if (savedCurrency) {
    state.currency = savedCurrency;
    if (el.globalCurrencySelect) el.globalCurrencySelect.value = savedCurrency;
  }

  state.cgApiKey = loadCgApiKey();
  if (el.cgApiKeyInput) el.cgApiKeyInput.value = state.cgApiKey;

  populateSelects();
  const data = calculatePortfolio(state.portfolio,state.priceData);
  state.lastPortfolioData=data;
  renderAll();

  document.querySelectorAll(".timeframe-btn").forEach(btn=>{
    btn.addEventListener("click", handleTimeframeClick);
  });
  document.querySelectorAll(".chart-type-btn").forEach(btn=>{
    btn.addEventListener("click", handleChartTypeClick);
  });
  if (el.assetForm) el.assetForm.addEventListener("submit", handleAssetForm);
  if (el.assetCancelEdit) el.assetCancelEdit.addEventListener("click", clearEditMode);
  if (el.assetSearch) el.assetSearch.addEventListener("input", (e) => populateSelects(e.target.value));
  if (el.holdingsBody) el.holdingsBody.addEventListener("click", handleHoldingsClick);
  if (el.holdingsCards) el.holdingsCards.addEventListener("click", handleHoldingsClick);
  if (el.watchlistForm) el.watchlistForm.addEventListener("submit", handleWatchlistForm);
  if (el.watchlistList) el.watchlistList.addEventListener("click", handleWatchlistClick);
  if (el.walletForm) el.walletForm.addEventListener("submit", handleWalletForm);
  if (el.walletList) el.walletList.addEventListener("click", handleWalletListClick);
  if (el.alertsForm) el.alertsForm.addEventListener("submit", handleAlertsForm);
  if (el.alertsList) el.alertsList.addEventListener("click", handleAlertsListClick);
  if (el.newsCoinFilter) el.newsCoinFilter.addEventListener("change", handleNewsFilter);
  if (el.refreshBtn) el.refreshBtn.addEventListener("click", ()=>refreshPrices());
  if (el.cgApiSaveBtn) el.cgApiSaveBtn.addEventListener("click", handleSaveCgApiKey);
  if (el.themeToggle) el.themeToggle.addEventListener("click", handleThemeToggle);
  if (el.globalCurrencySelect) el.globalCurrencySelect.addEventListener("change", (e) => {
     const nextCurrency = (e.target.value || "usd").toLowerCase();
     state.currency = CURRENCY_CONFIG[nextCurrency] ? nextCurrency : "usd";
     persistCurrencyPreference();
     renderAll();
  });
  if (el.indicatorBB) el.indicatorBB.addEventListener("change", handleIndicatorToggle);
  if (el.indicatorRSI) el.indicatorRSI.addEventListener("change", handleIndicatorToggle);
  if (el.indicatorMACD) el.indicatorMACD.addEventListener("change", handleIndicatorToggle);
  if (el.drawToolSelect) el.drawToolSelect.addEventListener("change", handleDrawToolChange);
  if (el.drawClear) el.drawClear.addEventListener("click", handleDrawClear);
  if (el.chartCanvas) el.chartCanvas.addEventListener("click", handleChartClick);
  if (el.scenarioForm) el.scenarioForm.addEventListener("submit", handleScenarioSubmit);
  if (el.riskStressSelect) el.riskStressSelect.addEventListener("change", ()=>{
    const data = state.lastPortfolioData || calculatePortfolio(state.portfolio,state.priceData);
    updateStressSummary(data, parseFloat(el.riskStressSelect.value||"-0.25"));
  });
  
  // Unlock audio context on user interaction
  document.addEventListener('click', unlockAudio, { once: true });

  // Kick off the initial data loads sequentially.  If any call fails it
  // gracefully handles its own errors internally and displays fallbacks.
  try {
    await refreshPrices();
  } catch (e) {
    console.warn("Initial price refresh failed", e);
  }
  try {
    await fetchNews();
  } catch (e) {
    console.warn("Initial news fetch failed", e);
  }
  try {
    await fetchSentiment();
  } catch (e) {
    console.warn("Initial sentiment fetch failed", e);
  }
  try {
    await fetchBenchmarks();
  } catch (e) {
    console.warn("Initial benchmarks fetch failed", e);
  }
  // Once the first set of data has loaded, start the periodic auto refresh
  // timers.  These will use the new guards in services.js to prevent
  // overlapping fetches.
  scheduleAutoRefresh();

  if (el.btRunBtn) el.btRunBtn.addEventListener("click", runBacktest);
}

document.addEventListener("DOMContentLoaded", init);
