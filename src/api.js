import axios from 'axios';

export const FALLBACK_COINS = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'eth', icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  { id: 'tether', name: 'Tether', symbol: 'usdt', icon: 'https://assets.coingecko.com/coins/images/325/large/Tether.png' },
  { id: 'binancecoin', name: 'BNB', symbol: 'bnb', icon: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png' },
  { id: 'solana', name: 'Solana', symbol: 'sol', icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' },
  { id: 'ripple', name: 'XRP', symbol: 'xrp', icon: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'doge', icon: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png' },
  { id: 'tron', name: 'TRON', symbol: 'trx', icon: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png' },
  { id: 'cardano', name: 'Cardano', symbol: 'ada', icon: 'https://assets.coingecko.com/coins/images/975/large/cardano.png' },
  { id: 'avalanche-2', name: 'Avalanche', symbol: 'avax', icon: 'https://assets.coingecko.com/coins/images/12559/large/coin-round-red.png' },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'shib', icon: 'https://assets.coingecko.com/coins/images/11939/large/shiba.png' },
  { id: 'polkadot', name: 'Polkadot', symbol: 'dot', icon: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png' },
  { id: 'litecoin', name: 'Litecoin', symbol: 'ltc', icon: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png' },
  { id: 'chainlink', name: 'Chainlink', symbol: 'link', icon: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png' },
  { id: 'uniswap', name: 'Uniswap', symbol: 'uni', icon: 'https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png' },
  { id: 'stellar', name: 'Stellar', symbol: 'xlm', icon: 'https://assets.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png' },
  { id: 'wrapped-bitcoin', name: 'Wrapped Bitcoin', symbol: 'wbtc', icon: 'https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png' },
  { id: 'bitcoin-cash', name: 'Bitcoin Cash', symbol: 'bch', icon: 'https://assets.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png' },
  { id: 'internet-computer', name: 'Internet Computer', symbol: 'icp', icon: 'https://assets.coingecko.com/coins/images/14495/large/Internet_Computer_logo.png' },
  { id: 'okb', name: 'OKB', symbol: 'okb', icon: 'https://assets.coingecko.com/coins/images/4463/large/okb_token.png' },
];

const COINGECKO_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_COINGECKO_API_KEY) ||
  process.env.VITE_COINGECKO_API_KEY ||
  process.env.COINGECKO_API_KEY ||
  '';

export function getCoinGeckoHeaders() {
  return COINGECKO_API_KEY ? { 'x-cg-demo-api-key': COINGECKO_API_KEY } : {};
}

export async function fetchRealCrypto() {
  const url = 'https://api.coingecko.com/api/v3/coins/markets';
  const pages = [1, 2];

  const responses = await Promise.all(
    pages.map((page) =>
      axios.get(url, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 250,
          page,
          sparkline: false,
        },
      }),
    ),
  );

  const combinedData = responses.flatMap((response) => response.data).slice(0, 500);

  return combinedData.map((coin) => ({
    id: coin.id,
    name: coin.name,
    icon: coin.image,
    price: coin.current_price,
    symbol: coin.symbol,
  }));
}
