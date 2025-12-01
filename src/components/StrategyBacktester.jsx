import { useState } from 'react';
import { Card, Select, InputNumber, Button, Statistic, Row, Col, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useCrypto } from '../context/crypto-context.jsx';

export default function StrategyBacktester() {
  const { crypto } = useCrypto();
  const [selectedCoinId, setSelectedCoinId] = useState(null);
  const [investmentAmount, setInvestmentAmount] = useState(1000);
  const [days, setDays] = useState(30);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRunBacktest = async () => {
    if (!selectedCoinId) {
      message.warning('Please select a coin first!');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${selectedCoinId}/market_chart`,
        {
          params: {
            vs_currency: 'usd',
            days: days,
            interval: 'daily',
          },
        },
      );

      const prices = response.data.prices;

      if (!prices || prices.length === 0) throw new Error('No data found');

      const startPrice = prices[0][1];
      const currentPrice = prices[prices.length - 1][1];

      const coinAmount = investmentAmount / startPrice;
      const finalValue = coinAmount * currentPrice;
      const profit = finalValue - investmentAmount;
      const percentage = (profit / investmentAmount) * 100;

      setResult({
        initial: investmentAmount,
        final: finalValue,
        profit: profit,
        percentage: percentage,
        days: days,
        startPrice,
        currentPrice,
      });
    } catch (error) {
      console.error('Backtest failed', error);
      message.error('Could not fetch historical data for this coin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Strategy Backtester (Buy & Hold)">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Select
          style={{ width: 200 }}
          placeholder="Select Coin"
          onChange={setSelectedCoinId}
          options={crypto.map((c) => ({ label: c.name, value: c.id }))}
        />

        <InputNumber
          addonBefore="$"
          defaultValue={1000}
          onChange={setInvestmentAmount}
          placeholder="Investment"
        />

        <Select
          defaultValue={30}
          onChange={setDays}
          options={[
            { label: 'Last 7 Days', value: 7 },
            { label: 'Last 30 Days', value: 30 },
            { label: 'Last 90 Days', value: 90 },
            { label: 'Last 1 Year', value: 365 },
          ]}
        />

        <Button type="primary" onClick={handleRunBacktest} loading={loading}>
          Run Backtest
        </Button>
      </div>

      {result && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '8px' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic title={`Value after ${result.days} days`} value={result.final} precision={2} prefix="$" />
            </Col>
            <Col span={12}>
              <Statistic
                title="Profit / Loss"
                value={result.percentage}
                precision={2}
                valueStyle={{ color: result.profit >= 0 ? '#3f8600' : '#cf1322' }}
                prefix={result.profit >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                suffix="%"
              />
            </Col>
          </Row>
          <p style={{ marginTop: 10, color: 'gray' }}>
            If you bought at <b>${result.startPrice.toFixed(2)}</b> and sold at <b>${result.currentPrice.toFixed(2)}</b>.
          </p>
        </div>
      )}
    </Card>
  );
}
