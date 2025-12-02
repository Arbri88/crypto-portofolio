import { useState } from 'react';
import { Card, Select, InputNumber, Button, Statistic, Row, Col, message, Spin, Divider } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, ExperimentOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useCrypto } from '../context/crypto-context';

export default function StrategyBacktester() {
  const { crypto } = useCrypto();

  const [selectedCoin, setSelectedCoin] = useState(null);
  const [amount, setAmount] = useState(1000);
  const [duration, setDuration] = useState(365);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRunBacktest = async () => {
    if (!selectedCoin) {
      message.warning("Please select a coin first!");
      return;
    }

    if (!selectedCoin.symbol) {
      message.error('Selected asset is missing a tradable symbol. Please refresh or pick another coin.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const symbol = selectedCoin.symbol?.toUpperCase();

      if (!symbol) {
        throw new Error('Missing symbol for selected asset');
      }

      const response = await axios.get('https://min-api.cryptocompare.com/data/v2/histoday', {
        params: {
          fsym: symbol,
          tsym: 'USD',
          limit: duration,
        },
      });

      const dataPoints = response.data.Data.Data; // CryptoCompare nests data twice

      if (!dataPoints || dataPoints.length === 0) {
          throw new Error("No historical data returned");
      }

      // CryptoCompare returns data from Oldest -> Newest
      const startData = dataPoints[0]; // Price 'duration' days ago
      const endData = dataPoints[dataPoints.length - 1]; // Price today

      // Use 'close' price for calculations
      const startPrice = startData.close;
      const currentPrice = endData.close;

      if (!startPrice || !currentPrice) {
          throw new Error("Invalid price data");
      }

      // Calculate Profit/Loss
      const coinAmount = amount / startPrice;
      const finalValue = coinAmount * currentPrice;
      const profit = finalValue - amount;
      const percentage = (profit / amount) * 100;

      setResult({
        initial: amount,
        final: finalValue,
        profit: profit,
        percentage: percentage,
        days: duration,
        startPrice,
        currentPrice,
        coinName: selectedCoin.name
      });

      message.success("Backtest completed!");

    } catch (error) {
      console.error("Backtest failed:", error);
      // Improved Error Message
      message.error(
        error.response?.status === 429 
        ? "API Rate Limit Hit. Please wait 1 minute." 
        : "Could not fetch historical data. Try a major coin like BTC."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={<span><ExperimentOutlined /> Strategy Backtester</span>}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <Select
          showSearch
          placeholder="Select Asset"
          style={{ width: 180 }}
          options={crypto.map((c) => ({ label: c.name, value: c.id, symbol: c.symbol }))}
          onChange={(v, opt) => setSelectedCoin({ id: opt.value, name: opt.label, symbol: opt.symbol })}
        />
        <InputNumber
          addonBefore="$"
          defaultValue={amount}
          min={1}
          onChange={setAmount}
          style={{ width: 140 }}
        />
        <Select
          defaultValue={duration}
          onChange={setDuration}
          style={{ width: 150 }}
          options={[
            { label: '1 Month', value: 30 },
            { label: '3 Months', value: 90 },
            { label: '1 Year', value: 365 },
          ]}
        />
        <Button type="primary" onClick={handleRunBacktest} loading={loading}>
          Run Backtest
        </Button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
        </div>
      )}

      {result && !loading && (
        <div
          style={{
            background: result.profit > 0 ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)',
            padding: 15,
            borderRadius: 8,
            border: `1px solid ${result.profit > 0 ? '#52c41a' : '#ff4d4f'}`,
          }}
        >
          <Row gutter={16} style={{ textAlign: 'center' }}>
            <Col span={12}>
              <Statistic title="Final Value" value={result.final} precision={2} prefix="$" />
            </Col>
            <Col span={12}>
              <Statistic
                title="Total Return"
                value={result.percentage}
                precision={2}
                suffix="%"
                valueStyle={{ color: result.profit > 0 ? '#52c41a' : '#ff4d4f' }}
                prefix={result.profit > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              />
            </Col>
          </Row>
          <Divider style={{ margin: '10px 0' }} />
          <small style={{ color: 'gray', display: 'block', textAlign: 'center' }}>
            Strategy: Buy & Hold ({result.days} days).<br />
            Buy Price: ${result.startPrice.toFixed(2)} → Sell Price: ${result.currentPrice.toFixed(2)}
          </small>
        </div>
      )}
    </Card>
  );
}
