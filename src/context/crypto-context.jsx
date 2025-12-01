import { createContext, useState, useContext, useEffect } from 'react';
import { fakeFetchCrypto, fakeFetchAssets } from '../api';

const CryptoContext = createContext({
  assets: [],
  crypto: [],
  loading: false,
  addAsset: () => {},
});

function percentDifference(a, b) {
  return +(100 * Math.abs((a - b) / ((a + b) / 2))).toFixed(2);
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

    return {
      ...asset,
      name: coin.name,
      icon: coin.icon,
      price: coin.price,
      purchasePrice: asset.price,
      grow: asset.price < coin.price,
      growPercent: percentDifference(asset.price, coin.price),
      totalAmount: +(asset.amount * coin.price).toFixed(2),
      totalProfit: +(asset.amount * coin.price - asset.amount * asset.price).toFixed(2),
    };
  });
}

export function CryptoContextProvider({ children }) {
  const [assets, setAssets] = useState([]);
  const [crypto, setCrypto] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function preload() {
      setLoading(true);
      const { result } = await fakeFetchCrypto();

      const savedAssets = localStorage.getItem('portfolio_assets');
      let baseAssets;

      if (savedAssets) {
        baseAssets = JSON.parse(savedAssets);
      } else {
        baseAssets = await fakeFetchAssets();
      }

      setAssets(baseAssets);
      localStorage.setItem('portfolio_assets', JSON.stringify(baseAssets));
      setCrypto(result);
      setLoading(false);
    }

    preload();
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
        loading,
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
