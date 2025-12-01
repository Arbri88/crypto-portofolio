import { useState, useEffect } from 'react';
import { List, Avatar, Card, Typography, Spin, Tag } from 'antd';
import axios from 'axios';

const DEMO_NEWS = [
  {
    id: 1,
    title: 'Bitcoin Breaks $70k Resistance Level',
    url: '#',
    source: 'CryptoDaily',
    published_on: Date.now() / 1000,
    imageurl: 'https://cryptocompare.com/media/37746251/btc.png',
  },
  {
    id: 2,
    title: 'Ethereum Upgrade: What You Need To Know',
    url: '#',
    source: 'CoinDesk',
    published_on: (Date.now() - 3600000) / 1000,
    imageurl: 'https://cryptocompare.com/media/37746238/eth.png',
  },
];

export default function NewsFeed() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getNews() {
      try {
        const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        setNews(response.data.Data.slice(0, 6));
      } catch (error) {
        console.error('API Blocked by browser, loading demo data:', error);
        setNews(DEMO_NEWS);
      } finally {
        setLoading(false);
      }
    }
    getNews();
  }, []);

  if (loading) return <Spin />;

  return (
    <Card title="Crypto News">
      <List
        itemLayout="horizontal"
        dataSource={news}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar shape="square" size={64} src={item.imageurl} />}
              title={
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              }
              description={
                <div>
                  <Tag color="blue">{item.source_info?.name || item.source}</Tag>
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    {new Date(item.published_on * 1000).toLocaleDateString()}
                  </Typography.Text>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
