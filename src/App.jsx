import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import AppLayout from './components/layout/AppLayout.jsx';
import { CryptoContextProvider } from './context/crypto-context.jsx';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#00b96b',
          },
        }}
      >
        <CryptoContextProvider>
          <AppLayout />
        </CryptoContextProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
