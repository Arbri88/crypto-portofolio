import test from 'node:test';
import assert from 'node:assert/strict';
import { postSchemaVal } from '../server/controllers/posts.js';

test('postSchemaVal accepts a valid portfolio entry', () => {
  const { error } = postSchemaVal.validate({
    title: 'BTC',
    message: 'Long-term hold',
    tags: ['btc', 'core'],
    selectedFile: '',
    price: 50000,
    amount: 0.1,
  });

  assert.equal(error, undefined);
});

test('postSchemaVal rejects a negative price', () => {
  const { error } = postSchemaVal.validate({
    title: 'BTC',
    message: 'Invalid',
    tags: [],
    selectedFile: '',
    price: -1,
    amount: 0.1,
  });

  assert.ok(error);
});

test('postSchemaVal rejects zero amount', () => {
  const { error } = postSchemaVal.validate({
    title: 'BTC',
    message: 'Invalid',
    tags: [],
    selectedFile: '',
    price: 50000,
    amount: 0,
  });

  assert.ok(error);
});
