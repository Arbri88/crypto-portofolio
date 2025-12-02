import { createContext, useState, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import { fetchRealCrypto } from '../api';

const CryptoContext = createContext({
  assets: [],
  crypto: [],
  loading: false,
  addAsset: () => {},
});

const defaultAssets = [
  { id: 'bitcoin', amount: 0.25, price: 50000 },
  { id: 'ethereum', amount: 2, price: 2400 },
];

function percentDifference(a, b) {
  const bigA = new BigNumber(a);
  const bigB = new BigNumber(b);

  const average = bigA.plus(bigB).dividedBy(2);
  if (average.isZero()) return 0;

  return bigA
    .minus(bigB)
    .abs()
    .dividedBy(average)
    .multipliedBy(100)
    .toNumber();
}

function mapAssets(assets = [], crypto = []) {
  return assets.map((asset) => {
    const coin = crypto.find((c) => c.id === asset.id);

    if (!coin) {
      return {
        ...asset,
        price: asset.price ?? 0,
        purchasePrice: asset.price,
        grow: false,
        growPercent: 0,
        totalAmount: 0,
        totalProfit: 0,
        name: asset.id,
      };
    }

    const amount = new BigNumber(asset.amount);
    const currentPrice = new BigNumber(coin.price);
    const purchasePrice = new BigNumber(asset.price);

    return {
      ...asset,
      name: coin.name,
      icon: coin.icon,
      price: coin.price,
      purchasePrice: asset.price,
      grow: purchasePrice.isLessThan(currentPrice),
      growPercent: percentDifference(purchasePrice, currentPrice),
      totalAmount: amount.multipliedBy(currentPrice).toFixed(2),
      totalProfit: amount.multipliedBy(currentPrice.minus(purchasePrice)).toFixed(2),
    };
  });
}

export function CryptoContextProvider({ children }) {
  const [assets, setAssets] = useState([]);

  const { data: cryptoData, isLoading } = useQuery({
    queryKey: ['coins'],
    queryFn: fetchRealCrypto,
    refetchInterval: 60000,
  });

  const crypto = cryptoData || [];

  useEffect(() => {
    const savedAssets = localStorage.getItem('portfolio_assets');
    let baseAssets;

    if (savedAssets) {
      baseAssets = JSON.parse(savedAssets);
    } else {
      baseAssets = defaultAssets;
    }

    setAssets(baseAssets);
    localStorage.setItem('portfolio_assets', JSON.stringify(baseAssets));
  }, []);

  function addAsset(newAsset) {
    setAssets((prev) => {
      const updatedAssets = [...prev, newAsset];
      localStorage.setItem('portfolio_assets', JSON.stringify(updatedAssets));
      return updatedAssets;
    });
  }

  const mappedAssets = mapAssets(assets, crypto);

  return (
    <CryptoContext.Provider
      value={{
        loading: isLoading,
        crypto,
        assets: mappedAssets,
        addAsset,
      }}
      >
      {children}
    </CryptoContext.Provider>
  );
}

export default CryptoContext;

export function useCrypto() {
  return useContext(CryptoContext);
}
