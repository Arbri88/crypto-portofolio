import { useState } from 'react';
import { Card, Select, InputNumber, Button, Statistic, Row, Col, message, Divider } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, ExperimentOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useCrypto } from '../../context/crypto-context.jsx';

export default function StrategyBacktester() {
  const { crypto } = useCrypto();
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [amount, setAmount] = useState(1000);
  const [duration, setDuration] = useState(365);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    if (!selectedCoin) return message.warning('Select a coin first');

    if (!selectedCoin.symbol) {
      message.error('Selected asset is missing a tradable symbol. Please refresh or pick another coin.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const sym = selectedCoin.symbol.toUpperCase();
      const res = await axios.get(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=${sym}&tsym=USD&limit=${duration}`);

      const history = res.data.Data.Data;
      if (!history.length) throw new Error('No Data');

      const startPrice = history[0].close;
      const endPrice = history[history.length - 1].close;

      const coinCount = amount / startPrice;
      const finalVal = coinCount * endPrice;
      const profit = finalVal - amount;
      const percent = (profit / amount) * 100;

      setResult({ finalVal, profit, percent, startPrice, endPrice });
    } catch (err) {
      message.error('Could not fetch historical data');
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
          style={{ width: 120 }}
          options={crypto.map((c) => ({ label: c.name, value: c.id, symbol: c.symbol }))}
          onChange={(v, opt) => setSelectedCoin(opt)}
        />
        <InputNumber
          addonBefore="$"
          defaultValue={1000}
          onChange={setAmount}
          style={{ width: 120 }}
        />
        <Select
          defaultValue={365}
          onChange={setDuration}
          style={{ width: 130 }}
          options={[
            { label: '1 Month', value: 30 },
            { label: '3 Months', value: 90 },
            { label: '1 Year', value: 365 },
          ]}
        />
        <Button type="primary" onClick={handleRun} loading={loading}>Run</Button>
      </div>

      {result && (
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
              <Statistic title="Final Value" value={result.finalVal} precision={2} prefix="$" />
            </Col>
            <Col span={12}>
              <Statistic
                title="Total Return"
                value={result.percent}
                precision={2}
                suffix="%"
                valueStyle={{ color: result.profit > 0 ? '#52c41a' : '#ff4d4f' }}
                prefix={result.profit > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              />
            </Col>
          </Row>
          <Divider style={{ margin: '10px 0' }} />
          <small style={{ color: 'gray', display: 'block', textAlign: 'center' }}>
            Strategy: Buy & Hold ({duration} days).<br />
            Buy Price: ${result.startPrice.toFixed(2)} → Sell Price: ${result.endPrice.toFixed(2)}
          </small>
        </div>
      )}
    </Card>
  );
}
