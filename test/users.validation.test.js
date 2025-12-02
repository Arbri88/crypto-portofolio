import test from 'node:test';
import assert from 'node:assert/strict';
import { signInSchema, signUpSchema } from '../server/controllers/users.js';

test('signInSchema rejects an invalid email', () => {
  const { error } = signInSchema.validate({
    email: 'not-an-email',
    password: 'password123',
  });

  assert.ok(error);
});

test('signUpSchema requires matching passwords', () => {
  const { error } = signUpSchema.validate({
    email: 'user@example.com',
    password: 'password123',
    confirmPassword: 'different',
    firstName: 'Test',
    lastName: 'User',
  });

  assert.ok(error);
});

test('signUpSchema accepts a valid payload', () => {
  const { error } = signUpSchema.validate({
    email: 'user@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    firstName: 'Test',
    lastName: 'User',
  });

  assert.equal(error, undefined);
});
