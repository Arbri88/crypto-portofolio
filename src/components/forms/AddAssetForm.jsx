import { useMemo, useState } from 'react';
import { Select, Space, Divider, Form, InputNumber, Button, DatePicker, Result, message, Alert, Skeleton } from 'antd';
import BigNumber from 'bignumber.js';
import { useCrypto } from '../../context/crypto-context.jsx';

function CoinInfo({ coin }) {
  if (!coin) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <img src={coin.icon} alt={coin.name} style={{ width: 32, height: 32 }} />
      <div>
        <div style={{ fontWeight: 600 }}>{coin.name}</div>
        <div style={{ color: '#94a3b8' }}>Current price: ${coin.price?.toFixed(2)}</div>
      </div>
    </div>
  );
}

export default function AddAssetForm({ onClose }) {
  const [form] = Form.useForm();
  const { crypto, addAsset, loading } = useCrypto();
  const [coin, setCoin] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();

  const cryptoOptions = useMemo(
    () =>
      crypto.map((c) => ({
        label: c.name,
        value: c.id,
        icon: c.icon,
      })),
    [crypto],
  );

  const initialValues = useMemo(
    () => ({
      price: coin ? Number(coin.price ?? 0) : undefined,
    }),
    [coin],
  );

  function handleClose() {
    setSubmitted(false);
    setCoin(null);
    onClose?.();
  }

  if (submitted) {
    return (
      <Result
        status="success"
        title="New Asset Added!"
        subTitle={`Added ${form.getFieldValue('amount')} of ${coin.name} to your portfolio.`}
        extra={[
          <Button type="primary" key="console" onClick={handleClose}>
            Close
          </Button>,
        ]}
      />
    );
  }

  if (!coin) {
    if (loading) {
      return <Skeleton active />;
    }

    if (cryptoOptions.length === 0) {
      return (
        <Alert
          type="warning"
          showIcon
          message="Coin data unavailable"
          description="We couldn't load the market list. Please set VITE_COINGECKO_API_KEY in your environment or try again later."
        />
      );
    }

    return (
      <Select
        style={{ width: '100%' }}
        onSelect={(v) => setCoin(crypto.find((c) => c.id === v))}
        placeholder="Select Coin"
        options={cryptoOptions}
        optionRender={(option) => (
          <Space>
            <img style={{ width: 20 }} src={option.data.icon} alt={option.data.label} />{' '}
            {option.data.label}
          </Space>
        )}
      />
    );
  }

  function onFinish(values) {
    const amount = new BigNumber(values.amount ?? 0);
    const price = new BigNumber(values.price ?? 0);

    const newAsset = {
      id: coin.id,
      amount: amount.toString(),
      price: price.toString(),
      date: values.date?.toDate?.() ?? new Date(),
    };

    addAsset(newAsset);

    messageApi.success('Asset added successfully');
    setSubmitted(true);
  }

  function handleAmountChange(value) {
    const price = form.getFieldValue('price');

    if (price == null || value == null) return;

    form.setFieldsValue({
      total: new BigNumber(value).multipliedBy(new BigNumber(price)).toFixed(2),
    });
  }

  function handlePriceChange(value) {
    const amount = form.getFieldValue('amount');

    if (amount == null || value == null) return;

    form.setFieldsValue({
      total: new BigNumber(amount).multipliedBy(new BigNumber(value)).toFixed(2),
    });
  }

  return (
    <>
      {contextHolder}
      <Form
        form={form}
        name="basic"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        style={{ maxWidth: 600 }}
        initialValues={initialValues}
        onFinish={onFinish}
        validateMessages={{ required: '${label} is required!' }}
      >
        <CoinInfo coin={coin} />
        <Divider />

        <Form.Item
          label="Amount"
          name="amount"
          rules={[
            {
              required: true,
              type: 'number',
              min: 0,
              message: 'Amount must be greater than 0',
            },
          ]}
        >
          <InputNumber placeholder="Enter coin amount" onChange={handleAmountChange} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Price"
          name="price"
          rules={[
            {
              required: true,
              type: 'number',
              min: 0,
              message: 'Price must be greater than 0',
            },
          ]}
        >
          <InputNumber onChange={handlePriceChange} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="Date & Time" name="date">
          <DatePicker showTime />
        </Form.Item>

        <Form.Item label="Total" name="total">
          <InputNumber disabled style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            Add Asset
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
