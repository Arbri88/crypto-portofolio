const demoCoins = [
  { id: 'bitcoin', name: 'Bitcoin', icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png', price: 62000 },
  { id: 'ethereum', name: 'Ethereum', icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png', price: 3200 },
  { id: 'dogecoin', name: 'Dogecoin', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png', price: 0.09 },
];

const defaultAssets = [
  { id: 'bitcoin', amount: 0.25, price: 50000 },
  { id: 'ethereum', amount: 2, price: 2400 },
];

export function fakeFetchCrypto() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ result: demoCoins });
    }, 300);
  });
}

export function fakeFetchAssets() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(defaultAssets);
    }, 200);
  });
}
