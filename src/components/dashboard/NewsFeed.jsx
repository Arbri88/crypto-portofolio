import { useEffect, useState } from 'react';
import { Alert, Avatar, Card, List, Spin, Tag, Typography } from 'antd';
import axios from 'axios';

const FALLBACK_NEWS = [
  {
    id: 'fallback-1',
    title: 'Crypto markets hold steady despite macro headwinds',
    url: 'https://www.coindesk.com/',
    source: 'Demo Source',
    publishedOn: new Date().toISOString(),
    imageUrl: 'https://cryptocompare.com/media/37746251/btc.png',
  },
  {
    id: 'fallback-2',
    title: 'Layer 2 networks continue to see strong user growth',
    url: 'https://www.coindesk.com/',
    source: 'Demo Source',
    publishedOn: new Date(Date.now() - 3600 * 1000).toISOString(),
    imageUrl: 'https://cryptocompare.com/media/37746238/eth.png',
  },
];

const NEWS_ENDPOINT = '/external/news';

export default function NewsFeed() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchNews = async () => {
      try {
        const response = await axios.get(NEWS_ENDPOINT, { timeout: 8000 });
        if (!isMounted) return;

        const payload = Array.isArray(response.data) ? response.data : [];
        setNews(payload.length ? payload : FALLBACK_NEWS);
      } catch (error) {
        console.error('News API Error:', error);
        if (isMounted) {
          setIsError(true);
          setNews(FALLBACK_NEWS);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNews();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>;

  return (
    <Card
      title="Crypto News Ticker"
      style={{ height: '100%', overflow: 'hidden' }}
      bodyStyle={{ padding: '10px 24px' }}
    >
      {isError ? <Alert message="Showing cached headlines" type="warning" showIcon /> : null}
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
                  src={item.imageUrl}
                  style={{ borderRadius: '8px' }}
                  alt="news thumbnail"
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
                  <Tag color="blue" style={{ fontSize: '10px' }}>{item.source}</Tag>
                  <Typography.Text type="secondary" style={{ fontSize: '10px', marginLeft: 6 }}>
                    {new Date(item.publishedOn).toLocaleDateString()}
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
