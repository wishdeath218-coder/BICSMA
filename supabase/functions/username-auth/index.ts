import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-account-session, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AccountRole = 'resident' | 'admin';

type AccountRow = {
  id: string;
  name: string;
  username: string;
  role: AccountRole;
  barangay_position: string | null;
  cp_number: string | null;
  address: string | null;
  registered_date: string | null;
  verification_document_path: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejection_reason: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toAccount(row: AccountRow) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    barangayPosition: row.barangay_position ?? undefined,
    cpNumber: row.cp_number ?? '',
    address: row.address ?? '',
    registeredDate: row.registered_date ?? '',
    verificationDocumentPath: row.verification_document_path ?? undefined,
    status: row.status,
    rejectionReason: row.rejection_reason ?? undefined,
  };
}

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function findSessionAccount(service: ReturnType<typeof serviceClient>, request: Request) {
  const token = request.headers.get('x-account-session')?.trim();
  if (!token) return null;

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
    .select('*')
    .eq('id', session.account_id)
    .maybeSingle();
  if (accountError) throw accountError;

  return account;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const body = await request.json();
    const action = body.action as string;
    const service = serviceClient();

    if (action === 'signup') {
      const username = String(body.username ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const name = String(body.name ?? '').trim();
      const role: AccountRole = body.role === 'admin' ? 'admin' : 'resident';
      const barangayPosition = role === 'admin' ? String(body.barangayPosition ?? '').trim() : null;
      const document = body.verificationDocument;
      const mimeType = typeof document?.mimeType === 'string' ? document.mimeType : '';
      const base64 = typeof document?.base64 === 'string' ? document.base64 : '';
      const allowedMimeTypes: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };

      if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
        return json({ error: 'Username must be 3–30 letters, numbers, dots, underscores, or hyphens.' }, 400);
      }
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      if (new TextEncoder().encode(password).length > 72) {
        return json({ error: 'Password must be 72 bytes or fewer.' }, 400);
      }
      if (!name) return json({ error: 'Full name is required.' }, 400);
      if (!allowedMimeTypes[mimeType] || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        return json({ error: 'Upload a valid ID photo or Certificate of Indigency image.' }, 400);
      }
      const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
      const decodedLength = Math.floor((base64.length * 3) / 4) - padding;
      if (decodedLength > 5 * 1024 * 1024) {
        return json({ error: 'The verification photo must be 5 MB or smaller.' }, 400);
      }
      if (base64.length % 4 !== 0) {
        return json({ error: 'Upload a valid ID photo or Certificate of Indigency image.' }, 400);
      }
      if (role === 'admin' && !barangayPosition) {
        return json({ error: 'Barangay position is required for admin applicants.' }, 400);
      }

      const { data: existing } = await service
        .from('accounts')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (existing) return json({ error: 'That username is already in use.' }, 409);

      const { data: passwordHash, error: hashError } = await service.rpc('hash_account_password', {
        password_input: password,
      });
      if (hashError || typeof passwordHash !== 'string') throw hashError ?? new Error('Unable to hash password.');

      const accountId = crypto.randomUUID();
      const verificationDocumentPath = `${accountId}/verification.${allowedMimeTypes[mimeType]}`;
      let binary: Uint8Array;
      try {
        binary = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      } catch {
        return json({ error: 'Upload a valid ID photo or Certificate of Indigency image.' }, 400);
      }
      const isJpeg = binary[0] === 0xff && binary[1] === 0xd8 && binary[2] === 0xff;
      const isPng = binary.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10';
      const isWebp = String.fromCharCode(...binary.subarray(0, 4)) === 'RIFF'
        && String.fromCharCode(...binary.subarray(8, 12)) === 'WEBP';
      if (
        (mimeType === 'image/jpeg' && !isJpeg)
        || (mimeType === 'image/png' && !isPng)
        || (mimeType === 'image/webp' && !isWebp)
      ) {
        return json({ error: 'Upload a valid ID photo or Certificate of Indigency image.' }, 400);
      }
      const { error: uploadError } = await service.storage
        .from('account-verification')
        .upload(verificationDocumentPath, binary, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;

      const accountRow = {
        id: accountId,
        name,
        username,
        role,
        password_hash: passwordHash,
        barangay_position: barangayPosition || null,
        cp_number: String(body.cpNumber ?? '').trim(),
        address: String(body.address ?? '').trim(),
        registered_date: String(body.registeredDate ?? ''),
        verification_document_path: verificationDocumentPath,
        status: 'Pending',
      };

      const { data: insertedRow, error: accountError } = await service
        .from('accounts')
        .insert(accountRow)
        .select('*')
        .single();
      if (accountError || !insertedRow) {
        const { error: cleanupError } = await service.storage
          .from('account-verification')
          .remove([verificationDocumentPath]);
        if (cleanupError) console.error('[username-auth] failed to remove unclaimed verification photo:', cleanupError);
        if (accountError?.code === '23505') return json({ error: 'That username is already in use.' }, 409);
        throw accountError ?? new Error('Unable to save the account request.');
      }
      let savedRow = insertedRow;
      if (savedRow.verification_document_path !== verificationDocumentPath) {
        const { data: updatedRow, error: updateError } = await service
          .from('accounts')
          .update({ verification_document_path: verificationDocumentPath })
          .eq('id', accountId)
          .select('*')
          .single();
        if (updateError) {
          console.error('[username-auth] failed to persist verification photo path:', updateError);
        } else if (updatedRow) {
          savedRow = updatedRow;
        }
      }
      if (savedRow.verification_document_path !== verificationDocumentPath) {
        const { error: accountCleanupError } = await service
          .from('accounts')
          .delete()
          .eq('id', accountId);
        if (accountCleanupError) {
          console.error('[username-auth] failed to remove account without verification path:', accountCleanupError);
        }
        const { error: photoCleanupError } = await service.storage
          .from('account-verification')
          .remove([verificationDocumentPath]);
        if (photoCleanupError) {
          console.error('[username-auth] failed to remove unlinked verification photo:', photoCleanupError);
        }
        return json({
          error: 'The photo uploaded, but its database reference was not saved. Please try again later or contact the administrator.',
        }, 500);
      }

      const { error: notificationError } = await service.from('notifications').insert({
        id: `notif-${crypto.randomUUID()}`,
        title: 'New Account Requested',
        description: `"${name}" requested access. Verification required.`,
        date: new Date().toISOString(),
        type: 'system',
        is_read: false,
        target_view: 'admin-resident-approvals',
        target_id: savedRow.id,
        audience: 'admin',
      });
      if (notificationError) console.error('[username-auth] account created but request notification failed:', notificationError);

      return json({ account: toAccount(savedRow as AccountRow) }, 201);
    }

    if (action === 'create-resident-account') {
      const creator = await findSessionAccount(service, request);
      if (creator?.role !== 'admin' || creator.status !== 'Approved') {
        return json({ error: 'Only an approved barangay admin can create resident accounts.' }, 403);
      }

      const username = String(body.username ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const name = String(body.name ?? '').trim();
      const cpNumber = String(body.cpNumber ?? '').trim();
      const address = String(body.address ?? '').trim();
      const registeredDate = String(body.registeredDate ?? '').trim();

      if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
        return json({ error: 'Username must be 3–30 letters, numbers, dots, underscores, or hyphens.' }, 400);
      }
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      if (new TextEncoder().encode(password).length > 72) {
        return json({ error: 'Password must be 72 bytes or fewer.' }, 400);
      }
      if (!name) return json({ error: 'Full name is required.' }, 400);
      if (!/^09\d{2}-?\d{3}-?\d{4}$/.test(cpNumber.replace(/\s/g, ''))) {
        return json({ error: 'Use contact number format: 09XX-XXX-XXXX.' }, 400);
      }
      if (!address) return json({ error: 'Address is required.' }, 400);

      const { data: passwordHash, error: hashError } = await service.rpc('hash_account_password', {
        password_input: password,
      });
      if (hashError || typeof passwordHash !== 'string') throw hashError ?? new Error('Unable to hash password.');

      const { data: insertedAccount, error: insertError } = await service
        .from('accounts')
        .insert({
          id: crypto.randomUUID(),
          name,
          username,
          role: 'resident',
          password_hash: passwordHash,
          cp_number: cpNumber,
          address,
          registered_date: registeredDate,
          status: 'Approved',
        })
        .select('*')
        .single();
      if (insertError?.code === '23505') return json({ error: 'That username is already in use.' }, 409);
      if (insertError || !insertedAccount) throw insertError ?? new Error('Unable to create resident account.');

      const { error: auditError } = await service.from('admin_audit_log').insert({
        actor_id: creator.id,
        actor_name: creator.name,
        action: 'resident-account.created',
        entity_id: insertedAccount.id,
        details: { username: insertedAccount.username },
      });
      if (auditError) console.error('[username-auth] resident account created but audit write failed:', auditError);

      return json({ account: toAccount(insertedAccount as AccountRow) }, 201);
    }

    if (action === 'login') {
      const username = String(body.username ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!/^[a-z0-9._-]{3,30}$/.test(username) || !password) {
        return json({ error: 'Enter a valid username and password.' }, 400);
      }
      if (new TextEncoder().encode(password).length > 72) {
        return json({ error: 'Password must be 72 bytes or fewer.' }, 400);
      }

      const clientIp = request.headers.get('cf-connecting-ip')
        ?? request.headers.get('x-real-ip')
        ?? request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
        ?? 'unknown';
      const ipHash = await hashToken(clientIp);
      const { data: attemptAllowed, error: attemptError } = await service.rpc('consume_account_login_attempt', {
        username_input: username,
        ip_hash_input: ipHash,
      });
      if (attemptError) throw attemptError;
      if (attemptAllowed !== true) {
        return json({ error: 'Too many login attempts. Please wait 15 minutes and try again.' }, 429);
      }

      const { data: passwordMatches, error: verifyError } = await service.rpc('verify_account_password', {
        username_input: username,
        password_input: password,
      });
      if (verifyError) throw verifyError;
      if (passwordMatches !== true) return json({ error: 'Invalid username or password.' }, 401);

      const { error: clearAttemptsError } = await service
        .from('account_login_attempts')
        .delete()
        .eq('username', username)
        .eq('ip_hash', ipHash);
      if (clearAttemptsError) throw clearAttemptsError;

      const { data: account, error: accountError } = await service
        .from('accounts')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account) return json({ error: 'Invalid username or password.' }, 401);
      if (account.status === 'Pending') return json({ error: 'Your account is pending approval by the Barangay.' }, 403);
      if (account.status === 'Blocked') {
        const blockedUntil = account.blocked_until ? new Date(account.blocked_until).getTime() : 0;
        if (blockedUntil > Date.now()) {
          return json({
            error: `Your account is temporarily blocked until ${new Date(blockedUntil).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}.`,
          }, 403);
        }
        await service.from('accounts').update({ status: 'Approved', blocked_until: null, rejection_reason: null }).eq('id', account.id);
      }
      if (account.status === 'Rejected') {
        return json({
          error: `Your account was rejected. Reason: ${account.rejection_reason || 'Contact the barangay admin.'}`,
        }, 403);
      }
      if (account.status !== 'Approved') return json({ error: 'Your account is not approved.' }, 403);

      const { error: expiredSessionsError } = await service
        .from('account_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString());
      if (expiredSessionsError) throw expiredSessionsError;

      const sessionToken = createToken();
      const { error: sessionError } = await service.from('account_sessions').insert({
        account_id: account.id,
        token_hash: await hashToken(sessionToken),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (sessionError) throw sessionError;

      const accountData = toAccount(account as AccountRow);
      const response: { session_token: string; account: ReturnType<typeof toAccount>; accounts?: ReturnType<typeof toAccount>[] } = {
        session_token: sessionToken,
        account: accountData,
      };
      if (account.role === 'admin') {
        const { data: adminAccounts, error: adminAccountsError } = await service
          .from('accounts')
          .select('*')
          .order('created_at', { ascending: false });
        if (adminAccountsError) throw adminAccountsError;
        response.accounts = (adminAccounts ?? []).map((row) => toAccount(row as AccountRow));
      }
      return json(response);
    }

    if (action === 'session') {
      const account = await findSessionAccount(service, request);
      if (!account) return json({ error: 'Invalid or expired session.' }, 401);
      if (account.status !== 'Approved') return json({ error: 'Account is not approved.' }, 403);

      const response: { account: ReturnType<typeof toAccount>; accounts?: ReturnType<typeof toAccount>[] } = {
        account: toAccount(account as AccountRow),
      };
      if (account.role === 'admin') {
        const { data: adminAccounts, error: adminAccountsError } = await service
          .from('accounts')
          .select('*')
          .order('created_at', { ascending: false });
        if (adminAccountsError) throw adminAccountsError;
        response.accounts = (adminAccounts ?? []).map((row) => toAccount(row as AccountRow));
      }
      return json(response);
    }

    if (action === 'search-approved-residents') {
      const account = await findSessionAccount(service, request);
      if (!account || account.status !== 'Approved') {
        return json({ error: 'Sign in with an approved account to search residents.' }, 401);
      }
      const query = String(body.query ?? '').trim();
      if (query.length < 2) return json({ accounts: [] });

      const { data: residents, error: residentsError } = await service
        .from('accounts')
        .select('id, name, address')
        .eq('role', 'resident')
        .eq('status', 'Approved')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(20);
      if (residentsError) throw residentsError;
      return json({ accounts: (residents ?? []).map((resident) => ({
        id: resident.id,
        name: resident.name,
        address: resident.address ?? '',
      })) });
    }

    if (action === 'update-profile') {
      const account = await findSessionAccount(service, request);
      if (!account || account.status !== 'Approved') {
        return json({ error: 'Sign in with an approved account to update your profile.' }, 401);
      }
      if (account.role !== 'resident') {
        return json({ error: 'Only resident accounts can update their profile.' }, 403);
      }

      const nextUsername = String(body.username ?? account.username).trim().toLowerCase();
      const nextPassword = typeof body.password === 'string' ? body.password : undefined;

      if (nextUsername && !/^[a-z0-9._-]{3,30}$/.test(nextUsername)) {
        return json({ error: 'Username must be 3–30 letters, numbers, dots, underscores, or hyphens.' }, 400);
      }

      if (nextPassword !== undefined && nextPassword.length < 8) {
        return json({ error: 'Password must be at least 8 characters.' }, 400);
      }
      if (nextPassword !== undefined && new TextEncoder().encode(nextPassword).length > 72) {
        return json({ error: 'Password must be 72 bytes or fewer.' }, 400);
      }

      const usernameChanged = nextUsername && nextUsername !== account.username;
      let usernameConflict = null as any;
      if (usernameChanged) {
        const { data: conflict, error: usernameError } = await service
          .from('accounts')
          .select('id')
          .eq('username', nextUsername)
          .maybeSingle();
        if (usernameError) throw usernameError;
        usernameConflict = conflict;
      }
      if (usernameConflict) return json({ error: 'That username is already in use.' }, 409);

      const updates: Record<string, unknown> = {};
      if (usernameChanged) updates.username = nextUsername;
      if (nextPassword !== undefined) {
        const { data: passwordHash, error: hashError } = await service.rpc('hash_account_password', {
          password_input: nextPassword,
        });
        if (hashError || typeof passwordHash !== 'string') throw hashError ?? new Error('Unable to hash password.');
        updates.password_hash = passwordHash;
      }

      const { data: updatedAccount, error: updateError } = await service
        .from('accounts')
        .update(updates)
        .eq('id', account.id)
        .select('*')
        .single();
      if (updateError || !updatedAccount) throw updateError ?? new Error('Unable to update your profile.');

      return json({ account: toAccount(updatedAccount as AccountRow) });
    }

    if (action === 'my-anonymous-report-ids') {
      const account = await findSessionAccount(service, request);
      if (!account || account.status !== 'Approved') {
        return json({ error: 'Sign in with an approved account to view your reports.' }, 401);
      }
      if (account.role !== 'resident') {
        return json({ error: 'This action is only available to resident accounts.' }, 403);
      }

      const { data: identities, error: identitiesError } = await service
        .from('complaint_reporter_identities')
        .select('report_id')
        .eq('account_id', account.id);
      if (identitiesError) throw identitiesError;

      return json({ reportIds: (identities ?? []).map((identity) => identity.report_id) });
    }

    if (action === 'verification-document') {
      const reviewer = await findSessionAccount(service, request);
      if (reviewer?.role !== 'admin' || reviewer.status !== 'Approved') {
        return json({ error: 'Only an approved admin can view verification documents.' }, 403);
      }

      const accountId = String(body.accountId ?? '');
      if (!accountId) return json({ error: 'A valid account ID is required.' }, 400);
      const { data: account, error: accountError } = await service
        .from('accounts')
        .select('verification_document_path')
        .eq('id', accountId)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account?.verification_document_path) {
        return json({ error: 'No verification document was uploaded for this account.' }, 404);
      }

      const { data: signedUrl, error: signedUrlError } = await service.storage
        .from('account-verification')
        .createSignedUrl(account.verification_document_path, 300);
      if (signedUrlError) throw signedUrlError;
      return json({ url: signedUrl.signedUrl });
    }

    if (action === 'logout') {
      const token = request.headers.get('x-account-session')?.trim();
      if (!token) return json({ error: 'Authentication required.' }, 401);
      const { error: deleteError } = await service
        .from('account_sessions')
        .delete()
        .eq('token_hash', await hashToken(token));
      if (deleteError) throw deleteError;
      return json({ success: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    console.error('[username-auth] request failed:', error);
    return json({ error: 'Unable to process the request. Please try again.' }, 500);
  }
});
