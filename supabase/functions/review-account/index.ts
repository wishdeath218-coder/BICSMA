import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-account-session, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const token = request.headers.get('x-account-session')?.trim();
    if (!token) return json({ error: 'Authentication required.' }, 401);

    const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: session, error: sessionError } = await service
      .from('account_sessions')
      .select('account_id')
      .eq('token_hash', await hashToken(token))
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return json({ error: 'Invalid or expired session.' }, 401);

    const { data: reviewer, error: reviewerError } = await service
      .from('accounts')
      .select('id, name, role, status')
      .eq('id', session.account_id)
      .maybeSingle();
    if (reviewerError) throw reviewerError;
    if (reviewer?.role !== 'admin' || reviewer.status !== 'Approved') {
      return json({ error: 'Only an approved admin can review account requests.' }, 403);
    }

    const body = await request.json();
    const accountId = String(body.accountId ?? '');
    const status = body.status;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!accountId || (status !== 'Approved' && status !== 'Rejected' && status !== 'Blocked')) {
      return json({ error: 'A valid account ID and review status are required.' }, 400);
    }
    if ((status === 'Rejected' || status === 'Blocked') && !reason) return json({ error: 'A reason is required for rejection or blocking.' }, 400);

    const blockedUntil = status === 'Blocked'
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: account, error: accountError } = await service
      .from('accounts')
      .update({
        status,
        blocked_until: blockedUntil,
        rejection_reason: status === 'Rejected' || status === 'Blocked' ? reason : null,
      })
      .eq('id', accountId)
      .select('*')
      .single();
    if (accountError) throw accountError;

    const { error: auditError } = await service.from('admin_audit_log').insert({
      actor_id: reviewer.id,
      actor_name: reviewer.name,
      action: `account.${status.toLowerCase()}`,
      entity_id: account.id,
      details: { targetName: account.name, reason: reason || null },
    });
    if (auditError) console.error('[review-account] account reviewed but audit write failed:', auditError);

    return json({
      account: {
        id: account.id,
        name: account.name,
        username: account.username,
        role: account.role,
        barangayPosition: account.barangay_position ?? undefined,
        cpNumber: account.cp_number ?? '',
        address: account.address ?? '',
        registeredDate: account.registered_date ?? '',
        verificationDocumentPath: account.verification_document_path ?? undefined,
        status: account.status,
        blockedUntil: account.blocked_until ?? undefined,
        rejectionReason: account.rejection_reason ?? undefined,
      },
    });
  } catch (error) {
    console.error('[review-account] request failed:', error);
    return json({ error: 'Unable to review the account request.' }, 500);
  }
});
