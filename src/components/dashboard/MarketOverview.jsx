import { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Progress, Skeleton, Tag, Typography } from 'antd';
import axios from 'axios';
import { getCoinGeckoHeaders } from '../../api';

export default function MarketOverview() {
  const [globalData, setGlobalData] = useState(null);
  const [fearGreed, setFearGreed] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMarketSignals() {
      try {
        const [globalResponse, fearGreedResponse] = await Promise.all([
          axios.get('https://api.coingecko.com/api/v3/global', { headers: getCoinGeckoHeaders() }),
          axios.get('https://api.alternative.me/fng/', { params: { limit: 1 } }),
        ]);

        setGlobalData(globalResponse.data.data);

        const fearGreedData = fearGreedResponse.data?.data?.[0];
        if (fearGreedData) {
          setFearGreed({
            value: Number(fearGreedData.value),
            classification: fearGreedData.value_classification,
          });
        }
      } catch (error) {
        console.error("Failed to fetch global stats", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMarketSignals();
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
  const ethDom = globalData.market_cap_percentage.eth;
  const altMarketCap = globalData.total_market_cap.usd * (1 - (btcDom + ethDom) / 100);
  const isAltseason = btcDom < 40; // Rough rule: If BTC dom < 40%, it's Altseason
  const altSeasonScore = Math.max(0, Math.min(100, 100 - btcDom));
  const liquidityRatio = (globalData.total_volume.usd / globalData.total_market_cap.usd) * 100;

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

        {/* 2. Total Volume (Liquidity) */}
        <Col span={8}>
            <Statistic
                title="Total 24h Volume (Liquidity)"
                value={formatCurrency(globalData.total_volume.usd)}
                valueStyle={{ color: '#1890ff' }}
            />
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              Volume / Market Cap: {liquidityRatio.toFixed(2)}%
            </Typography.Text>
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

        {/* 4. Fear & Greed Index */}
        <Col span={8} style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'gray', fontSize: '14px' }}>Fear & Greed Index</span>
            {fearGreed ? (
              <>
                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{fearGreed.value}</span>
                <Tag color={fearGreed.value < 40 ? 'orange' : fearGreed.value < 60 ? 'gold' : 'green'}>
                  {fearGreed.classification}
                </Tag>
              </>
            ) : (
              <Typography.Text type="secondary">Unavailable</Typography.Text>
            )}
          </div>
        </Col>

        {/* 5. Altcoin Market Cap (Global Cap excluding BTC & ETH) */}
        <Col span={8} style={{ marginTop: '16px' }}>
          <Statistic title="Global Cap ex. BTC & ETH" value={formatCurrency(altMarketCap)} />
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            Altcoins represent {(100 - btcDom - ethDom).toFixed(1)}% of market cap
          </Typography.Text>
        </Col>

        {/* 6. Altseason Score */}
        <Col span={8} style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'gray', fontSize: '14px' }}>Altseason Indicator</span>
            <Progress
              percent={altSeasonScore}
              status={isAltseason ? 'success' : 'normal'}
              strokeColor={isAltseason ? 'orange' : '#1890ff'}
            />
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              Higher score = stronger altcoin season
            </Typography.Text>
          </div>
        </Col>

      </Row>
    </Card>
  );
}
