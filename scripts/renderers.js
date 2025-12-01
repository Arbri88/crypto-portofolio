import { BENCHMARK_RETURNS, STORAGE_KEYS } from "./constants.js";
import { chartLayout, el, setChartLayout, state } from "./state.js";
import {
  clamp,
  describeChain,
  escapeHtml,
  findCoinMeta,
  formatCurrency,
  formatPercent,
  getDisplayChange,
  getDisplayPrice,
  getExplorerUrl,
  humanizeTimeAgo,
  loadJson,
  saveJson,
  shortenAddress,
  updateTrendClass
} from "./utils.js";
import { computeIndicators, computeSeriesMetrics, ensureChartSeries } from "./analytics.js";

let newsScrollTimer = null;

function startNewsAutoScroll() {
  if (newsScrollTimer) clearInterval(newsScrollTimer);
  if (!el.newsStrip) return;
  newsScrollTimer = setInterval(() => {
    if (!el.newsStrip) return;
    if (el.newsStrip.scrollWidth <= el.newsStrip.clientWidth) return;
    const atEnd = Math.abs(el.newsStrip.scrollWidth - el.newsStrip.clientWidth - el.newsStrip.scrollLeft) < 4;
    if (atEnd) {
      el.newsStrip.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.newsStrip.scrollBy({ left: 240, behavior: "smooth" });
    }
  }, 6000);
}

/* ---------------------- Chart drawing & TA ---------------------- */
function drawPriceChart(canvas, series, indicators, settings) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = rect.width || 400;
  const height = rect.height || 260;
  canvas.width = width*dpr; canvas.height = height*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  setChartLayout(null);
  if (!series || !series.length) return;

  const chartType = settings.chartType || "line";
  const showBB = settings.indicators.bb;
  const showRSI = settings.indicators.rsi;
  const showMACD = settings.indicators.macd;

  const light = state.theme === "light";
  const palette = light ? {
    gridLine: "rgba(148,163,184,0.5)",
    axisText: "rgba(15,23,42,0.8)",
    bbFill: "rgba(59,130,246,0.12)",
    bbStroke: "rgba(59,130,246,0.55)",
    bbMid: "rgba(37,99,235,0.92)",
    gradLineStart: "rgba(37,99,235,0.95)",
    gradLineEnd: "rgba(16,185,129,0.9)",
    gradFillTop: "rgba(59,130,246,0.18)",
    gradFillBottom: "rgba(14,165,233,0.02)",
    candleUp: "rgba(34,197,94,0.92)",
    candleDown: "rgba(239,68,68,0.9)",
    trendline: "rgba(30,41,59,0.65)",
    fibLine: "rgba(15,23,42,0.22)",
    fibText: "rgba(51,65,85,0.95)",
    rsiBand: "rgba(226,232,240,0.9)",
    rsiStroke: "rgba(100,116,139,0.65)",
    macdHistPos: "rgba(34,197,94,0.75)",
    macdHistNeg: "rgba(239,68,68,0.75)",
    macdLine: "rgba(59,130,246,0.9)",
    macdSignal: "rgba(100,116,139,0.9)",
    indicatorLabel: "rgba(51,65,85,0.95)",
    indicatorSeparator: "rgba(59,130,246,0.32)"
  } : {
    gridLine: "rgba(94,234,212,0.22)",
    axisText: "rgba(226,232,240,0.7)",
    bbFill: "rgba(56,189,248,0.08)",
    bbStroke: "rgba(56,189,248,0.8)",
    bbMid: "rgba(96,165,250,0.7)",
    gradLineStart: "rgba(56,189,248,1)",
    gradLineEnd: "rgba(16,185,129,1)",
    gradFillTop: "rgba(45,212,191,0.20)",
    gradFillBottom: "rgba(15,23,42,0)",
    candleUp: "rgba(34,197,94,0.95)",
    candleDown: "rgba(248,113,113,0.95)",
    trendline: "rgba(248,250,252,0.85)",
    fibLine: "rgba(250,250,250,0.35)",
    fibText: "rgba(148,163,184,0.9)",
    rsiBand: "rgba(15,23,42,0.8)",
    rsiStroke: "rgba(148,163,184,0.6)",
    macdHistPos: "rgba(34,197,94,0.8)",
    macdHistNeg: "rgba(248,113,113,0.8)",
    macdLine: "rgba(56,189,248,0.9)",
    macdSignal: "rgba(148,163,184,0.9)",
    indicatorLabel: "rgba(148,163,184,0.9)",
    indicatorSeparator: "rgba(30,64,175,0.5)"
  };

  const hasIndicatorPanel = showRSI || showMACD;
  const paddingX = 28;
  const topPadding = 16;
  const bottomPadding = 12;
  const gap = hasIndicatorPanel ? 8 : 0;
  const totalInnerH = height - topPadding - bottomPadding;
  const mainRatio = hasIndicatorPanel ? 0.65 : 0.9;
  const mainH = totalInnerH * mainRatio;
  const indH = hasIndicatorPanel ? (totalInnerH - mainH - gap) : 0;
  const mainTop = topPadding;
  const mainBottom = mainTop + mainH;
  const indTop = hasIndicatorPanel ? mainBottom + gap : null;
  const indBottom = hasIndicatorPanel ? indTop + indH : null;
  const innerW = width - paddingX*2;

  const values = series.map(p=>p.value);
  let minP = Math.min(...values), maxP = Math.max(...values);
  if (indicators && indicators.bb && showBB) {
    const all = [];
    indicators.bb.upper.forEach(v=>{ if(v!=null) all.push(v); });
    indicators.bb.lower.forEach(v=>{ if(v!=null) all.push(v); });
    if (all.length) {
      minP = Math.min(minP, ...all);
      maxP = Math.max(maxP, ...all);
    }
  }
  const range = maxP-minP || 1;

  const ohlc = series.map((p,i)=>{
    const close=p.value;
    const prev=i>0?series[i-1].value:close;
    const open=prev;
    const mid=(open+close)/2;
    const bodyRange=Math.max(Math.abs(close-open), mid*0.002);
    return {open,high:mid+bodyRange*0.6,low:mid-bodyRange*0.6,close};
  });

  const points = series.map((p,i)=>{
    const x = paddingX + (i/Math.max(series.length-1,1))*innerW;
    const y = mainTop + (1-(p.value-minP)/range)*mainH;
    return {x,y,value:p.value};
  });

  ctx.strokeStyle = palette.gridLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([4,6]);
  ctx.beginPath();
  ctx.moveTo(paddingX, mainBottom);
  ctx.lineTo(width-paddingX, mainBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = palette.axisText;
  ctx.font = "10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText(formatCurrency(maxP), width-4, mainTop+4);
  ctx.fillText(formatCurrency(minP), width-4, mainBottom-4);

  if (indicators && indicators.bb && showBB) {
    const {upper,lower,middle} = indicators.bb;
    const upPts=[], loPts=[], midPts=[];
    upper.forEach((v,i)=>{
      if(v==null) return;
      const x = paddingX + (i/Math.max(series.length-1,1))*innerW;
      const y = mainTop + (1-(v-minP)/range)*mainH;
      upPts.push({x,y});
    });
    lower.forEach((v,i)=>{
      if(v==null) return;
      const x = paddingX + (i/Math.max(series.length-1,1))*innerW;
      const y = mainTop + (1-(v-minP)/range)*mainH;
      loPts.push({x,y});
    });
    middle.forEach((v,i)=>{
      if(v==null) return;
      const x = paddingX + (i/Math.max(series.length-1,1))*innerW;
      const y = mainTop + (1-(v-minP)/range)*mainH;
      midPts.push({x,y});
    });
    if (upPts.length && loPts.length) {
      ctx.beginPath();
      upPts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      for (let i=loPts.length-1;i>=0;i--) ctx.lineTo(loPts[i].x, loPts[i].y);
      ctx.closePath();
      ctx.fillStyle = palette.bbFill;
      ctx.fill();
    }
    ctx.lineWidth=1;
    if (upPts.length) {
      ctx.beginPath();
      upPts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.strokeStyle=palette.bbStroke;
      ctx.stroke();
    }
    if (loPts.length) {
      ctx.beginPath();
      loPts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.strokeStyle=palette.bbStroke;
      ctx.stroke();
    }
    if (midPts.length) {
      ctx.beginPath();
      midPts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.strokeStyle=palette.bbMid;
      ctx.setLineDash([3,3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (chartType === "line") {
    const gradLine = ctx.createLinearGradient(paddingX, mainTop, paddingX, mainBottom);
    gradLine.addColorStop(0, palette.gradLineStart);
    gradLine.addColorStop(1, palette.gradLineEnd);
    const gradFill = ctx.createLinearGradient(0, mainTop, 0, mainBottom);
    gradFill.addColorStop(0, palette.gradFillTop);
    gradFill.addColorStop(1, palette.gradFillBottom);
    ctx.beginPath();
    ctx.moveTo(points[0].x, mainBottom);
    points.forEach(p=>ctx.lineTo(p.x,p.y));
    ctx.lineTo(points[points.length-1].x, mainBottom);
    ctx.closePath();
    ctx.fillStyle = gradFill; ctx.fill();
    ctx.beginPath();
    points.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
    ctx.strokeStyle = gradLine;
    ctx.lineWidth=2; ctx.lineJoin="round"; ctx.lineCap="round"; ctx.stroke();
  } else {
    const barW = Math.min(14, innerW/Math.max(series.length,1)*0.7);
    const halfBar = barW/2;
    const wickWidth = Math.max(1, barW*0.3);
    ohlc.forEach((bar,i)=>{
      const x = paddingX + (i/Math.max(series.length-1,1))*innerW;
      const openY = mainTop + (1-(bar.open-minP)/range)*mainH;
      const closeY= mainTop + (1-(bar.close-minP)/range)*mainH;
      const highY = mainTop + (1-(bar.high-minP)/range)*mainH;
      const lowY  = mainTop + (1-(bar.low-minP)/range)*mainH;
      const isUp = bar.close >= bar.open;
      const color = isUp ? palette.candleUp : palette.candleDown;
      ctx.beginPath();
      ctx.moveTo(x, highY); ctx.lineTo(x, lowY);
      ctx.strokeStyle=color; ctx.lineWidth=wickWidth; ctx.stroke();
      if (chartType === "candles") {
        const topY = Math.min(openY, closeY);
        const h = Math.max(1, Math.abs(closeY-openY));
        ctx.beginPath();
        ctx.rect(x-halfBar, topY, barW, h);
        ctx.fillStyle=color; ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x-halfBar, openY); ctx.lineTo(x, openY);
        ctx.moveTo(x, closeY); ctx.lineTo(x+halfBar, closeY);
        ctx.strokeStyle=color; ctx.lineWidth=1; ctx.stroke();
      }
    });
  }

  const draw = settings.drawing || {};
  const trendlines = draw.trendlines || [];
  const fibs = draw.fibs || [];
  ctx.lineWidth=1;

  trendlines.forEach(line=>{
    if (!line.p1 || !line.p2) return;
    const x1 = paddingX + line.p1.xNorm*innerW;
    const y1 = mainTop + line.p1.yNorm*mainH;
    const x2 = paddingX + line.p2.xNorm*innerW;
    const y2 = mainTop + line.p2.yNorm*mainH;
    ctx.beginPath();
    ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
    ctx.strokeStyle=palette.trendline;
    ctx.setLineDash([4,2]); ctx.stroke(); ctx.setLineDash([]);
  });

  fibs.forEach(fib=>{
    if (!fib.top || !fib.bottom) return;
    const y1 = mainTop + fib.top.yNorm*mainH;
    const y2 = mainTop + fib.bottom.yNorm*mainH;
    const hi = Math.min(y1,y2), lo=Math.max(y1,y2);
    const levels=[0,0.236,0.382,0.5,0.618,0.786,1];
    ctx.font="9px system-ui,-apple-system,BlinkMacSystemFont,sans-serif";
    ctx.textAlign="left"; ctx.textBaseline="middle";
    levels.forEach(lvl=>{
      const y = hi + (lo-hi)*lvl;
      ctx.beginPath();
      ctx.moveTo(paddingX,y); ctx.lineTo(width-paddingX,y);
      ctx.strokeStyle=palette.fibLine;
      ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=palette.fibText;
      ctx.fillText((lvl*100).toFixed(1)+"%", paddingX+2, y-1);
    });
  });

  if (hasIndicatorPanel && indH>20 && indTop!=null) {
    const it = indTop, ib=indBottom, ih=indH;
    ctx.strokeStyle=palette.indicatorSeparator;
    ctx.lineWidth=1; ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.moveTo(paddingX,ib); ctx.lineTo(width-paddingX,ib); ctx.stroke(); ctx.setLineDash([]);

    if (showRSI && indicators && indicators.rsi) {
      const rsi = indicators.rsi;
      const pts=[];
      rsi.forEach((v,i)=>{
        if(v==null) return;
        const x = paddingX + (i/Math.max(series.length-1,1))*innerW;
        const y = it + (1-v/100)*ih;
        pts.push({x,y});
      });
      const y70 = it + (1-70/100)*ih;
      const y30 = it + (1-30/100)*ih;
      ctx.fillStyle=palette.rsiBand;
      ctx.fillRect(paddingX,y70,innerW,y30-y70);
      ctx.beginPath(); ctx.moveTo(paddingX,y70); ctx.lineTo(width-paddingX,y70);
      ctx.moveTo(paddingX,y30); ctx.lineTo(width-paddingX,y30);
      ctx.strokeStyle=palette.rsiStroke;
      ctx.setLineDash([2,3]); ctx.stroke(); ctx.setLineDash([]);
      if (pts.length) {
        ctx.beginPath();
        pts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
        ctx.strokeStyle="rgba(244,114,182,0.9)";
        ctx.lineWidth=1.3; ctx.stroke();
      }
    }

    if (showMACD && indicators && indicators.macd) {
      const {macd,signal,hist} = indicators.macd;
      const macdVals=[], histVals=[];
      macd.forEach(v=>{ if(v!=null) macdVals.push(v); });
      hist.forEach(v=>{ if(v!=null) histVals.push(v); });
      if (macdVals.length && histVals.length) {
        const minM = Math.min(...macdVals,...histVals);
        const maxM = Math.max(...macdVals,...histVals);
        const rangeM = maxM-minM || 1;
        for (let i=0;i<hist.length;i++) {
          const v = hist[i]; if(v==null) continue;
          const x = paddingX + (i/Math.max(series.length-1,1))*innerW;
          const y0 = it + (1-(-minM/rangeM))*ih;
          const yv = it + (1-(v-minM)/rangeM)*ih;
          ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,yv);
          ctx.strokeStyle = v>=0 ? palette.macdHistPos : palette.macdHistNeg;
          ctx.lineWidth=2; ctx.stroke();
        }
        const macdPts=[], sigPts=[];
        macd.forEach((v,i)=>{
          if(v==null) return;
          const x = paddingX + (i/Math.max(series.length-1,1))*innerW;
          const y = it + (1-(v-minM)/rangeM)*ih;
          macdPts.push({x,y});
        });
        signal.forEach((v,i)=>{
          if(v==null) return;
          const x = paddingX + (i/Math.max(series.length-1,1))*innerW;
          const y = it + (1-(v-minM)/rangeM)*ih;
          sigPts.push({x,y});
        });
        if (macdPts.length) {
          ctx.beginPath();
          macdPts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
          ctx.strokeStyle=palette.macdLine;
          ctx.lineWidth=1.4; ctx.stroke();
        }
        if (sigPts.length) {
          ctx.beginPath();
          sigPts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
          ctx.strokeStyle=palette.macdSignal;
          ctx.lineWidth=1; ctx.stroke();
        }
      }
    }
    ctx.fillStyle=palette.indicatorLabel;
    ctx.font="9px system-ui,-apple-system,BlinkMacSystemFont,sans-serif";
    ctx.textAlign="left"; ctx.textBaseline="top";
    const tags=[];
    if (showRSI) tags.push("RSI(14)");
    if (showMACD) tags.push("MACD(12,26,9)");
    ctx.fillText(tags.join(" · "), paddingX, indTop+2);
  }

  setChartLayout({
    width, height,
    paddingX,
    mainTop, mainHeight: mainH, mainBottom,
    innerWidth: innerW
  });
}

function computeIndexReturnsFromDaily(closes) {
  if (!closes || closes.length < 30) return { month: NaN, quarter: NaN, year: NaN };
  const lastIdx = closes.length - 1;
  const idx1M = Math.max(0, lastIdx - 22);
  const idx3M = Math.max(0, lastIdx - 66);
  const idx1Y = Math.max(0, lastIdx - 252);
  const last  = closes[lastIdx];
  const p1M   = closes[idx1M];
  const p3M   = closes[idx3M];
  const p1Y   = closes[idx1Y];
  function ret(past) { if (!past || !last) return NaN; return last / past - 1; }
  return { month: ret(p1M), quarter: ret(p3M), year: ret(p1Y) };
}

async function fetchIndexDailyAlphaVantage(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Alpha Vantage error ${res.status}`);
  const json = await res.json();
  const series = json["Time Series (Daily)"];
  if (!series) throw new Error("Unexpected Alpha Vantage payload");
  const dates = Object.keys(series).map(d => new Date(d)).sort((a, b) => a - b);
  return dates.map(d => {
    const key = d.toISOString().slice(0, 10);
    return parseFloat(series[key]["4. close"]);
  }).filter(v => isFinite(v));
}

export async function fetchBenchmarks() {
  // Cached logic to prevent 429s
  const cached = loadJson(STORAGE_KEYS.benchmarks, null);
  const now = Date.now();
  if (cached && (now - cached.timestamp < 12 * 60 * 60 * 1000)) {
    BENCHMARK_RETURNS.month = cached.month;
    BENCHMARK_RETURNS.quarter = cached.quarter;
    BENCHMARK_RETURNS.year = cached.year;
    BENCHMARK_RETURNS.hasLive = true;
    const data = state.lastPortfolioData || calculatePortfolio(state.portfolio, state.priceData);
    renderBenchmarksAndScenario(data);
    return;
  }

  const API_KEY = "14FXYP264JB2XC5F"; 
  try {
    const spyCloses = await fetchIndexDailyAlphaVantage("SPY", API_KEY);
    await new Promise(r => setTimeout(r, 1500)); // Rate limit niceness
    const qqqCloses = await fetchIndexDailyAlphaVantage("QQQ", API_KEY);

    const spRet  = computeIndexReturnsFromDaily(spyCloses);
    const ndqRet = computeIndexReturnsFromDaily(qqqCloses);

    const newData = {
        timestamp: now,
        month: { sp: spRet.month, nasdaq: ndqRet.month },
        quarter: { sp: spRet.quarter, nasdaq: ndqRet.quarter },
        year: { sp: spRet.year, nasdaq: ndqRet.year }
    };

    if (!isNaN(spRet.month)) {
      BENCHMARK_RETURNS.month = newData.month;
      BENCHMARK_RETURNS.quarter = newData.quarter;
      BENCHMARK_RETURNS.year = newData.year;
      BENCHMARK_RETURNS.hasLive = true;
      saveJson(STORAGE_KEYS.benchmarks, newData);
      
      const data = state.lastPortfolioData || calculatePortfolio(state.portfolio, state.priceData);
      renderBenchmarksAndScenario(data);
    }
  } catch (err) {
    console.warn("Benchmarks unavailable (rate limit or network), using defaults.");
    // Silent fallback
  }
}

/* ---------------------- Rendering helpers ---------------------- */
export function renderSummary(data) {
  if (!data || !data.totals) return;
  const { totals, best, worst } = data;
  const updateSpark = (node, change) => {
    if (!node) return;
    const tilt = clamp(change || 0, -25, 25);
    node.style.setProperty("--spark-tilt", `${tilt}deg`);
    node.classList.toggle("negative", change < 0);
  };
  el.totalValue.textContent = formatCurrency(totals.totalValue);
  el.totalCost.textContent = formatCurrency(totals.totalCost);
  el.totalPnl.textContent = formatCurrency(totals.totalPnlAbs);
  el.totalPnlPct.textContent = Number.isFinite(totals.totalPnlPct)
    ? formatPercent(totals.totalPnlPct)
    : "--";
  updateTrendClass(el.totalPnl, totals.totalPnlAbs);
  updateTrendClass(el.totalPnlPct, totals.totalPnlPct);
  el.assetsCount.textContent = data.holdings.length;
  el.dayPnl.textContent = formatCurrency(totals.dayChangeAbs);
  el.dayPnlPct.textContent = formatPercent(totals.dayChangePct);
  updateTrendClass(el.dayPnl, totals.dayChangeAbs);
  updateTrendClass(el.dayPnlPct, totals.dayChangePct);
  updateSpark(el.daySpark, totals.dayChangePct);
  el.bestName.textContent = best ? `${best.symbol} · ${best.name}` : "--";
  el.bestChange.textContent = best ? formatPercent(best.change24hPct) : "--";
  el.worstName.textContent = worst ? `${worst.symbol} · ${worst.name}` : "--";
  el.worstChange.textContent = worst ? formatPercent(worst.change24hPct) : "--";
  updateTrendClass(el.bestChange, best ? best.change24hPct : 0);
  updateTrendClass(el.worstChange, worst ? worst.change24hPct : 0);
  updateSpark(el.bestSpark, best ? best.change24hPct : 0);
  updateSpark(el.worstSpark, worst ? worst.change24hPct : 0);
}

export function renderHoldings(data) {
  const holdings = data.holdings || [];
  el.holdingsBody.innerHTML = "";
  if (el.holdingsCards) el.holdingsCards.innerHTML = "";
  if (!holdings.length) {
    el.noHoldings.classList.remove("hidden");
    return;
  }
  el.noHoldings.classList.add("hidden");
  holdings.forEach(h => {
    const alloc = clamp((h.allocationPct || 0) / 100, 0, 1) * 100;
    const allocColor = h.pnlAbs >= 0 ? "#34d399" : "#fb7185";
    const tr = document.createElement("tr");
    tr.className = "bg-slate-900/40 hover:bg-slate-900/80 transition rounded-xl";
    tr.innerHTML = `
      <td class="px-3 py-2">
        <div class="flex flex-col">
          <span class="font-semibold">${escapeHtml(h.symbol)}</span>
          <span class="text-[11px] text-slate-400">${escapeHtml(h.name)}</span>
        </div>
      </td>
      <td class="px-3 py-2 text-right font-mono">${h.amount.toFixed(6).replace(/\.0+$/, "")}</td>
      <td class="px-3 py-2 text-right font-mono">${formatCurrency(h.price)}</td>
      <td class="px-3 py-2 text-right font-mono">${formatCurrency(h.value)}</td>
      <td class="px-3 py-2 text-right font-mono ${h.pnlAbs>=0?"text-emerald-400":"text-rose-400"}">${formatCurrency(h.pnlAbs)}<br><span class="text-[11px] text-slate-400">${formatPercent(h.pnlPct)}</span></td>
      <td class="px-3 py-2 text-right">
        <div class="flex items-center justify-end gap-2">
          <div class="alloc-pie" style="--alloc:${alloc}; --alloc-color:${allocColor};"></div>
          <span class="font-mono text-xs sm:text-sm">${formatPercent(h.allocationPct)}</span>
        </div>
      </td>
      <td class="px-3 py-2 text-right">
        <div class="inline-flex gap-1">
          <button data-action="edit" data-id="${escapeHtml(h.id)}" class="px-2 py-1 text-[11px] rounded-full border border-slate-700 text-slate-200 hover:border-emerald-400">Edit</button>
          <button data-action="delete" data-id="${escapeHtml(h.id)}" class="px-2 py-1 text-[11px] rounded-full border border-slate-700 text-slate-300 hover:border-rose-400">Remove</button>
        </div>
      </td>`;
    el.holdingsBody.appendChild(tr);

    if (el.holdingsCards) {
      const card = document.createElement("div");
      card.className = "rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-sm shadow-emerald-500/5";
      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-sm font-semibold">${escapeHtml(h.symbol)}</p>
            <p class="text-[11px] text-slate-400">${escapeHtml(h.name)}</p>
          </div>
          <div class="text-right">
            <p class="font-mono text-xs text-slate-300">${formatCurrency(h.price)}</p>
            <p class="text-[11px] text-slate-500">Live price</p>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
          <div class="rounded-lg bg-slate-950/60 border border-slate-800/70 p-2">
            <p class="uppercase tracking-[0.18em] text-[9px] text-slate-500 mb-0.5">Amount</p>
            <p class="font-mono">${h.amount.toFixed(6).replace(/\.0+$/, "")}</p>
          </div>
          <div class="rounded-lg bg-slate-950/60 border border-slate-800/70 p-2 text-right">
            <p class="uppercase tracking-[0.18em] text-[9px] text-slate-500 mb-0.5">Value</p>
            <p class="font-mono">${formatCurrency(h.value)}</p>
          </div>
          <div class="rounded-lg bg-slate-950/60 border border-slate-800/70 p-2">
            <p class="uppercase tracking-[0.18em] text-[9px] text-slate-500 mb-0.5">P/L</p>
            <p class="font-mono ${h.pnlAbs>=0?"text-emerald-400":"text-rose-400"}">${formatCurrency(h.pnlAbs)}</p>
            <p class="font-mono text-[10px] text-slate-400">${formatPercent(h.pnlPct)}</p>
          </div>
          <div class="rounded-lg bg-slate-950/60 border border-slate-800/70 p-2 text-right">
            <p class="uppercase tracking-[0.18em] text-[9px] text-slate-500 mb-0.5">Alloc</p>
            <div class="flex items-center justify-end gap-2">
              <div class="alloc-pie" style="--alloc:${alloc}; --alloc-color:${allocColor};"></div>
              <p class="font-mono">${formatPercent(h.allocationPct)}</p>
            </div>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between text-[11px]">
          <button data-action="edit" data-id="${escapeHtml(h.id)}" class="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-emerald-400">Edit</button>
          <button data-action="delete" data-id="${escapeHtml(h.id)}" class="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-rose-400">Remove</button>
        </div>`;
      el.holdingsCards.appendChild(card);
    }
  });
}

export function renderAllocationMini(data) {
  const holdings = data.holdings || [];
  el.allocationList.innerHTML = "";
  if (!holdings.length) {
    el.allocationEmpty.classList.remove("hidden");
    return;
  }
  el.allocationEmpty.classList.add("hidden");
  holdings.forEach(h => {
    const row = document.createElement("div");
    row.innerHTML = `
      <div class="flex items-center justify-between text-xs">
        <span class="font-semibold">${escapeHtml(h.symbol)}</span>
        <span class="font-mono text-slate-300">${formatPercent(h.allocationPct)}</span>
      </div>
      <div class="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div class="h-full rounded-full ${h.pnlAbs>=0?"bg-emerald-400":"bg-rose-400"}" style="width:${Math.min(100,h.allocationPct)}%"></div>
      </div>`;
    el.allocationList.appendChild(row);
  });
}

export function renderWallets() {
  el.walletList.innerHTML = "";
  if (!state.wallets.length) {
    el.walletEmpty.classList.remove("hidden");
    return;
  }
  el.walletEmpty.classList.add("hidden");
  state.wallets.forEach(w => {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 flex flex-col gap-2";
    const explorer = getExplorerUrl(w.chain || "ethereum", w.address);
    const chainLabel = describeChain(w.chain || "ethereum");
    li.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="font-semibold">${escapeHtml(w.label || shortenAddress(w.address))}</p>
          <p class="text-[11px] text-slate-500">${escapeHtml(shortenAddress(w.address))} · ${escapeHtml(chainLabel)}</p>
        </div>
        <button data-id="${escapeHtml(w.id)}" class="wallet-remove text-[11px] text-slate-400 hover:text-rose-400">Remove</button>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-400">
        <span>Added ${humanizeTimeAgo(w.addedAt)}</span>
        <a href="${explorer}" target="_blank" rel="noopener" class="text-emerald-300 hover:text-emerald-200">View explorer →</a>
      </div>`;
    el.walletList.appendChild(li);
  });
}

export function renderWatchlist() {
  el.watchlistList.innerHTML = "";
  if (!state.watchlist.length) {
    el.watchlistEmpty.classList.remove("hidden");
    return;
  }
  el.watchlistEmpty.classList.add("hidden");
  state.watchlist.forEach(id => {
    const meta = findCoinMeta(id) || { symbol: id.toUpperCase(), name: id };
    const price = getDisplayPrice(id);
    const change = getDisplayChange(id);
    const changeClass = Number.isFinite(change)
      ? (change >= 0 ? "text-emerald-400" : "text-rose-400")
      : "text-slate-400";
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 flex items-center justify-between gap-3";
    li.innerHTML = `
      <div>
        <p class="font-semibold">${escapeHtml(meta.symbol)}</p>
        <p class="text-[11px] text-slate-500">${escapeHtml(meta.name)}</p>
      </div>
      <div class="text-right">
        <p class="font-mono">${price!=null?formatCurrency(price):"--"}</p>
        <p class="text-[11px] ${changeClass}">${change!=null?formatPercent(change):"--"}</p>
      </div>
      <button data-id="${escapeHtml(id)}" class="watchlist-remove text-[11px] text-slate-400 hover:text-rose-400">Remove</button>`;
    el.watchlistList.appendChild(li);
  });
}

export function renderChartSection(data) {
  const totals = data?.totals || {};
  const series = totals.totalValue ? ensureChartSeries(state.timeframe, totals.totalValue) : [];
  const indicators = computeIndicators(series);
  if (!series.length) {
    if (el.chartEmpty) el.chartEmpty.classList.remove("hidden");
    if (el.chartCanvas) {
      const ctx = el.chartCanvas.getContext("2d");
      ctx && ctx.clearRect(0,0,el.chartCanvas.width, el.chartCanvas.height);
    }
  } else {
    el.chartEmpty.classList.add("hidden");
    drawPriceChart(el.chartCanvas, series, indicators, state.chartSettings);
  }
  document.querySelectorAll(".timeframe-btn").forEach(btn => {
    if (btn.dataset.timeframe === state.timeframe) {
      btn.classList.add("pill-active","text-slate-100");
    } else {
      btn.classList.remove("pill-active","text-slate-100");
      btn.classList.add("text-slate-400");
    }
  });
  document.querySelectorAll(".chart-type-btn").forEach(btn => {
    if (btn.dataset.chartType === state.chartSettings.chartType) {
      btn.classList.add("pill-active","text-slate-100");
    } else {
      btn.classList.remove("pill-active","text-slate-100");
      btn.classList.add("text-slate-400");
    }
  });
}

export function renderRiskMetrics(data) {
  const totals = data?.totals || {};
  const baseSeries = totals.totalValue ? ensureChartSeries("30d", totals.totalValue) : [];
  const metrics = computeSeriesMetrics(baseSeries);
  el.metricAnnualized.textContent = isFinite(metrics.annualizedReturn) ? formatPercent(metrics.annualizedReturn*100) : "--";
  el.metricVolatility.textContent = isFinite(metrics.volatility) ? formatPercent(metrics.volatility*100) : "--";
  el.metricSharpe.textContent = isFinite(metrics.sharpe) ? metrics.sharpe.toFixed(2) : "--";
  el.metricMaxDD.textContent = isFinite(metrics.maxDrawdown) ? formatPercent(metrics.maxDrawdown*100) : "--";
  updateTrendClass(el.metricSharpe, metrics.sharpe);

  const dailyVol = isFinite(metrics.volatility) ? metrics.volatility / Math.sqrt(252) : 0;
  const oneDayVar = totals.totalValue * dailyVol * 1.65;
  const fiveDayVar = totals.totalValue * dailyVol * Math.sqrt(5) * 1.65;
  el.metricVaR1d.textContent = totals.totalValue ? `-${formatCurrency(Math.abs(oneDayVar))}` : "--";
  el.metricVaR1dPct.textContent = totals.totalValue ? `-${formatPercent(dailyVol*1.65*100)}` : "--";
  el.metricVaR5d.textContent = totals.totalValue ? `-${formatCurrency(Math.abs(fiveDayVar))}` : "--";

  updateStressSummary(data, parseFloat(el.riskStressSelect.value || "-0.25"));

  if (data.holdings.length < 2) {
    el.riskCorrGrid.innerHTML = '<p class="text-[10px] text-slate-500">Add at least two assets to see simulated correlations.</p>';
    return;
  }
  const top = data.holdings.slice(0,4);
  const header = ['<div class="grid" style="grid-template-columns: repeat('+(top.length+1)+', minmax(0,1fr)); gap:4px; font-size:10px;">'];
  header.push('<div></div>');
  top.forEach(h => header.push(`<div class="text-center text-slate-400">${h.symbol}</div>`));
  top.forEach(a => {
    header.push(`<div class="text-slate-400">${a.symbol}</div>`);
    top.forEach(b => {
      const val = a.id === b.id ? 1 : pseudoCorrelation(a.id, b.id);
      const pct = formatPercent(val*100);
      header.push(`<div class="text-center font-mono ${val>=0?"text-emerald-300":"text-rose-300"}">${pct}</div>`);
    });
  });
  header.push('</div>');
  el.riskCorrGrid.innerHTML = header.join("");
}

export function renderBenchmarksAndScenario(data) {
  const totals = data?.totals || {};
  const monthSeries = totals.totalValue ? ensureChartSeries("30d", totals.totalValue) : [];
  let monthRet = 0;
  if (monthSeries.length >= 2) {
    const first = monthSeries[0].value;
    const last = monthSeries[monthSeries.length-1].value;
    if (first > 0) monthRet = (last - first) / first;
  }
  const quarterRet = monthRet * 3;
  const yearRet = monthRet * 12;
  el.perfMonthPortfolio.textContent = totals.totalValue ? formatPercent(monthRet*100) : "--";
  el.perfQuarterPortfolio.textContent = totals.totalValue ? formatPercent(quarterRet*100) : "--";
  el.perfYearPortfolio.textContent = totals.totalValue ? formatPercent(yearRet*100) : "--";

  el.perfMonthSP.textContent = formatPercent(BENCHMARK_RETURNS.month.sp*100);
  el.perfQuarterSP.textContent = formatPercent(BENCHMARK_RETURNS.quarter.sp*100);
  el.perfYearSP.textContent = formatPercent(BENCHMARK_RETURNS.year.sp*100);
  el.perfMonthNasdaq.textContent = formatPercent(BENCHMARK_RETURNS.month.nasdaq*100);
  el.perfQuarterNasdaq.textContent = formatPercent(BENCHMARK_RETURNS.quarter.nasdaq*100);
  el.perfYearNasdaq.textContent = formatPercent(BENCHMARK_RETURNS.year.nasdaq*100);
  if (!BENCHMARK_RETURNS.hasLive) {
    el.perfMonthSP.classList.add("text-slate-400");
    el.perfMonthNasdaq.classList.add("text-slate-400");
  }
}

export function renderAlerts() {
  el.alertsList.innerHTML = "";
  if (!state.alerts.length) {
    el.alertsEmpty.classList.remove("hidden");
    return;
  }
  el.alertsEmpty.classList.add("hidden");
  state.alerts.forEach(alert => {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 flex items-center justify-between gap-3";
    li.innerHTML = `
      <div>
        <p class="font-semibold text-sm">${escapeHtml(alert.symbol || alert.coinId)}</p>
        <p class="text-[11px] text-slate-500">${alert.direction === "above" ? "≥" : "≤"} ${formatCurrency(alert.target)}</p>
      </div>
      <div class="flex items-center gap-2">
        <button data-action="toggle" data-id="${escapeHtml(alert.id)}" class="text-[11px] ${alert.active?"text-emerald-400":"text-slate-500"}">${alert.active?"Active":"Paused"}</button>
        <button data-action="delete" data-id="${escapeHtml(alert.id)}" class="text-[11px] text-slate-400 hover:text-rose-400">Remove</button>
      </div>`;
    el.alertsList.appendChild(li);
  });
}

export function renderNews(isFallback = false) {
  const news = state.news || [];
  const filter = state.newsFilter;
  if (!news.length) {
    el.newsEmpty.textContent = isFallback ? "News unavailable right now." : "Loading news…";
    el.newsEmpty.classList.remove("hidden");
    return;
  }
  const filtered = filter === "all" ? news : news.filter(item => item.coins.some(c => c === filter || c === filter.toUpperCase()));
  el.newsStrip.innerHTML = "";
  if (!filtered.length) {
    el.newsEmpty.textContent = "No stories for that filter.";
    el.newsEmpty.classList.remove("hidden");
    return;
  }
  el.newsEmpty.classList.add("hidden");
  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = "min-w-[240px] snap-start rounded-2xl border border-slate-800 bg-slate-900/40 p-3 flex flex-col gap-2";
    const safeSource = escapeHtml(item.source || "");
    const safeTitle = escapeHtml(item.title || "");
    const safeSummary = escapeHtml(item.summary || "");
    const safeUrl = escapeHtml(item.url || "#");
    const tags = (item.coins || []).slice(0, 3)
      .map(tag => `<span class="px-1.5 py-0.5 rounded-full bg-slate-800/70">${escapeHtml(tag)}</span>`)
      .join("");
    card.innerHTML = `
      <div class="flex items-center justify-between text-[10px] text-slate-500">
        <span>${safeSource}</span>
        <span>${humanizeTimeAgo(item.publishedAt)}</span>
      </div>
      <a href="${safeUrl}" target="_blank" rel="noopener" class="text-sm font-semibold text-slate-100 line-clamp-3 hover:text-emerald-300">${safeTitle}</a>
      <p class="text-[11px] text-slate-500 line-clamp-2">${safeSummary}</p>
      <div class="flex flex-wrap gap-1 text-[10px] text-slate-400">${tags}</div>`;
    el.newsStrip.appendChild(card);
  });
  startNewsAutoScroll();
}

export function updateStressSummary(data, shock) {
  if (!data || !data.totals || !data.totals.totalValue) {
    el.riskStressSummary.textContent = "Add holdings to see crash impact.";
    return;
  }
  const base = data.totals.totalValue;
  const future = base * (1 + shock);
  const delta = future - base;
  el.riskStressLabel.textContent = formatPercent(shock*100);
  el.riskStressSummary.textContent = `${formatCurrency(future)} (${delta>=0?"+":""}${formatCurrency(delta).replace("$","$")})`;
  updateTrendClass(el.riskStressSummary, delta);
}

export function checkAlerts() {
  if (!state.alerts.length) return;
  let triggered = false;
  state.alerts.forEach(alert => {
    if (!alert.active) return;
    const price = getDisplayPrice(alert.coinId);
    if (price == null) return;
    if (alert.direction === "above" && price >= alert.target) {
      triggered = true;
      alert.lastTriggered = Date.now();
      if (!alert.repeat) alert.active = false;
      showToast(`${alert.symbol} hit ≥ ${formatCurrency(alert.target)}`, "success");
      playAlertTone();
    }
    if (alert.direction === "below" && price <= alert.target) {
      triggered = true;
      alert.lastTriggered = Date.now();
      if (!alert.repeat) alert.active = false;
      showToast(`${alert.symbol} hit ≤ ${formatCurrency(alert.target)}`, "warn");
      playAlertTone();
    }
  });
  if (triggered) {
    persistAlerts();
    renderAlerts();
  }
}

export function showToast(message, type = "info") {
  if (!el.toastContainer) return;
  const toast = document.createElement("div");
  const colors = {
    success: "text-emerald-100 shadow-emerald-500/20",
    error: "text-rose-100 shadow-rose-500/20",
    warn: "text-amber-100 shadow-amber-500/20",
    info: "text-slate-100 shadow-slate-500/20"
  };
  toast.className = `toast-modern text-sm shadow-lg pl-3 pr-2 ${colors[type] || colors.info}`;
  toast.innerHTML = `<span class="mr-2">${type === "success" ? "✅" : type === "error" ? "⚠️" : type === "warn" ? "⚡" : "ℹ️"}</span>${message}`;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2", "transition-all");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ---------------------- All-in render ---------------------- */
export function renderAll() {
  const data = state.lastPortfolioData || calculatePortfolio(state.portfolio, state.priceData);
  state.lastPortfolioData = data;
  if (data.totals.totalValue) {
     ensureChartSeries("30d", data.totals.totalValue);
  }
  renderSummary(data);
  renderHoldings(data);
  renderAllocationMini(data);
  renderWallets();
  renderWatchlist();
  renderChartSection(data);
  renderRiskMetrics(data);
  renderBenchmarksAndScenario(data);
  renderAlerts();
}
