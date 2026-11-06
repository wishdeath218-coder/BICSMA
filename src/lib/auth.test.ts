import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeUsername } from './auth';

test('normalizeUsername trims and lowercases the username', () => {
  assert.equal(normalizeUsername('  Barangay.Admin  '), 'barangay.admin');
});

test('normalizeUsername strips unexpected whitespace and punctuation from usernames', () => {
  assert.equal(normalizeUsername('  Juan Dela Cruz  '), 'juandelacruz');
  assert.equal(normalizeUsername('admin@barangay'), 'adminbarangay');
});
