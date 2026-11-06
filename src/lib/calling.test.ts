import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCallUrl, getCallTarget } from './calling';

test('buildCallUrl keeps tel numbers as tel links', () => {
  assert.equal(buildCallUrl('+63 917 123 4567'), 'tel:+639171234567');
});

test('buildCallUrl handles uppercase tel and direct dial schemes case-insensitively', () => {
  assert.equal(buildCallUrl('TEL:+63 917 123 4567'), 'tel:+639171234567');
  assert.equal(buildCallUrl('+63 917 123 4567'), 'tel:+639171234567');
});

test('buildCallUrl converts Philippine local numbers to a valid direct-dial URL without provider data', () => {
  assert.equal(buildCallUrl('09948165246'), 'tel:+639948165246');
  assert.equal(buildCallUrl('(082) 000-2222'), 'tel:+63820002222');
});

test('getCallTarget prefers the configured Twilio number before the direct PNP dial number', () => {
  const previousTwilio = process.env.EXPO_PUBLIC_TWILIO_NUMBER;
  const previousDirect = process.env.EXPO_PUBLIC_DIRECT_DIAL_NUMBER;

  process.env.EXPO_PUBLIC_TWILIO_NUMBER = '+1 202 555 0133';
  process.env.EXPO_PUBLIC_DIRECT_DIAL_NUMBER = '+63 905 880 8233';

  try {
    assert.equal(getCallTarget({ rawNumber: '(082) 000-2222' }), 'tel:+12025550133');
  } finally {
    if (previousTwilio === undefined) delete process.env.EXPO_PUBLIC_TWILIO_NUMBER;
    else process.env.EXPO_PUBLIC_TWILIO_NUMBER = previousTwilio;

    if (previousDirect === undefined) delete process.env.EXPO_PUBLIC_DIRECT_DIAL_NUMBER;
    else process.env.EXPO_PUBLIC_DIRECT_DIAL_NUMBER = previousDirect;
  }
});

test('getCallTarget dials a phone number directly when a normal number is configured', () => {
  assert.equal(
    getCallTarget({ rawNumber: '(082) 000-2222', voipUrl: '+63 917 123 4567' }),
    'tel:+639171234567',
  );
});

test('getCallTarget still allows an explicit SIP or VoIP URL override', () => {
  assert.equal(
    getCallTarget({ rawNumber: '(082) 000-2222', voipUrl: 'sip:hotline@cloudpbx.example' }),
    'sip:hotline@cloudpbx.example',
  );
});
