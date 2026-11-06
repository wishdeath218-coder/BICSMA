import { createServiceClient, consumeDailyReportSlot, findApprovedAccount, releaseDailyReportSlot } from '../_shared/account-session.ts';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let reservedAccountId: string | null = null;
  let reservedReportId: string | null = null;
  try {
    const report = await request.json();
    if (!report.id || !report.title || !report.category || !report.description) {
      return json({ error: 'A report ID, title, category, and description are required.' }, 400);
    }
    if (report.reportType !== 'Summon' && report.priority !== 'Summon') {
      return json({ error: 'Only summon reports can be submitted here.' }, 400);
    }
    if (!Array.isArray(report.summonedPersons) || report.summonedPersons.length === 0) {
      return json({ error: 'Add at least one person to summon.' }, 400);
    }
    if (report.summonedPersons.some((person: { name?: string }) => !person.name?.trim())) {
      return json({ error: 'Enter a name for each person to summon.' }, 400);
    }

    const account = await findApprovedAccount(request);
    if (!account) return json({ error: 'Sign in with an approved account to submit a report.' }, 401);

    const submittedLinkedAccountIds: unknown[] = report.summonedPersons
      .map((person: { accountId?: unknown }) => person.accountId)
      .filter((accountId: unknown) => accountId !== undefined);
    if (submittedLinkedAccountIds.some((accountId) => typeof accountId !== 'string' || !accountId.trim())) {
      return json({ error: 'A valid linked resident account is required.' }, 400);
    }
    const linkedAccountIds = submittedLinkedAccountIds.filter((accountId): accountId is string => typeof accountId === 'string');

    const service = createServiceClient();
    const linkedAccounts = new Map<string, { name: string; address: string | null }>();
    if (linkedAccountIds.length) {
      const uniqueLinkedAccountIds = Array.from(new Set(linkedAccountIds));
      const { data: linkedRows, error: linkedError } = await service
        .from('accounts')
        .select('id, name, address')
        .in('id', uniqueLinkedAccountIds)
        .eq('role', 'resident')
        .eq('status', 'Approved');
      if (linkedError) throw linkedError;
      for (const linkedAccount of linkedRows ?? []) {
        linkedAccounts.set(linkedAccount.id, linkedAccount);
      }
      if (linkedAccounts.size !== uniqueLinkedAccountIds.length) {
        return json({ error: 'One or more linked residents are not approved accounts.' }, 400);
      }
    }

    let dailyUsage: { used: number; remaining: number; reset_at: string } | undefined;
    if (account.role === 'resident') {
      const slot = await consumeDailyReportSlot(account.id, String(report.id));
      if (!slot) throw new Error('Daily report counter returned no result.');
      if (!slot.allowed) {
        return json({
          error: 'You have reached the limit of 3 reports for today.',
          code: 'DAILY_REPORT_LIMIT',
          used: slot.used,
          remaining: slot.remaining,
          resetAt: slot.reset_at,
        }, 429);
      }
      reservedAccountId = account.id;
      reservedReportId = String(report.id);
      dailyUsage = { used: slot.used, remaining: slot.remaining, reset_at: slot.reset_at };
    }

    const respondents = report.summonedPersons.map((person: {
      name: string;
      address?: string;
      accountId?: string;
    }) => {
      const linkedAccount = person.accountId ? linkedAccounts.get(person.accountId) : undefined;
      return {
        name: linkedAccount?.name ?? person.name.trim(),
        address: linkedAccount?.address ?? person.address?.trim() ?? '',
        ...(linkedAccount ? { accountId: person.accountId } : {}),
      };
    });
    const { error } = await service.from('summons').insert({
      id: report.id,
      title: report.title,
      category: report.category,
      description: report.description,
      location: report.location ?? null,
      date: report.date ?? null,
      status: report.status ?? 'Pending',
      priority: 'Summon',
      reported_by: account.role === 'resident' ? account.name : report.reportedBy ?? null,
      assignee: report.assignee ?? 'Unassigned',
      evidence_photo: report.evidencePhoto ?? null,
      summoned_person_name: respondents[0]?.name ?? report.summonedPersonName ?? null,
      summoned_person_address: respondents[0]?.address ?? report.summonedPersonAddress ?? null,
      summoned_persons: respondents,
      summon_reason: report.summonReason ?? null,
      summon_notice_stage: report.summonNoticeStage ?? null,
      hearing_date: report.hearingDate ?? null,
      hearing_venue: report.hearingVenue ?? null,
      lupon_officer: report.luponOfficer ?? null,
      summon_notes: report.summonNotes ?? [],
      timeline: report.timeline ?? [],
    });
    if (error) throw error;

    reservedAccountId = null;
    reservedReportId = null;
    return json({ success: true, dailyUsage });
  } catch (error) {
    if (reservedAccountId && reservedReportId) {
      try {
        await releaseDailyReportSlot(reservedAccountId, reservedReportId);
      } catch (releaseError) {
        console.error('[submit-summon] failed to release report quota:', releaseError);
      }
    }
    console.error('[submit-summon] request failed:', error);
    return json({ error: 'Unable to submit the summon. Please try again.' }, 500);
  }
});
