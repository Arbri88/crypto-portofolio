import React, { useEffect, useState } from 'react';
import { Paper, Typography } from '@material-ui/core';
import * as api from '../api';

const TickerTape = () => {
  const [tickers, setTickers] = useState([]);

  useEffect(() => {
    const getTickers = async () => {
      try {
        const { data } = await api.fetchTickers();
        setTickers(data);
      } catch (error) {
        console.log('Ticker load failed');
      }
    };
    getTickers();

    // Optional: Poll every 60 seconds
    const interval = setInterval(() => getTickers(), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!tickers.length) return null;

  return (
    <Paper
      elevation={3}
      style={{
        padding: '10px',
        margin: '20px 0',
        backgroundColor: '#1a1a1a',
        color: 'white',
        overflowX: 'auto',
      }}
    >
      <div style={{ display: 'flex', gap: '20px', whiteSpace: 'nowrap' }}>
        {tickers.map((coin) => (
          <div key={coin.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <img src={coin.image} alt={coin.name} height="20" />
            <Typography variant="body2" style={{ fontWeight: 'bold' }}>
              {coin.symbol.toUpperCase()}
            </Typography>
            <Typography variant="body2">${coin.current_price}</Typography>
            <Typography
              variant="body2"
              style={{ color: coin.price_change_percentage_24h >= 0 ? '#4caf50' : '#f44336' }}
            >
              {coin.price_change_percentage_24h.toFixed(2)}%
            </Typography>
          </div>
        ))}
      </div>
    </Paper>
  );
};

export default TickerTape;
