import { state } from "./state.js";
import { seededRandom } from "./utils.js";

/* ---------------------- Portfolio calculations ---------------------- */
export function calculatePortfolio(portfolio, priceData) {
  const cur = state.currency || "usd";
  const rate = state.fxRates[cur] || 1; // Convert USD -> Target
  
  let totalValue = 0;
  let totalCost = 0;
  let dayChangeAbs = 0;
  let hasMissingCost = false;

  const detailed = portfolio.map(h => {
    const info = priceData[h.id] || {};
    const hasPrice = typeof info.usd === "number";
    const priceUsd = hasPrice ? info.usd : (h.buyPrice || 0);
    const changePct = typeof info.usd_24h_change === "number" ? info.usd_24h_change : 0;
    
    const price = priceUsd * rate;
    const buyPriceVal = (h.buyPrice || 0) * rate;

    const amount = Number(h.amount) || 0;
    const value = amount * price;
    const costPer = buyPriceVal > 0 ? buyPriceVal : 0;
    const cost = costPer > 0 ? amount * costPer : NaN;
    const pnlAbs = isFinite(cost) ? value - cost : NaN;
    const pnlPct = isFinite(cost) && cost !== 0 ? pnlAbs / cost * 100 : NaN;
    if (!isFinite(cost)) hasMissingCost = true;

    totalValue += value;
    if (isFinite(cost)) totalCost += cost;
    dayChangeAbs += value * (changePct / 100);

    return { ...h, amount, price, value, cost, pnlAbs, pnlPct, change24hPct: changePct };
  });

  const dayChangePct = totalValue ? dayChangeAbs / totalValue * 100 : NaN;
  const totalCostDisplay = hasMissingCost ? NaN : totalCost;
  const totalPnlAbs = hasMissingCost ? NaN : (totalValue - totalCost);
  const totalPnlPct = hasMissingCost || !totalCost ? NaN : totalPnlAbs / totalCost * 100;

  if (totalValue > 0) {
    detailed.forEach(h => { h.allocationPct = h.value / totalValue * 100; });
  } else {
    detailed.forEach(h => { h.allocationPct = 0; });
  }

  let best = null, worst = null;
  const movers = detailed.filter(h => h.value > 10 * rate && isFinite(h.change24hPct));
  if (movers.length) {
    movers.sort((a,b) => b.change24hPct - a.change24hPct);
    best = movers[0];
    worst = movers[movers.length - 1];
  }

  detailed.sort((a,b) => b.value - a.value);

  return {
    totals: { totalValue, totalCost: totalCostDisplay, totalPnlAbs, totalPnlPct, dayChangeAbs, dayChangePct },
    holdings: detailed,
    best, worst
  };
}

/* ---------------------- Synthetic curve & indicators ---------------------- */
export function generateSyntheticSeries(baseValue, points, timeframe) {
  if (!baseValue || !isFinite(baseValue)) return [];
  const series = [];
  const base = Math.max(baseValue, 1);
  let vol;
  if (timeframe === "24h") vol = 0.012;
  else if (timeframe === "7d") vol = 0.035;
  else vol = 0.06;
  let v = base * (1 - vol * 0.8);

  // Seed based on baseValue so it doesn't jitter on refresh
  let seed = Math.floor(baseValue);

  for (let i=0;i<points;i++) {
    const drift = base * 0.0004;
    // Seeded random
    const noise = (seededRandom(seed + i) - 0.5) * 2 * vol * base;
    v = Math.max(base*0.4, v + drift + noise);
    const t = i / Math.max(points-1,1);
    series.push({ t, value: v });
  }
  if (series.length) series[series.length-1].value = base;
  return series;
}
export function ensureChartSeries(timeframe, baseValue) {
  const points = timeframe === "24h" ? 60 : timeframe === "7d" ? 80 : 100;
  const existing = state.chartSeries[timeframe];
  if (!baseValue || !isFinite(baseValue)) {
    state.chartSeries[timeframe] = null;
    return [];
  }
  if (!existing || !existing.length) {
    const s = generateSyntheticSeries(baseValue, points, timeframe);
    state.chartSeries[timeframe] = s;
    return s;
  }
  const last = existing[existing.length-1];
  const lastV = last && isFinite(last.value) ? last.value : baseValue;
  const factor = lastV ? baseValue / lastV : 1;
  const scaled = existing.map(p => ({ t: p.t, value: p.value * factor }));
  state.chartSeries[timeframe] = scaled;
  return scaled;
}
export function computeIndicators(series) {
  const closes = series.map(p => p.value);
  const n = closes.length;
  const result = { bb: null, rsi: null, macd: null };
  if (n < 5) return result;

  const bbPeriod = 20, k = 2;
  const upper = Array(n).fill(null);
  const lower = Array(n).fill(null);
  const middle = Array(n).fill(null);
  if (n >= bbPeriod) {
    for (let i=bbPeriod-1;i<n;i++) {
      let sum = 0;
      for (let j=i-bbPeriod+1;j<=i;j++) sum += closes[j];
      const ma = sum / bbPeriod;
      let varSum = 0;
      for (let j=i-bbPeriod+1;j<=i;j++) {
        const d = closes[j] - ma;
        varSum += d*d;
      }
      const std = Math.sqrt(varSum / bbPeriod);
      middle[i] = ma;
      upper[i] = ma + k*std;
      lower[i] = ma - k*std;
    }
  }
  result.bb = { upper, lower, middle };

  const rsiPeriod = 14;
  const rsi = Array(n).fill(null);
  if (n > rsiPeriod) {
    let gains=0, losses=0;
    for (let i=1;i<=rsiPeriod;i++) {
      const diff = closes[i]-closes[i-1];
      if (diff>=0) gains+=diff; else losses-=diff;
    }
    let avgGain = gains/rsiPeriod;
    let avgLoss = losses/rsiPeriod;
    rsi[rsiPeriod] = avgLoss===0?100:100-100/(1+avgGain/avgLoss);
    for (let i=rsiPeriod+1;i<n;i++) {
      const diff = closes[i]-closes[i-1];
      const gain = diff>0?diff:0;
      const loss = diff<0?-diff:0;
      avgGain = (avgGain*(rsiPeriod-1)+gain)/rsiPeriod;
      avgLoss = (avgLoss*(rsiPeriod-1)+loss)/rsiPeriod;
      if (!avgLoss) rsi[i]=100;
      else {
        const rs = avgGain/avgLoss;
        rsi[i] = 100-100/(1+rs);
      }
    }
  }
  result.rsi = rsi;

  const fast=12, slow=26, signal=9;
  if (n > slow+signal) {
    const emaFast = Array(n).fill(null);
    const emaSlow = Array(n).fill(null);
    const kFast = 2/(fast+1);
    const kSlow = 2/(slow+1);

    let sumFast=0;
    for (let i=0;i<fast;i++) sumFast+=closes[i];
    emaFast[fast-1]=sumFast/fast;
    for (let i=fast;i<n;i++) emaFast[i]=closes[i]*kFast+emaFast[i-1]*(1-kFast);

    let sumSlow=0;
    for (let i=0;i<slow;i++) sumSlow+=closes[i];
    emaSlow[slow-1]=sumSlow/slow;
    for (let i=slow;i<n;i++) emaSlow[i]=closes[i]*kSlow+emaSlow[i-1]*(1-kSlow);

    const macd = Array(n).fill(null);
    for (let i=0;i<n;i++) {
      if (emaFast[i]!=null && emaSlow[i]!=null) macd[i]=emaFast[i]-emaSlow[i];
    }

    const signalArr = Array(n).fill(null);
    const kSig = 2/(signal+1);
    const firstIdx = macd.findIndex(v => v!=null);
    if (firstIdx>=0 && n-firstIdx>=signal) {
      let sumSig=0;
      for (let i=firstIdx;i<firstIdx+signal;i++) sumSig+=macd[i];
      signalArr[firstIdx+signal-1]=sumSig/signal;
      for (let i=firstIdx+signal;i<n;i++) {
        signalArr[i]=macd[i]*kSig+signalArr[i-1]*(1-kSig);
      }
    }
    const hist = Array(n).fill(null);
    for (let i=0;i<n;i++) if (macd[i]!=null && signalArr[i]!=null) hist[i]=macd[i]-signalArr[i];

    result.macd = { macd, signal: signalArr, hist };
  }
  return result;
}
export function computeSeriesMetrics(series) {
  if (!Array.isArray(series) || series.length<2) {
    return { annualizedReturn:NaN, volatility:NaN, sharpe:NaN, maxDrawdown:NaN };
  }
  const values = series.map(p=>p.value);
  const first = values[0], last = values[values.length-1];
  if (!first || !last) return { annualizedReturn:NaN, volatility:NaN, sharpe:NaN, maxDrawdown:NaN };

  const returns = [];
  for (let i=1;i<values.length;i++) {
    const prev = values[i-1], curr = values[i];
    if (prev>0 && curr>0) returns.push((curr-prev)/prev);
  }
  if (!returns.length)
    return { annualizedReturn:NaN, volatility:NaN, sharpe:NaN, maxDrawdown:NaN };

  const avg = returns.reduce((a,b)=>a+b,0)/returns.length;
  const variance = returns.reduce((s,r)=>s+(r-avg)*(r-avg),0)/returns.length;
  const volDaily = Math.sqrt(Math.max(variance,0));
  const days = 252;
  const annualizedReturn = Math.pow(1+avg, days)-1;
  const annualizedVol = volDaily*Math.sqrt(days);
  const sharpe = annualizedVol>0 ? annualizedReturn/annualizedVol : NaN;

  let peak = values[0], maxDD=0;
  for (let i=1;i<values.length;i++) {
    const v=values[i];
    if (v>peak) peak=v;
    const dd=(v-peak)/peak;
    if (dd<maxDD) maxDD=dd;
  }
  return { annualizedReturn, volatility:annualizedVol, sharpe, maxDrawdown:maxDD };
}
