import { createServiceClient, findApprovedAccount } from '../_shared/account-session.ts';

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

function isAdmin(account: { role: string; status: string }): boolean {
  return account.role === 'admin' && account.status === 'Approved';
}

async function writeAudit(
  service: ReturnType<typeof createServiceClient>,
  actor: { id: string; name: string },
  action: string,
  entityId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await service.from('admin_audit_log').insert({
    actor_id: actor.id,
    actor_name: actor.name,
    action,
    entity_id: entityId,
    details,
  });
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const account = await findApprovedAccount(request);
    if (!account) return json({ error: 'Sign in with an approved account to continue.' }, 401);

    const body = await request.json();
    const service = createServiceClient();

    if (body.action === 'upload-report-evidence') {
      const mimeType = String(body.mimeType ?? '');
      const extensionByMime: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };
      const extension = extensionByMime[mimeType];
      const base64 = String(body.base64 ?? '');
      if (!extension || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
        return json({ error: 'A valid evidence photo is required.' }, 400);
      }
      const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
      const byteLength = Math.floor(base64.length * 3 / 4) - padding;
      if (byteLength > 5 * 1024 * 1024) return json({ error: 'Choose an image smaller than 5 MB.' }, 400);

      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      } catch {
        return json({ error: 'A valid evidence photo is required.' }, 400);
      }
      const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isPng = bytes.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10';
      const isWebp = String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
        && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
      if (
        (mimeType === 'image/jpeg' && !isJpeg)
        || (mimeType === 'image/png' && !isPng)
        || (mimeType === 'image/webp' && !isWebp)
      ) {
        return json({ error: 'The evidence photo file does not match its image type.' }, 400);
      }

      const path = `${account.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await service.storage.from('report-evidence').upload(path, bytes, {
        contentType: mimeType,
        upsert: false,
      });
      if (error) throw error;
      return json({ path }, 201);
    }

    if (body.action === 'get-report-evidence-url') {
      const path = String(body.path ?? '');
      if (!/^[A-Za-z0-9_-]{1,100}\/[A-Za-z0-9-]{36}\.(jpg|png|webp)$/.test(path)) {
        return json({ error: 'A valid evidence photo path is required.' }, 400);
      }
      if (account.role !== 'admin' && !path.startsWith(`${account.id}/`)) {
        const { data: linkedSummons, error: linkedSummonsError } = await service.rpc('get_linked_summon_ids', {
          p_account_id: account.id,
          p_evidence_path: path,
        });
        if (linkedSummonsError) throw linkedSummonsError;
        if (!linkedSummons?.length) return json({ error: 'You are not authorized to view this evidence photo.' }, 403);
      }
      const { data, error } = await service.storage.from('report-evidence').createSignedUrl(path, 300);
      if (error) throw error;
      return json({ url: data.signedUrl });
    }

    if (body.action === 'fetch-community-case-stats') {
      if (account.role !== 'resident') {
        return json({ error: 'Community case statistics are only available to residents.' }, 403);
      }

      const countNormalComplaints = (status?: string) => {
        const query = service
          .from('complaints')
          .select('id', { count: 'exact', head: true })
          .neq('priority', 'Summon');
        return status ? query.eq('status', status) : query;
      };
      const [total, pending, investigating, resolved] = await Promise.all([
        countNormalComplaints(),
        countNormalComplaints('Pending'),
        countNormalComplaints('Investigating'),
        countNormalComplaints('Resolved'),
      ]);
      for (const result of [total, pending, investigating, resolved]) {
        if (result.error) throw result.error;
      }

      return json({
        totalCount: total.count ?? 0,
        activeCount: (pending.count ?? 0) + (investigating.count ?? 0),
        resolvedCount: resolved.count ?? 0,
      });
    }

    if (body.action === 'fetch-reports') {
      if (account.role === 'admin') {
        const [complaintsResult, summonsResult] = await Promise.all([
          service.from('complaints').select('*').order('created_at', { ascending: false }),
          service.from('summons').select('*').order('created_at', { ascending: false }),
        ]);
        if (complaintsResult.error) throw complaintsResult.error;
        if (summonsResult.error) throw summonsResult.error;
        return json({ complaints: complaintsResult.data ?? [], summons: summonsResult.data ?? [] });
      }

      const { data: identities, error: identitiesError } = await service
        .from('complaint_reporter_identities')
        .select('report_id')
        .eq('account_id', account.id);
      if (identitiesError) throw identitiesError;
      const identityIds = (identities ?? []).map((identity) => identity.report_id);
      const complaintQueries = [
        service.from('complaints').select('*').eq('reported_by', account.name),
        ...(identityIds.length
          ? [service.from('complaints').select('*').in('id', identityIds)]
          : []),
      ];
      const { data: linkedSummonIds, error: linkedSummonIdsError } = await service.rpc('get_linked_summon_ids', {
        p_account_id: account.id,
        p_evidence_path: null,
      });
      if (linkedSummonIdsError) throw linkedSummonIdsError;
      const linkedIds = (linkedSummonIds ?? []).map((row) => row.summon_id);
      const [complaintResults, summonsResult] = await Promise.all([
        Promise.all(complaintQueries),
        Promise.all([
          service.from('summons').select('*').eq('reported_by', account.name),
          ...(linkedIds.length
            ? [service.from('summons').select('*').in('id', linkedIds)]
            : []),
        ]),
      ]);
      for (const result of complaintResults) if (result.error) throw result.error;
      for (const result of summonsResult) if (result.error) throw result.error;
      const complaintsById = new Map<string, Record<string, unknown>>();
      for (const result of complaintResults) {
        for (const row of result.data ?? []) complaintsById.set(row.id, row);
      }
      const summonsById = new Map<string, Record<string, unknown>>();
      const summonedPartyIds = new Set(linkedIds);
      for (const result of summonsResult) {
        for (const row of result.data ?? []) summonsById.set(row.id, row);
      }
      const residentSummons = Array.from(summonsById.values()).map((row) => ({
        ...row,
        is_summoned_party: summonedPartyIds.has(row.id),
        summoned_persons: Array.isArray(row.summoned_persons)
          ? row.summoned_persons.map((person: Record<string, unknown>) => {
            const { accountId: _accountId, ...details } = person;
            return details;
          })
          : row.summoned_persons,
      }));
      return json({ complaints: Array.from(complaintsById.values()), summons: residentSummons });
    }

    if (body.action === 'fetch-hearing-bookings') {
      if (!isAdmin(account)) {
        return json({ error: 'Only an approved admin can view hearing bookings.' }, 403);
      }
      const { data, error } = await service
        .from('summons')
        .select('id, hearing_slot_date, hearing_slot_time')
        .not('hearing_slot_date', 'is', null)
        .not('hearing_slot_time', 'is', null);
      if (error) throw error;
      return json({
        bookings: (data ?? []).map((booking) => ({
          id: booking.id,
          date: booking.hearing_slot_date,
          time: booking.hearing_slot_time,
        })),
      });
    }

    if (body.action === 'fetch-notifications') {
      const audiences = account.role === 'admin'
        ? ['admin', account.name, account.id]
        : ['residents', account.name, account.id];
      const { data, error } = await service
        .from('notifications')
        .select('*')
        .in('audience', audiences)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return json({ notifications: data ?? [] });
    }

    if (body.action === 'insert-notification') {
      const notification = body.notification;
      if (!notification || typeof notification !== 'object' || !notification.id || !notification.title) {
        return json({ error: 'A valid notification is required.' }, 400);
      }
      const audience = String(notification.audience ?? '');
      if (account.role !== 'admin' && audience !== 'admin') {
        return json({ error: 'Residents may only send administrative notifications.' }, 403);
      }
      if (account.role === 'admin' && audience !== 'admin' && audience !== 'residents') {
        let { data: recipient, error: recipientError } = await service
          .from('accounts')
          .select('id')
          .eq('id', audience)
          .eq('status', 'Approved')
          .limit(1)
          .maybeSingle();
        if (recipientError) throw recipientError;
        if (!recipient) {
          const result = await service
            .from('accounts')
            .select('id')
            .eq('name', audience)
            .eq('status', 'Approved')
            .limit(1)
            .maybeSingle();
          recipient = result.data;
          recipientError = result.error;
        }
        if (recipientError) throw recipientError;
        if (!recipient) return json({ error: 'The notification recipient is not an approved account.' }, 400);
      }
      const { error } = await service.from('notifications').insert(notification);
      if (error) throw error;
      return json({ success: true }, 201);
    }

    if (body.action === 'mark-notification-read' || body.action === 'mark-notifications-read') {
      const ids = body.action === 'mark-notification-read' ? [body.id] : body.ids;
      if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
        return json({ error: 'At least one notification ID is required.' }, 400);
      }
      const audiences = account.role === 'admin'
        ? ['admin', account.name, account.id]
        : ['residents', account.name, account.id];
      const { data, error } = await service
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids)
        .in('audience', audiences)
        .select('id');
      if (error) throw error;
      if (!data?.length) return json({ error: 'No matching notification was found for this account.' }, 404);
      return json({ success: true });
    }

    if (body.action === 'insert-report' || body.action === 'update-report') {
      if (!isAdmin(account)) return json({ error: 'Only an approved admin can manage report records.' }, 403);
      const report = body.report;
      if (!report || typeof report !== 'object' || typeof report.id !== 'string') {
        return json({ error: 'A valid report is required.' }, 400);
      }
      const table = report.priority === 'Summon' ? 'summons' : 'complaints';
      const result = body.action === 'insert-report'
        ? await service.from(table).insert(report)
        : await service.from(table).update(report).eq('id', report.id).select('id').maybeSingle();
      const { error } = result;
      if (error) {
        if (
          body.action === 'update-report'
          && error.code === '23505'
          && error.message?.includes('summons_hearing_slot_unique_idx')
        ) {
          return json({ error: 'That hearing time was just booked for another summon. Choose an available time.' }, 409);
        }
        throw error;
      }
      if (body.action === 'update-report' && !result.data) {
        return json({ error: 'The report could not be found and was not updated.' }, 404);
      }
      if (body.action === 'update-report') {
        await writeAudit(service, account, 'report.updated', report.id, {
          assignee: report.assignee ?? null,
          status: report.status ?? null,
          summonNoticeStage: report.summon_notice_stage ?? null,
        });
      }
      return json({ success: true });
    }

    if (body.action === 'assign-reports') {
      if (!isAdmin(account)) return json({ error: 'Only an approved admin can assign reports.' }, 403);
      const reportIds = body.reportIds;
      const assignee = String(body.assignee ?? '').trim();
      if (
        !Array.isArray(reportIds)
        || reportIds.length === 0
        || reportIds.length > 100
        || reportIds.some((id) => typeof id !== 'string' || !id.trim())
        || !assignee
      ) {
        return json({ error: 'Select a valid report group and assignee.' }, 400);
      }
      if (assignee !== 'Unassigned') {
        const { data: assigneeAccount, error: assigneeError } = await service
          .from('accounts')
          .select('id')
          .eq('name', assignee)
          .eq('role', 'admin')
          .eq('status', 'Approved')
          .limit(1)
          .maybeSingle();
        if (assigneeError) throw assigneeError;
        if (!assigneeAccount) return json({ error: 'The assignee is not an approved admin account.' }, 400);
      }
      const { data: updatedCount, error } = await service.rpc('assign_reports', {
        p_report_ids: Array.from(new Set(reportIds as string[])),
        p_assignee: assignee,
      });
      if (error) throw error;
      await writeAudit(service, account, 'report.assigned', Array.from(new Set(reportIds as string[])).join(','), {
        assignee,
        reportCount: updatedCount,
      });
      return json({ success: true, updatedCount });
    }

    if (body.action === 'set-group-status') {
      if (!isAdmin(account)) return json({ error: 'Only an approved admin can update report status.' }, 403);
      const groupId = String(body.groupId ?? '');
      const status = body.status;
      if (!groupId || !['Pending', 'Investigating', 'Resolved', 'Rejected'].includes(status)) {
        return json({ error: 'A valid report group and status are required.' }, 400);
      }
      const { error } = await service.rpc('set_group_status', {
        p_group_id: groupId,
        p_status: status,
        p_note: String(body.note ?? ''),
        p_reason: typeof body.reason === 'string' ? body.reason : null,
      });
      if (error) throw error;
      await writeAudit(service, account, 'report.group-status-updated', groupId, { status });
      return json({ success: true });
    }

    if (body.action === 'insert-announcement') {
      if (!isAdmin(account)) return json({ error: 'Only an approved admin can publish announcements.' }, 403);
      const announcement = body.announcement;
      if (!announcement || typeof announcement !== 'object' || !announcement.id || !announcement.title) {
        return json({ error: 'A valid announcement is required.' }, 400);
      }
      const { error } = await service.from('announcements').insert(announcement);
      if (error) throw error;
      await writeAudit(service, account, 'announcement.created', String(announcement.id), { title: announcement.title });
      return json({ success: true }, 201);
    }

    if (body.action === 'update-announcement') {
      if (!isAdmin(account)) return json({ error: 'Only an approved admin can edit announcements.' }, 403);
      const announcement = body.announcement;
      if (!announcement || typeof announcement !== 'object' || !announcement.id || !announcement.title) {
        return json({ error: 'A valid announcement is required.' }, 400);
      }
      const { data, error } = await service
        .from('announcements')
        .update(announcement)
        .eq('id', announcement.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'The announcement could not be found.' }, 404);
      await writeAudit(service, account, 'announcement.updated', String(announcement.id), { title: announcement.title });
      return json({ success: true });
    }

    if (body.action === 'delete-announcement') {
      if (!isAdmin(account)) return json({ error: 'Only an approved admin can delete announcements.' }, 403);
      const id = String(body.id ?? '');
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return json({ error: 'A valid announcement ID is required.' }, 400);
      const { data, error } = await service
        .from('announcements')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ success: true, alreadyDeleted: true });
      await writeAudit(service, account, 'announcement.deleted', id);
      return json({ success: true });
    }

    if (body.action === 'upload-announcement-image') {
      if (!isAdmin(account)) return json({ error: 'Only an approved admin can upload announcement images.' }, 403);
      const announcementId = String(body.announcementId ?? '');
      const mimeType = String(body.mimeType ?? '');
      const extensionByMime: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };
      const extension = extensionByMime[mimeType];
      const base64 = String(body.base64 ?? '');
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(announcementId)
        || !extension
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
        || base64.length % 4 !== 0
      ) {
        return json({ error: 'A valid announcement image is required.' }, 400);
      }
      const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
      const byteLength = Math.floor(base64.length * 3 / 4) - padding;
      if (byteLength > 5 * 1024 * 1024) return json({ error: 'Choose an image smaller than 5 MB.' }, 400);
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      } catch {
        return json({ error: 'A valid announcement image is required.' }, 400);
      }
      const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isPng = bytes.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10';
      const isWebp = String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
        && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
      if (
        (mimeType === 'image/jpeg' && !isJpeg)
        || (mimeType === 'image/png' && !isPng)
        || (mimeType === 'image/webp' && !isWebp)
      ) {
        return json({ error: 'A valid announcement image is required.' }, 400);
      }
      const path = `announcements/${announcementId}.${extension}`;
      const { error } = await service.storage.from('announcement-images').upload(path, bytes, {
        contentType: mimeType,
        upsert: true,
      });
      if (error) throw error;
      const url = service.storage.from('announcement-images').getPublicUrl(path).data.publicUrl;
      return json({ url }, 201);
    }

    if (body.action === 'fetch-audit-events') {
      if (!isAdmin(account)) return json({ error: 'Only an approved admin can view the audit log.' }, 403);
      const { data, error } = await service
        .from('admin_audit_log')
        .select('id, actor_name, action, entity_id, details, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return json({ events: data ?? [] });
    }

    return json({ error: 'Unknown data action.' }, 400);
  } catch (error) {
    console.error('[app-data] request failed:', error);
    return json({ error: 'Unable to process the data request. Please try again.' }, 500);
  }
});
