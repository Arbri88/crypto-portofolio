import axios from 'axios';

export async function fetchRealCrypto() {
  const response = await axios.get(
    'https://api.coingecko.com/api/v3/coins/markets',
    {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 50,
        page: 1,
        sparkline: false,
      },
    },
  );

  return response.data.map((coin) => ({
    id: coin.id,
    name: coin.name,
    icon: coin.image,
    price: coin.current_price,
  }));
}
