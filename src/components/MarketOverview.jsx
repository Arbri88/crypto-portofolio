import { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Progress, Skeleton } from 'antd';
import axios from 'axios';

export default function MarketOverview() {
  const [globalData, setGlobalData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGlobalData() {
      try {
        // Fetch Global Crypto Stats (Market Cap, Volume, Bitcoin Dominance)
        const response = await axios.get('https://api.coingecko.com/api/v3/global');
        setGlobalData(response.data.data);
      } catch (error) {
        console.error("Failed to fetch global stats", error);
      } finally {
        setLoading(false);
      }
    }

    fetchGlobalData();
  }, []);

  if (loading) return <Skeleton active paragraph={{ rows: 1 }} />;
  if (!globalData) return null;

  // Helper to format billions/trillions
  const formatCurrency = (value) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)} T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)} B`;
    return `$${value.toLocaleString()}`;
  };

  // Calculate Bitcoin Dominance for "Altseason" reference
  const btcDom = globalData.market_cap_percentage.btc;
  const isAltseason = btcDom < 40; // Rough rule: If BTC dom < 40%, it's Altseason

  return (
    <Card style={{ marginBottom: '1rem' }} bodyStyle={{ padding: '15px' }}>
      <Row gutter={16} align="middle">
        
        {/* 1. Market Cap */}
        <Col span={8}>
            <Statistic 
                title="Total Market Cap" 
                value={formatCurrency(globalData.total_market_cap.usd)} 
            />
        </Col>

        {/* 2. THE REQUESTED FEATURE: Total Volume */}
        <Col span={8}>
            <Statistic 
                title="Total 24h Volume" 
                value={formatCurrency(globalData.total_volume.usd)} 
                valueStyle={{ color: '#1890ff' }} 
            />
        </Col>

        {/* 3. BTC Dominance / Altseason Indicator */}
        <Col span={8}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'gray', fontSize: '14px' }}>BTC Dominance</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {btcDom.toFixed(1)}%
                </span>
                <Progress 
                    percent={btcDom} 
                    showInfo={false} 
                    strokeColor={isAltseason ? "orange" : "#1890ff"} 
                    size="small"
                />
                <span style={{ fontSize: '12px', color: isAltseason ? 'orange' : 'gray' }}>
                    {isAltseason ? "🔥 Altseason is here" : "Bitcoin Season"}
                </span>
            </div>
        </Col>

      </Row>
    </Card>
  );
}
