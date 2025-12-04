import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, Typography } from 'antd';
import { useCrypto } from '../../context/crypto-context.jsx';

// An elegant color palette
const COLORS = [
  '#0088FE', // Blue
  '#00C49F', // Teal
  '#FFBB28', // Yellow
  '#FF8042', // Orange
  '#8884d8', // Purple
  '#FF6384', // Pink
  '#36A2EB', // Light Blue
  '#4BC0C0', // Light Teal
];

const formatMoney = (value = 0) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Custom Tooltip to show accurate money values on hover
const CustomTooltip = ({ active, payload, balanceHidden }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '10px 15px',
          border: '1px solid #f0f0f0',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>{data.name}</p>
        <p style={{ margin: 0, color: '#1890ff' }}>
          {balanceHidden ? 'Hidden' : `$${formatMoney(data.value)}`}
        </p>
        {!balanceHidden && (
          <p style={{ margin: 0, fontSize: '10px', color: '#888' }}>
            {(data.percent * 100).toFixed(1)}% of portfolio
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function PortfolioPieChart() {
  const { assets, balanceHidden } = useCrypto();

  const data = useMemo(
    () =>
      assets
        .map((asset) => ({
          name: asset.name,
          value: asset.totalAmount,
        }))
        .filter((item) => item.value > 0),
    [assets],
  );

  const totalPortfolioValue = useMemo(() => data.reduce((acc, item) => acc + item.value, 0), [data]);

  const centerLabel = balanceHidden ? 'Hidden' : `$${formatMoney(totalPortfolioValue)}`;

  return (
    <Card 
      style={{ 
        height: '100%', 
        borderRadius: '12px', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)' 
      }}
      title={<Typography.Title level={4} style={{ margin: 0 }}>Allocation</Typography.Title>}
    >
      <div style={{ width: '100%', height: 350, position: 'relative' }}>
        
        {/* The Chart */}
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={80} // Makes it a Donut
              outerRadius={110}
              paddingAngle={4} // Whitespace between slices
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip balanceHidden={balanceHidden} />} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Text (Total Value) */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -65%)', // Adjust vertical centering slightly up to avoid legend
          textAlign: 'center',
          pointerEvents: 'none' // Allows clicking through the text to the chart
        }}>
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>Total Balance</Typography.Text>
            <br />
            <Typography.Text strong style={{ fontSize: '20px' }}>
              {centerLabel}
            </Typography.Text>
        </div>

      </div>
      <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: '12px', marginTop: '-10px' }}>
        Where your capital sits
      </Typography.Text>
    </Card>
  );
}
