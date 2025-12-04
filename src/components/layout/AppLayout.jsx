import { Layout, Card, Switch, ConfigProvider, theme, Typography, List, Row, Col, Space } from 'antd';
import { useMemo, useState } from 'react';
import AddAssetForm from '../forms/AddAssetForm.jsx';
import NewsFeed from '../dashboard/NewsFeed.jsx';
import PortfolioPieChart from '../dashboard/PortfolioPieChart.jsx';
import StrategyBacktester from '../dashboard/StrategyBacktester.jsx';
import PerformanceIndices from '../dashboard/PerformanceIndices.jsx';
import MarketOverview from '../dashboard/MarketOverview.jsx';
import { useCrypto } from '../../context/crypto-context.jsx';

export default function AppLayout() {
  const { Header, Content, Sider } = Layout;
  const [darkMode, setDarkMode] = useState(true);
  const { assets, balanceHidden, toggleBalanceVisibility } = useCrypto();

  const formatCurrency = useMemo(
    () => (value) =>
      (value ?? 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const formatDisplayValue = useMemo(
    () => (value) => (balanceHidden ? 'Hidden' : `$${formatCurrency(value)}`),
    [balanceHidden, formatCurrency],
  );

  return (
    <ConfigProvider theme={{ algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'white', fontWeight: 'bold' }}>CRYPTO PORTFOLIO</div>
          <Space>
            <Switch
              checkedChildren="Hide Balance"
              unCheckedChildren="Show Balance"
              checked={balanceHidden}
              onChange={toggleBalanceVisibility}
            />
            <Switch
              checkedChildren="Dark"
              unCheckedChildren="Light"
              checked={darkMode}
              onChange={() => setDarkMode(!darkMode)}
            />
          </Space>
        </Header>
        <Layout>
          <Sider width="25%" style={{ padding: '1rem' }}>
            <Card title="Add Asset" bordered={false}>
              <AddAssetForm onClose={() => setDarkMode((prev) => prev)} />
            </Card>
          </Sider>
          <Content style={{ padding: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <MarketOverview />
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <PortfolioPieChart />
                  </Col>
                  <Col span={24}>
                    <Card title="Holdings" bordered={false}>
                      <List
                        dataSource={assets}
                        renderItem={(item) => (
                          <List.Item key={item.id}>
                            <List.Item.Meta
                              avatar={<img src={item.icon} alt={item.name} style={{ width: 32 }} />}
                              title={<Typography.Text strong>{item.name}</Typography.Text>}
                              description={`Amount: ${item.amount} • Current: ${formatDisplayValue(item.price ?? 0)}`}
                            />
                            <div style={{ textAlign: 'right' }}>
                              <div>Total: {formatDisplayValue(item.totalAmount)}</div>
                              <div style={{ color: item.grow ? '#22c55e' : '#ef4444' }}>
                                {item.grow ? '+' : ''}
                                {item.growPercent}%
                              </div>
                            </div>
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>
              </Col>

              <Col xs={24} lg={8}>
                <div style={{ marginBottom: 16 }}>
                  <PerformanceIndices />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <StrategyBacktester />
                </div>
                <div style={{ height: 400 }}>
                  <NewsFeed />
                </div>
              </Col>
            </Row>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
