import axios from 'axios';
import NodeCache from 'node-cache';

// Cache for 5 minutes (300 seconds) to avoid Rate Limits
const dataCache = new NodeCache({ stdTTL: 300 });

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

    // Using Bing News Search API (Requires Key) or a free alternative like NewsData.io
    // REPLACE 'YOUR_RAPIDAPI_KEY' in .env if using RapidAPI, or use a free endpoint
    // For this demo, I will use a mock structure or a free RSS-to-JSON service for crypto

    // Example using a free CoinDesk RSS feed converted to JSON (No key required for this demo)
    const response = await axios.get('https://api.rss2json.com/v1/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/');

    const cleanNews = response.data.items.map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      thumbnail: item.thumbnail,
    }));

    dataCache.set('news', cleanNews);
    res.status(200).json(cleanNews);
  } catch (error) {
    console.error('News Error:', error.message);
    res.status(500).json({ message: 'Could not fetch news' });
  }
};
