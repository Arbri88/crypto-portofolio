import { useState, useEffect } from 'react';
import { List, Avatar, Card, Typography, Spin, Tag, Alert } from 'antd';
import axios from 'axios';

export default function NewsFeed() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function getNews() {
      try {
        // TRICK: We use rss2json to convert Cointelegraph's RSS feed to JSON.
        // This bypasses CORS and API keys completely.
        const rssUrl = 'https://cointelegraph.com/rss';
        const response = await axios.get(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
        
        if (response.data.status === 'ok') {
            setNews(response.data.items.slice(0, 6)); // Top 6 stories
        } else {
            throw new Error("Feed parsing failed");
        }
      } catch (err) {
        console.error("News Error:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    getNews();
  }, []);

  if (loading) return <div style={{textAlign:'center', padding: 20}}><Spin /></div>;
  if (error) return <Alert message="Could not load news feed" type="warning" />;

  return (
    <Card title="Market News (CoinTelegraph)">
      <List
        itemLayout="horizontal"
        dataSource={news}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar shape="square" size={64} src={item.enclosure?.link || item.thumbnail} />}
              title={
                <a href={item.link} target="_blank" rel="noreferrer" style={{ color: '#1890ff' }}>
                  {item.title}
                </a>
              }
              description={
                <div>
                  <Tag color="gold">News</Tag>
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    {new Date(item.pubDate).toLocaleDateString()}
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
