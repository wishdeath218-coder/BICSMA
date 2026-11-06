export function normalizePhoneNumber(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/[^0-9+]/g, '')
    .replace(/\+(?=\+)/g, '');
}

export function buildCallUrl(rawNumber: string): string {
  const raw = String(rawNumber ?? '').trim();
  if (!raw) return 'tel:911';

  const lowered = raw.toLowerCase();
  if (lowered.startsWith('tel:')) {
    return buildCallUrl(raw.replace(/^tel:/i, ''));
  }
  if (lowered.startsWith('sip:') || lowered.startsWith('http://') || lowered.startsWith('https://')) {
    return raw;
  }

  const clean = normalizePhoneNumber(raw);
  if (!clean) return 'tel:911';

  const digits = clean.replace(/^\+/, '');
  if (!digits) return 'tel:911';

  if (digits.length <= 6) {
    return `tel:${digits}`;
  }

  if (digits.startsWith('63')) {
    return `tel:+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `tel:+63${digits.slice(1)}`;
  }

  return `tel:+${digits}`;
}

function resolveExplicitCallTarget(value?: string): string | null {
  const configured = value?.trim();
  if (!configured) return null;

  const lowered = configured.toLowerCase();
  if (lowered.startsWith('sip:')) return configured;
  if (lowered.startsWith('http://') || lowered.startsWith('https://')) return configured;
  if (lowered.startsWith('tel:')) return buildCallUrl(configured);

  const normalized = normalizePhoneNumber(configured);
  if (normalized && /^\+?[0-9]{7,15}$/.test(normalized)) {
    return buildCallUrl(normalized);
  }

  return null;
}

export function getCallTarget(options?: {
  rawNumber?: string;
  voipUrl?: string;
  fallbackNumber?: string;
}): string {
  const configured = resolveExplicitCallTarget(options?.voipUrl ?? process.env.EXPO_PUBLIC_VOIP_CALL_URL);
  if (configured) return configured;

  const twilioNumber = resolveExplicitCallTarget(
    process.env.EXPO_PUBLIC_TWILIO_NUMBER ??
    process.env.EXPO_PUBLIC_CALL_NUMBER,
  );
  if (twilioNumber) return twilioNumber;

  const directDialNumber = resolveExplicitCallTarget(
    process.env.EXPO_PUBLIC_DIRECT_DIAL_NUMBER,
  );
  if (directDialNumber) return directDialNumber;

  const raw = options?.rawNumber ?? options?.fallbackNumber ?? '911';
  return buildCallUrl(raw);
}

export async function openCallTarget(target: string): Promise<boolean> {
  try {
    const normalized = target.trim();
    if (!normalized) return false;

    const { Linking } = require('react-native') as typeof import('react-native');
    const supported = await Linking.canOpenURL(normalized);
    if (!supported) return false;

    await Linking.openURL(normalized);
    return true;
  } catch {
    return false;
  }
}
