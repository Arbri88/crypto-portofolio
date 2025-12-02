import { Layout, Card, Switch, ConfigProvider, theme, Typography, List, Row, Col } from 'antd';
import { useState } from 'react';
import AssetAllocationChart from '../AssetAllocationChart.jsx';
import AddAssetForm from '../AddAssetForm.jsx';
import { useCrypto } from '../../context/crypto-context.jsx';
import StrategyBacktester from '../StrategyBacktester.jsx';
import NewsFeed from '../NewsFeed.jsx';
import MarketOverview from '../MarketOverview.jsx';

export default function AppLayout() {
  const { Header, Content, Sider } = Layout;
  const [darkMode, setDarkMode] = useState(true);
  const { assets } = useCrypto();

  return (
    <ConfigProvider theme={{ algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'white', fontWeight: 'bold' }}>CRYPTO PORTFOLIO</div>
          <Switch
            checkedChildren="Dark"
            unCheckedChildren="Light"
            checked={darkMode}
            onChange={() => setDarkMode(!darkMode)}
          />
        </Header>
        <Layout>
          <Sider width="25%" style={{ padding: '1rem' }}>
            <Card title="Add Asset" bordered={false}>
              <AddAssetForm onClose={() => setDarkMode((prev) => prev)} />
            </Card>
          </Sider>
          <Content style={{ padding: '1rem' }}>
            <MarketOverview />
            <AssetAllocationChart assets={assets} />
            <Card title="Holdings" bordered={false}>
              <List
                dataSource={assets}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<img src={item.icon} alt={item.name} style={{ width: 32 }} />}
                      title={<Typography.Text strong>{item.name}</Typography.Text>}
                      description={`Amount: ${item.amount} • Current: $${item.price ?? 0}`}
                    />
                    <div style={{ textAlign: 'right' }}>
                      <div>Total: ${item.totalAmount?.toFixed(2) ?? '0.00'}</div>
                      <div style={{ color: item.grow ? '#22c55e' : '#ef4444' }}>
                        {item.grow ? '+' : ''}
                        {item.growPercent}%
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
            <Row gutter={[16, 16]} style={{ marginTop: '1rem' }}>
              <Col xs={24} lg={12}>
                <StrategyBacktester />
              </Col>
              <Col xs={24} lg={12}>
                <NewsFeed />
              </Col>
            </Row>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
