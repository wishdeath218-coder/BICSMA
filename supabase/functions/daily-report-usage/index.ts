import { findApprovedAccount, getDailyReportUsage } from '../_shared/account-session.ts';

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function corsHeadersFor(origin?: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'http://localhost:8081';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-account-session, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status = 200, origin?: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);

  try {
    const account = await findApprovedAccount(request);
    if (!account) return json({ error: 'Sign in with an approved account to view your report counter.' }, 401, origin);
    if (account.role !== 'resident') {
      return json({ used: 0, remaining: 3, limit: 3, resetAt: null }, 200, origin);
    }
    const usage = await getDailyReportUsage(account.id);
    if (!usage) throw new Error('Daily report counter returned no result.');
    return json({
      used: usage.used,
      remaining: usage.remaining,
      limit: 3,
      resetAt: usage.reset_at,
    }, 200, origin);
  } catch (error) {
    console.error('[daily-report-usage] request failed:', error);
    return json({ error: 'Unable to load your daily report counter.' }, 500, origin);
  }
});
