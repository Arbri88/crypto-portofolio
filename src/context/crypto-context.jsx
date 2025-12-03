import { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
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
    const amount = new BigNumber(asset.amount ?? 0);
    const purchasePrice = new BigNumber(asset.price ?? 0);

    if (!coin) {
      return {
        ...asset,
        price: purchasePrice.toNumber(),
        purchasePrice: purchasePrice.toNumber(),
        grow: false,
        growPercent: 0,
        totalAmount: amount.multipliedBy(purchasePrice).toNumber(),
        totalProfit: 0,
        name: asset.id,
      };
    }

    const currentPrice = new BigNumber(coin.price ?? 0);

    return {
      ...asset,
      name: coin.name,
      icon: coin.icon,
      price: coin.price,
      purchasePrice: purchasePrice.toNumber(),
      grow: purchasePrice.isLessThan(currentPrice),
      growPercent: percentDifference(purchasePrice, currentPrice),
      totalAmount: amount.multipliedBy(currentPrice).toNumber(),
      totalProfit: amount.multipliedBy(currentPrice.minus(purchasePrice)).toNumber(),
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
    const baseAssets = savedAssets ? JSON.parse(savedAssets) : defaultAssets;

    setAssets(baseAssets);
    localStorage.setItem('portfolio_assets', JSON.stringify(baseAssets));
  }, []);

  const addAsset = useCallback((newAsset) => {
    setAssets((prev) => {
      const updatedAssets = [...prev, newAsset];
      localStorage.setItem('portfolio_assets', JSON.stringify(updatedAssets));
      return updatedAssets;
    });
  }, []);

  const mappedAssets = useMemo(() => mapAssets(assets, crypto), [assets, crypto]);

  const contextValue = useMemo(
    () => ({
      loading: isLoading,
      crypto,
      assets: mappedAssets,
      addAsset,
    }),
    [addAsset, crypto, isLoading, mappedAssets],
  );

  return (
    <CryptoContext.Provider value={contextValue}>
      {children}
    </CryptoContext.Provider>
  );
}

export default CryptoContext;

export function useCrypto() {
  return useContext(CryptoContext);
}
