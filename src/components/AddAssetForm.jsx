import { useState } from 'react';
import { Select, Space, Divider, Form, InputNumber, Button, DatePicker, Result, message } from 'antd';
import { useCrypto } from '../context/crypto-context.jsx';

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
  const { crypto, addAsset } = useCrypto();
  const [coin, setCoin] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();

  if (submitted) {
    return (
      <Result
        status="success"
        title="New Asset Added!"
        subTitle={`Added ${form.getFieldValue('amount')} of ${coin.name} to your portfolio.`}
        extra={[
          <Button type="primary" key="console" onClick={onClose}>
            Close
          </Button>,
        ]}
      />
    );
  }

  if (!coin) {
    return (
      <Select
        style={{ width: '100%' }}
        onSelect={(v) => setCoin(crypto.find((c) => c.id === v))}
        placeholder="Select Coin"
        options={crypto.map((c) => ({
          label: c.name,
          value: c.id,
          icon: c.icon,
        }))}
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
    const newAsset = {
      id: coin.id,
      amount: values.amount,
      price: values.price,
      date: values.date ? values.date.$d : new Date(),
    };

    addAsset(newAsset);

    messageApi.success('Asset added successfully');
    setSubmitted(true);
  }

  function handleAmountChange(value) {
    const price = form.getFieldValue('price');
    form.setFieldsValue({
      total: +(value * price).toFixed(2),
    });
  }

  function handlePriceChange(value) {
    const amount = form.getFieldValue('amount');
    form.setFieldsValue({
      total: +(amount * value).toFixed(2),
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
        initialValues={{
          price: +coin.price.toFixed(2),
        }}
        onFinish={onFinish}
        validateMessages={{ required: '${label} is required!' }}
      >
        <CoinInfo coin={coin} />
        <Divider />

        <Form.Item
          label="Amount"
          name="amount"
          rules={[
            { required: true, type: 'number', min: 0, message: 'Enter a valid positive amount' },
          ]}
        >
          <InputNumber placeholder="Enter coin amount" onChange={handleAmountChange} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="Price" name="price">
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
