import { useEffect, useState } from 'react';
import { Card, Table, Typography, Tag } from 'antd';
import axios from 'axios';
import { useCrypto } from '../../context/crypto-context.jsx';
import { getCoinGeckoHeaders } from '../../api';

export default function PerformanceIndices() {
  const { assets } = useCrypto();
  const [portfolioStats, setPortfolioStats] = useState({ m1: 0, m3: 0, y1: 0 });
  const [loading, setLoading] = useState(true);

  // Benchmark Constants (from your request)
  const BENCHMARKS = {
    sp500: { m1: 2.0, m3: 5.0, y1: 8.0 },
    nasdaq: { m1: 2.5, m3: 6.5, y1: 11.0 },
  };

  useEffect(() => {
    async function calculateSyntheticPerformance() {
      const topAsset = [...assets].sort((a, b) => b.totalAmount - a.totalAmount)[0];

      if (!topAsset) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(
          `https://api.coingecko.com/api/v3/coins/${topAsset.id}/market_chart`,
          { params: { vs_currency: 'usd', days: 365, interval: 'daily' }, headers: getCoinGeckoHeaders() },
        );

        const prices = response.data.prices;
        const currentPrice = prices[prices.length - 1][1];

        const getPriceAgo = (days) => {
          const targetIndex = prices.length - 1 - days;
          return targetIndex >= 0 ? prices[targetIndex][1] : prices[0][1];
        };

        const calcChange = (oldPrice) => ((currentPrice - oldPrice) / oldPrice) * 100;

        setPortfolioStats({
          m1: calcChange(getPriceAgo(30)),
          m3: calcChange(getPriceAgo(90)),
          y1: calcChange(getPriceAgo(365)),
        });
      } catch (error) {
        console.error('Performance Calc Error', error);
      } finally {
        setLoading(false);
      }
    }

    if (assets.length > 0) calculateSyntheticPerformance();
  }, [assets]);

  const columns = [
    { title: 'Period', dataIndex: 'period', key: 'period', width: '25%' },
    {
      title: 'Your Portfolio',
      dataIndex: 'portfolio',
      key: 'portfolio',
      render: (val) => (
        <Tag color={val >= 0 ? 'success' : 'error'}>
          {val > 0 ? '+' : ''}
          {val.toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: 'S&P 500',
      dataIndex: 'sp',
      key: 'sp',
      render: (val) => <span style={{ color: 'gray' }}>+{val.toFixed(2)}%</span>,
    },
    {
      title: 'Nasdaq',
      dataIndex: 'nasdaq',
      key: 'nasdaq',
      render: (val) => <span style={{ color: 'gray' }}>+{val.toFixed(2)}%</span>,
    },
  ];

  const data = [
    { key: '1', period: '1 Month', portfolio: portfolioStats.m1, sp: BENCHMARKS.sp500.m1, nasdaq: BENCHMARKS.nasdaq.m1 },
    { key: '2', period: '3 Months', portfolio: portfolioStats.m3, sp: BENCHMARKS.sp500.m3, nasdaq: BENCHMARKS.nasdaq.m3 },
    { key: '3', period: '1 Year', portfolio: portfolioStats.y1, sp: BENCHMARKS.sp500.y1, nasdaq: BENCHMARKS.nasdaq.y1 },
  ];

  return (
    <Card title="Performance vs Indices (Est.)" loading={loading} style={{ height: '100%' }}>
      <Table dataSource={data} columns={columns} pagination={false} size="small" bordered={false} />
      <Typography.Text type="secondary" style={{ fontSize: '10px', display: 'block', marginTop: 10 }}>
        * Uses synthetic curve based on your top asset ({assets[0]?.name}). Index data is long-run average.
      </Typography.Text>
    </Card>
  );
}
