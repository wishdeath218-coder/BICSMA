import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type Account = {
  id: string;
  name: string;
  role: 'resident' | 'admin';
  status: string;
};

export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function findApprovedAccount(request: Request): Promise<Account | null> {
  const token = request.headers.get('x-account-session')?.trim();
  if (!token) return null;

  const service = createServiceClient();
  const { data: session, error: sessionError } = await service
    .from('account_sessions')
    .select('account_id')
    .eq('token_hash', await hashToken(token))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return null;

  const { data: account, error: accountError } = await service
    .from('accounts')
    .select('id, name, role, status')
    .eq('id', session.account_id)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account || account.status !== 'Approved') return null;
  return account as Account;
}

export async function consumeDailyReportSlot(accountId: string, reportId: string) {
  const service = createServiceClient();
  const { data, error } = await service.rpc('consume_daily_report_slot', {
    p_account_id: accountId,
    p_report_id: reportId,
    p_daily_limit: 3,
  });
  if (error) throw error;
  return data?.[0] as { allowed: boolean; used: number; remaining: number; reset_at: string } | undefined;
}

export async function getDailyReportUsage(accountId: string) {
  const service = createServiceClient();
  const { data, error } = await service.rpc('get_daily_report_usage', {
    p_account_id: accountId,
  });
  if (error) throw error;
  return data?.[0] as { used: number; remaining: number; reset_at: string } | undefined;
}

export async function releaseDailyReportSlot(accountId: string, reportId: string) {
  const service = createServiceClient();
  const { error } = await service.rpc('release_daily_report_slot', {
    p_account_id: accountId,
    p_report_id: reportId,
  });
  if (error) throw error;
}
