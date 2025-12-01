import { CURRENCY_CONFIG } from "./constants.js";

export const state = {
  portfolio: [],
  watchlist: [],
  alerts: [],
  wallets: [],
  priceData: {},
  timeframe: "24h",
  chartSeries: { "24h": null, "7d": null, "30d": null },
  chartSettings: {
    chartType: "line",  // 'line' | 'candles' | 'bars'
    indicators: { bb: false, rsi: false, macd: false },
    drawing: {
      tool: "none",     // 'none' | 'trendline' | 'fib'
      trendlines: [],   // { p1:{xNorm,yNorm}, p2:{xNorm,yNorm} }
      fibs: [],         // { top:{xNorm,yNorm}, bottom:{xNorm,yNorm} }
      pending: null     // { type, first:{xNorm,yNorm} }
    }
  },
  theme: "dark",
  lastPortfolioData: null,
  news: [],
  newsFilter: "all",
  newsAutoScrollIndex: 0,
  newsAutoScrollTimer: null,
  lastBacktest: null,
  currency: "usd",
  fxRates: { usd: 1, eur: 0.92, gbp: 0.79, jpy: 150, aud: 1.5, cad: 1.35 }, // Default fallbacks
  priceHistory: {},
  lastPriceSuccess: null,
  cgApiKey: "",

  // Tracks whether a live price refresh request is currently in flight.
  // Without this flag multiple overlapping requests (from auto-refresh timers
  // and manual triggers) can run concurrently, leading to flickering UI and
  // racing updates. When true, subsequent calls to refreshPrices() will
  // return early until the current request finishes.
  priceRefreshing: false,

  // Tracks whether a news fetch request is currently in flight.  This
  // prevents overlapping news API calls and allows the UI to show a
  // loading indicator while the request is in progress.
  newsRefreshing: false,
};

export let audioCtx = null;
export let chartLayout = null;
export let editingCoinId = null;

export const el = {
  totalValue: document.getElementById("total-value"),
  totalCost: document.getElementById("total-cost"),
  totalPnl: document.getElementById("total-pnl"),
  totalPnlPct: document.getElementById("total-pnl-pct"),
  assetsCount: document.getElementById("assets-count"),
  dayPnl: document.getElementById("day-pnl"),
  dayPnlPct: document.getElementById("day-pnl-pct"),
  daySpark: document.getElementById("day-spark"),
  bestName: document.getElementById("best-asset-name"),
  bestChange: document.getElementById("best-asset-change"),
  worstName: document.getElementById("worst-asset-name"),
  worstChange: document.getElementById("worst-asset-change"),
  bestSpark: document.getElementById("best-spark"),
  worstSpark: document.getElementById("worst-spark"),
  holdingsBody: document.getElementById("holdings-body"),
  holdingsCards: document.getElementById("holdings-cards"),
  noHoldings: document.getElementById("no-holdings"),
  allocationList: document.getElementById("allocation-list"),
  allocationEmpty: document.getElementById("allocation-empty"),
  watchlistEmpty: document.getElementById("watchlist-empty"),
  watchlistList: document.getElementById("watchlist-list"),
  priceStatus: document.getElementById("price-status"),
  lastUpdated: document.getElementById("last-updated"),
  refreshBtn: document.getElementById("refresh-btn"),
  refreshDot: document.getElementById("refresh-dot"),
  themeToggle: document.getElementById("theme-toggle"),
  themeLabel: document.getElementById("theme-label"),
  themeDot: document.getElementById("theme-dot"),
  globalCurrencySelect: document.getElementById("global-currency-select"),
  chartCanvas: document.getElementById("performance-chart"),
  chartEmpty: document.getElementById("chart-empty"),
  assetFormTitle: document.getElementById("asset-form-title"),
  assetForm: document.getElementById("asset-form"),
  assetSearch: document.getElementById("asset-search"),
  assetSuggestions: document.getElementById("asset-suggestions"),
  assetSelect: document.getElementById("asset-select"),
  assetAmount: document.getElementById("asset-amount"),
  assetBuyPrice: document.getElementById("asset-buy-price"),
  assetEntryCurrency: document.getElementById("asset-entry-currency"),
  assetSubmitLabel: document.getElementById("asset-submit-label"),
  assetCancelEdit: document.getElementById("asset-cancel-edit"),
  assetFormError: document.getElementById("asset-form-error"),
  watchlistForm: document.getElementById("watchlist-form"),
  watchlistSelect: document.getElementById("watchlist-select"),
  walletForm: document.getElementById("wallet-form"),
  walletChain: document.getElementById("wallet-chain"),
  walletAddress: document.getElementById("wallet-address"),
  walletLabel: document.getElementById("wallet-label"),
  walletList: document.getElementById("wallet-list"),
  walletEmpty: document.getElementById("wallet-empty"),
  metricAnnualized: document.getElementById("metric-annualized"),
  metricSharpe: document.getElementById("metric-sharpe"),
  metricMaxDD: document.getElementById("metric-maxdd"),
  metricVolatility: document.getElementById("metric-volatility"),
  metricVaR1d: document.getElementById("metric-var-1d"),
  metricVaR1dPct: document.getElementById("metric-var-1d-pct"),
  metricVaR5d: document.getElementById("metric-var-5d"),
  riskStressSelect: document.getElementById("risk-stress-select"),
  riskStressLabel: document.getElementById("risk-stress-label"),
  riskStressSummary: document.getElementById("risk-stress-summary"),
  riskCorrGrid: document.getElementById("risk-corr-grid"),
  riskInsightText: document.getElementById("risk-insight-text"),
  scenarioForm: document.getElementById("scenario-form"),
  scenarioAmount: document.getElementById("scenario-amount"),
  scenarioMove: document.getElementById("scenario-move"),
  scenarioResultValue: document.getElementById("scenario-result-value"),
  scenarioResultPnl: document.getElementById("scenario-result-pnl"),
  scenarioNote: document.getElementById("scenario-note"),
  alertsForm: document.getElementById("alerts-form"),
  alertsAsset: document.getElementById("alerts-asset"),
  alertsDirection: document.getElementById("alerts-direction"),
  alertsPrice: document.getElementById("alerts-price"),
  alertsRepeat: document.getElementById("alerts-repeat"),
  alertsList: document.getElementById("alerts-list"),
  alertsEmpty: document.getElementById("alerts-empty"),
  newsCoinFilter: document.getElementById("news-coin-filter"),
  newsStrip: document.getElementById("news-strip"),
  newsEmpty: document.getElementById("news-empty"),
  indicatorBB: document.getElementById("indicator-bb"),
  indicatorRSI: document.getElementById("indicator-rsi"),
  indicatorMACD: document.getElementById("indicator-macd"),
  drawToolSelect: document.getElementById("draw-tool-select"),
  drawClear: document.getElementById("draw-clear"),
  perfMonthPortfolio: document.getElementById("perf-month-portfolio"),
  perfQuarterPortfolio: document.getElementById("perf-quarter-portfolio"),
  perfYearPortfolio: document.getElementById("perf-year-portfolio"),
  perfMonthSP: document.getElementById("perf-month-sp"),
  perfQuarterSP: document.getElementById("perf-quarter-sp"),
  perfYearSP: document.getElementById("perf-year-sp"),
  perfMonthNasdaq: document.getElementById("perf-month-nasdaq"),
  perfQuarterNasdaq: document.getElementById("perf-quarter-nasdaq"),
  perfYearNasdaq: document.getElementById("perf-year-nasdaq"),
  toastContainer: document.getElementById("toast-container"),
  fngValue: document.getElementById("fng-value"),
  fngLabel: document.getElementById("fng-label"),
  fngBar: document.getElementById("fng-bar"),
  btcDom: document.getElementById("btc-dom"),
  altSeason: document.getElementById("alt-season"),
  globalMcap: document.getElementById("global-mcap"),
  altMcap: document.getElementById("alt-mcap"),
  priceStale: document.getElementById("price-stale"),
  cgApiKeyInput: document.getElementById("cg-api-key"),
  cgApiSaveBtn: document.getElementById("cg-api-save"),
  btStrategy: document.getElementById("bt-strategy"),
  btPeriod: document.getElementById("bt-period"),
  btRunBtn: document.getElementById("bt-run-btn"),
  btResults: document.getElementById("bt-results"),
  btSharpe: document.getElementById("bt-sharpe"),
  btSortino: document.getElementById("bt-sortino"),
  btMaxDD: document.getElementById("bt-maxdd"),
  btChart: document.getElementById("bt-chart")
};

export function setAudioCtx(ctx) {
  audioCtx = ctx;
}

export function setChartLayout(layout) {
  chartLayout = layout;
}

export function setEditingCoinId(id) {
  editingCoinId = id;
}
