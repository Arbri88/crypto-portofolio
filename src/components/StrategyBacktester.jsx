import { useState } from 'react';
import { Card, Select, InputNumber, Button, Statistic, Row, Col, message, Spin, Divider } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useCrypto } from '../context/crypto-context';

export default function StrategyBacktester() {
  const { crypto } = useCrypto();
  
  // CHANGED: Store the whole coin object (we need the symbol 'btc', not just id 'bitcoin')
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [investmentAmount, setInvestmentAmount] = useState(1000);
  const [days, setDays] = useState(30);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRunBacktest = async () => {
    if (!selectedCoin) {
      message.warning("Please select a coin first!");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // SOLUTION: Use CryptoCompare API (More reliable for frontend history)
      // We use the symbol (e.g., BTC) and convert to UpperCase
      const symbol = selectedCoin.symbol.toUpperCase();
      
      const response = await axios.get(
        `https://min-api.cryptocompare.com/data/v2/histoday`, 
        {
            params: {
                fsym: symbol,
                tsym: 'USD',
                limit: days,
            }
        }
      );

      const dataPoints = response.data.Data.Data; // CryptoCompare nests data twice

      if (!dataPoints || dataPoints.length === 0) {
          throw new Error("No historical data returned");
      }

      // CryptoCompare returns data from Oldest -> Newest
      const startData = dataPoints[0]; // Price 'days' ago
      const endData = dataPoints[dataPoints.length - 1]; // Price today

      // Use 'close' price for calculations
      const startPrice = startData.close;
      const currentPrice = endData.close;

      if (!startPrice || !currentPrice) {
          throw new Error("Invalid price data");
      }

      // Calculate Profit/Loss
      const coinAmount = investmentAmount / startPrice;
      const finalValue = coinAmount * currentPrice;
      const profit = finalValue - investmentAmount;
      const percentage = ((profit / investmentAmount) * 100);

      setResult({
        initial: investmentAmount,
        final: finalValue,
        profit: profit,
        percentage: percentage,
        days: days,
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
    <Card title="Strategy Backtester (Buy & Hold)" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* CHANGED: Select now stores the whole coin object */}
        <Select
          style={{ width: 200 }}
          placeholder="Select Coin"
          onChange={(value) => {
              const coin = crypto.find((c) => c.id === value);
              setSelectedCoin(coin);
          }}
          options={crypto.map((c) => ({ 
              label: c.name, 
              value: c.id // We still use ID for the key, but find the object on change
          }))}
        />
        
        <InputNumber
          addonBefore="$"
          defaultValue={1000}
          min={1}
          onChange={setInvestmentAmount}
          placeholder="Investment"
          style={{ width: 150 }}
        />

        <Select 
            defaultValue={30} 
            onChange={setDays}
            style={{ width: 150 }}
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

      {loading && <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>}

      {result && !loading && (
        <div style={{ 
            background: result.profit >= 0 ? 'rgba(63, 134, 0, 0.05)' : 'rgba(207, 19, 34, 0.05)', 
            padding: '20px', 
            borderRadius: '8px',
            border: `1px solid ${result.profit >= 0 ? '#3f8600' : '#cf1322'}`
        }}>
          <Row gutter={16} style={{ textAlign: 'center' }}>
            <Col span={12}>
              <Statistic 
                title={`Value after ${result.days} days`} 
                value={result.final} 
                precision={2} 
                prefix="$" 
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Total Profit / Loss"
                value={result.percentage}
                precision={2}
                valueStyle={{ color: result.profit >= 0 ? '#3f8600' : '#cf1322' }}
                prefix={result.profit >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                suffix="%"
              />
            </Col>
          </Row>
          <Divider />
          <p style={{ textAlign: 'center', margin: 0, color: 'gray' }}>
            Strategy: If you bought <b>${result.initial}</b> of <b>{result.coinName}</b> {result.days} days ago at <b>${result.startPrice.toFixed(2)}</b>...<br/>
            You would have <b>${result.final.toFixed(2)}</b> today (Price: ${result.currentPrice.toFixed(2)}).
          </p>
        </div>
      )}
    </Card>
  );
}
