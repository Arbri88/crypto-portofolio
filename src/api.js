import axios from 'axios';

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
