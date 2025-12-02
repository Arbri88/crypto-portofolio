import axios from 'axios';
import crypto from 'crypto';
import NodeCache from 'node-cache';

// Cache for 5 minutes (300 seconds) to avoid Rate Limits
const dataCache = new NodeCache({ stdTTL: 300 });

const DEFAULT_NEWS_FEED_URL =
  'https://api.rss2json.com/v1/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/';

const FALLBACK_NEWS = [
  {
    id: 'fallback-1',
    title: 'Crypto markets hold steady despite macro headwinds',
    url: 'https://www.coindesk.com/',
    source: 'Demo Source',
    publishedOn: new Date().toISOString(),
    imageUrl: 'https://cryptocompare.com/media/37746251/btc.png',
  },
  {
    id: 'fallback-2',
    title: 'Layer 2 networks continue to see strong user growth',
    url: 'https://www.coindesk.com/',
    source: 'Demo Source',
    publishedOn: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    imageUrl: 'https://cryptocompare.com/media/37746238/eth.png',
  },
];

const isSafeUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const sanitizeNewsItem = (item) => ({
  id: item.guid || item.link || item.title || crypto.randomUUID(),
  title: item.title?.toString().trim() || 'Untitled story',
  url: isSafeUrl(item.link || item.url) ? item.link || item.url : '#',
  source: item.source || item.source_info?.name || 'Unknown',
  publishedOn: item.pubDate || item.published || new Date().toISOString(),
  imageUrl: item.enclosure?.link || item.thumbnail || item.imageurl || '',
});

export const getCryptoTickers = async (req, res) => {
  try {
    // 1. Check Cache first
    const cachedTickers = dataCache.get('tickers');
    if (cachedTickers) {
      return res.status(200).json(cachedTickers);
    }

    // 2. If not in cache, fetch from CoinGecko
    // Fetching top 10 coins by market cap
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 10,
        page: 1,
        sparkline: false,
      },
    });

    // 3. Save to Cache and Respond
    dataCache.set('tickers', response.data);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Ticker Error:', error.message);
    // If API fails, try to return old cache, or empty array
    const staleData = dataCache.get('tickers');
    if (staleData) return res.status(200).json(staleData);

    res.status(500).json({ message: 'Could not fetch tickers' });
  }
};

export const getCryptoNews = async (req, res) => {
  try {
    const cachedNews = dataCache.get('news');
    if (cachedNews) return res.status(200).json(cachedNews);

    const feedUrl = isSafeUrl(process.env.NEWS_FEED_URL)
      ? process.env.NEWS_FEED_URL
      : DEFAULT_NEWS_FEED_URL;

    const response = await axios.get(feedUrl, { timeout: 8000 });
    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    const cleanNews = items.map(sanitizeNewsItem).filter((item) => item.url !== '#');

    const payload = cleanNews.length ? cleanNews : FALLBACK_NEWS;
    dataCache.set('news', payload);
    res.status(200).json(payload);
  } catch (error) {
    console.error('News Error:', error.message);
    const staleData = dataCache.get('news');
    if (staleData) return res.status(200).json(staleData);

    res.status(200).json(FALLBACK_NEWS);
  }
};
