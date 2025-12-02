import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardMedia, CircularProgress, Grid, Typography } from '@material-ui/core';
import * as api from '../api';

const NewsFeed = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const getNews = async () => {
      try {
        const { data } = await api.fetchNews();
        setNews(data);
        setLoading(false);
      } catch (err) {
        console.log(err);
        setError(true);
        setLoading(false);
      }
    };
    getNews();
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <Typography>News temporarily unavailable.</Typography>;

  return (
    <div style={{ padding: '20px 0' }}>
      <Typography variant="h5" gutterBottom>
        Crypto News
      </Typography>
      <Grid container spacing={3}>
        {news.slice(0, 4).map((article, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card style={{ height: '100%' }}>
              {article.thumbnail && (
                <CardMedia component="img" height="140" image={article.thumbnail} alt="news thumbnail" />
              )}
              <CardContent>
                <Typography variant="h6" style={{ fontSize: '1rem' }}>
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {article.title}
                  </a>
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {new Date(article.pubDate).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  );
};

export default NewsFeed;
