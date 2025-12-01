import { createContext, useState, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fakeFetchCrypto, fakeFetchAssets } from '../api';

const CryptoContext = createContext({
  assets: [],
  crypto: [],
  loading: false,
  addAsset: () => {},
});

// Helper function for math precision
function calculatePercentDiff(a, b) {
  return +(100 * Math.abs((a - b) / ((a + b) / 2))).toFixed(2);
}

export function CryptoContextProvider({ children }) {
  // 1. Load User's Assets from Local Storage (Persistence)
  const [assets, setAssets] = useState(() => {
    const saved = localStorage.getItem('my-crypto-assets');
    return saved ? JSON.parse(saved) : [];
  });

  // 2. Fetch Coin Data using React Query (Auto-caching & Background Refresh)
  const { data: cryptoData, isLoading: isCryptoLoading } = useQuery({
    queryKey: ['coins'],
    queryFn: fakeFetchCrypto,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  });

  // 3. Handle Initial Default Assets (Only if LocalStorage is empty)
  useEffect(() => {
    if (!localStorage.getItem('my-crypto-assets')) {
      fakeFetchAssets().then((initialAssets) => {
        setAssets(initialAssets);
      });
    }
  }, []);

  // 4. Combine API Data with User Holdings
  const mappedAssets = (assets || []).map((asset) => {
    const coin = cryptoData?.result?.find((c) => c.id === asset.id);

    if (!coin) {
      return {
        ...asset,
        totalAmount: 0,
        totalProfit: 0,
        growPercent: 0,
        grow: false,
        name: asset.id,
      };
    }

    return {
      ...asset,
      name: coin.name,
      icon: coin.icon,
      price: coin.price,
      grow: asset.price < coin.price,
      growPercent: calculatePercentDiff(asset.price, coin.price),
      totalAmount: asset.amount * coin.price,
      totalProfit: asset.amount * coin.price - asset.amount * asset.price,
    };
  });

  // 5. Add Asset Function
  function addAsset(newAsset) {
    setAssets((prev) => {
      const updated = [...prev, newAsset];
      localStorage.setItem('my-crypto-assets', JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <CryptoContext.Provider
      value={{
        loading: isCryptoLoading,
        crypto: cryptoData?.result || [],
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
