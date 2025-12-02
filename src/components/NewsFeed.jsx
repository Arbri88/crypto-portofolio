import { useState, useEffect } from 'react';
import { List, Avatar, Card, Typography, Tag, Spin, Alert } from 'antd';
import axios from 'axios';

export default function NewsFeed() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        // CryptoCompare News API (Usually allows CORS)
        const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        setNews(response.data.Data.slice(0, 5)); // Top 5 stories
      } catch (error) {
        console.error('News API Error:', error);
        setIsError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>;

  return (
    <Card
      title="Crypto News Ticker"
      style={{ height: '100%', overflow: 'hidden' }}
      bodyStyle={{ padding: '10px 24px' }}
    >
      {isError ? (
        <Alert message="News unavailable right now" type="warning" showIcon />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={news}
          renderItem={(item) => (
            <List.Item style={{ padding: '10px 0' }}>
              <List.Item.Meta
                avatar={
                  <Avatar
                    shape="square"
                    size={50}
                    src={item.imageurl}
                    style={{ borderRadius: '8px' }}
                  />
                }
                title={
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.2' }}
                  >
                    {item.title.length > 60 ? `${item.title.substring(0, 60)}...` : item.title}
                  </a>
                }
                description={
                  <div style={{ marginTop: 4 }}>
                    <Tag color="blue" style={{ fontSize: '10px' }}>{item.source_info.name}</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: '10px' }}>
                      {new Date(item.published_on * 1000).toLocaleDateString()}
                    </Typography.Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
