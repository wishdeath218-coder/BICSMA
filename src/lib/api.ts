import { supabase } from './supabase';
import {
  ComplaintReport,
  Announcement,
  CivilNotification,
  ResidentAccount,
} from '../types';
import { DailyReportLimitError } from './reportLimit';

let accountSessionToken: string | null = null;

export function setAccountSessionToken(token: string | null): void {
  accountSessionToken = token;
}

function accountSessionHeaders(): Record<string, string> {
  return accountSessionToken ? { 'x-account-session': accountSessionToken } : {};
}

async function throwEdgeFunctionError(error: Error & { context?: unknown }): Promise<never> {
  const response = error.context;
  if (response instanceof Response) {
    let payload: {
      error?: unknown;
      code?: unknown;
      remaining?: unknown;
      resetAt?: unknown;
    } | undefined;
    try {
      payload = await response.clone().json();
    } catch {
      payload = undefined;
    }
    if (payload?.code === 'DAILY_REPORT_LIMIT' && typeof payload.error === 'string') {
      throw new DailyReportLimitError(
        payload.error,
        typeof payload.remaining === 'number' ? payload.remaining : 0,
        typeof payload.resetAt === 'string' ? payload.resetAt : undefined,
      );
    }
    if (typeof payload?.error === 'string') throw new Error(payload.error);
  }

  if (error.context instanceof Error && error.context.message) {
    throw new Error(`${error.message}: ${error.context.message}`);
  }
  throw error;
}

// ═══════════════════════════════════════════════════════════════════════════
// Row <-> Model mappers (DB uses snake_case, app uses camelCase)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Complaints ──────────────────────────────────────────────────────────────
function rowToComplaint(r: any): ComplaintReport {
  return {
    id: r.id,
    groupId: r.group_id ?? undefined,
    summary: r.summary ?? undefined,
    title: r.title,
    category: r.category,
    description: r.description,
    location: r.location,
    date: r.date,
    status: r.status,
    priority: r.priority,
    reportedBy: r.reported_by,
    assignee: r.assignee,
    evidencePhoto: r.evidence_photo ?? undefined,
    rejectionReason: r.rejection_reason ?? undefined,
    summonedPersonName: r.summoned_person_name ?? undefined,
    summonedPersonAddress: r.summoned_person_address ?? undefined,
    summonedPersons: r.summoned_persons ?? undefined,
    isSummonedParty: r.is_summoned_party ?? false,
    summonReason: r.summon_reason ?? undefined,
    summonNoticeStage: r.summon_notice_stage ?? undefined,
    hearingDate: r.hearing_date ?? undefined,
    hearingSlotDate: r.hearing_slot_date ?? undefined,
    hearingSlotTime: r.hearing_slot_time ?? undefined,
    hearingVenue: r.hearing_venue ?? undefined,
    luponOfficer: r.lupon_officer ?? undefined,
    summonNotes: r.summon_notes ?? undefined,
    timeline: r.timeline ?? [],
  };
}

function complaintToRow(c: ComplaintReport): any {
  const row = {
    id: c.id,
    title: c.title,
    category: c.category,
    description: c.description,
    location: c.location,
    date: c.date,
    status: c.status,
    priority: c.priority,
    reported_by: c.reportedBy,
    assignee: c.assignee,
    evidence_photo: c.evidencePhoto ?? null,
    timeline: c.timeline ?? [],
  };

  if (c.priority === 'Summon') {
    return {
      ...row,
      summoned_person_name: c.summonedPersonName ?? null,
      summoned_person_address: c.summonedPersonAddress ?? null,
      summoned_persons: c.summonedPersons ?? null,
      summon_reason: c.summonReason ?? null,
      summon_notice_stage: c.summonNoticeStage ?? null,
      hearing_date: c.hearingDate ?? null,
      hearing_slot_date: c.hearingSlotDate ?? null,
      hearing_slot_time: c.hearingSlotTime ?? null,
      hearing_venue: c.hearingVenue ?? null,
      lupon_officer: c.luponOfficer ?? null,
      summon_notes: c.summonNotes ?? [],
    };
  }

  return {
    ...row,
    group_id: c.groupId ?? c.id,
    summary: c.summary ?? null,
    rejection_reason: c.rejectionReason ?? null,
  };
}

// ─── Announcements ───────────────────────────────────────────────────────────
function rowToAnnouncement(r: any): Announcement {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    date: r.date,
    summary: r.summary,
    content: r.content,
    image: r.image ?? undefined,
    attachment: r.attachment ?? undefined,
    urgent: r.urgent ?? undefined,
    timeLeft: r.time_left ?? undefined,
    engagementCount: r.engagement_count ?? undefined,
  };
}

function announcementToRow(a: Announcement): any {
  return {
    id: a.id,
    title: a.title,
    type: a.type,
    date: a.date,
    summary: a.summary,
    content: a.content,
    image: a.image ?? null,
    attachment: a.attachment ?? null,
    urgent: a.urgent ?? false,
    time_left: a.timeLeft ?? null,
    engagement_count: a.engagementCount ?? 0,
  };
}

// ─── Notifications ───────────────────────────────────────────────────────────
function rowToNotification(r: any): CivilNotification {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    date: r.date,
    type: r.type,
    isRead: r.is_read,
    targetView: r.target_view ?? undefined,
    targetId: r.target_id ?? undefined,
    audience: r.audience ?? undefined,
  };
}

function notificationToRow(n: CivilNotification): any {
  return {
    id: n.id,
    title: n.title,
    description: n.description,
    date: n.date,
    type: n.type,
    is_read: n.isRead,
    target_view: n.targetView ?? null,
    target_id: n.targetId ?? null,
    audience: n.audience ?? 'admin',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// API — all functions throw on error so callers can handle/fallback
// ═══════════════════════════════════════════════════════════════════════════

export const api = {
  async appData<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('app-data', {
      body,
      headers: accountSessionHeaders(),
    });
    if (error) await throwEdgeFunctionError(error);
    if (data?.error) throw new Error(data.error);
    return data as T;
  },

  async usernameAuth<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('username-auth', {
      body,
      headers: accountSessionHeaders(),
    });
    if (error) await throwEdgeFunctionError(error);
    if (data?.error) throw new Error(data.error);
    return data as T;
  },

  async searchApprovedResidents(query: string): Promise<Array<Pick<ResidentAccount, 'id' | 'name' | 'address'>>> {
    const { accounts } = await this.usernameAuth<{
      accounts?: Array<Pick<ResidentAccount, 'id' | 'name' | 'address'>>;
    }>({ action: 'search-approved-residents', query });
    return accounts ?? [];
  },

  async getVerificationDocumentUrl(accountId: string): Promise<string> {
    const { url } = await this.usernameAuth<{ url: string }>({
      action: 'verification-document',
      accountId,
    });
    if (!url) throw new Error('Unable to resolve the verification document URL.');
    return url;
  },

  async reviewAccount(
    accountId: string,
    status: 'Approved' | 'Rejected',
    reason?: string,
  ): Promise<ResidentAccount> {
    const { data, error } = await supabase.functions.invoke('review-account', {
      body: { accountId, status, reason },
      headers: accountSessionHeaders(),
    });
    if (error) await throwEdgeFunctionError(error);
    if (data?.error) throw new Error(data.error);
    return data.account as ResidentAccount;
  },

  async createResidentAccount(account: {
    name: string;
    username: string;
    cpNumber: string;
    address: string;
    password: string;
    registeredDate: string;
  }): Promise<ResidentAccount> {
    const { account: createdAccount } = await this.usernameAuth<{ account: ResidentAccount }>({
      action: 'create-resident-account',
      ...account,
    });
    if (!createdAccount) throw new Error('The server did not return the created resident account.');
    return createdAccount;
  },

  // ── Complaints ──
  async fetchComplaints(): Promise<ComplaintReport[]> {
    const { complaints, summons } = await this.appData<{
      complaints: any[];
      summons: any[];
    }>({ action: 'fetch-reports' });
    return [...complaints, ...summons].map(rowToComplaint);
  },

  async fetchHearingBookings(): Promise<Array<{ id: string; date: string; time: string }>> {
    const { bookings } = await this.appData<{
      bookings: Array<{ id: string; date: string; time: string }>;
    }>({ action: 'fetch-hearing-bookings' });
    return bookings;
  },

  async fetchCommunityCaseStats(): Promise<{
    resolvedCount: number;
    activeCount: number;
    totalCount: number;
  }> {
    return this.appData({ action: 'fetch-community-case-stats' });
  },

  async uploadReportEvidence(
    mimeType: string,
    base64: string,
  ): Promise<string> {
    const { path } = await this.appData<{ path: string }>({
      action: 'upload-report-evidence',
      mimeType,
      base64,
    });
    if (!path) throw new Error('The evidence photo upload did not return a file path.');
    return path;
  },

  async getReportEvidenceUrl(path: string): Promise<string> {
    const { url } = await this.appData<{ url: string }>({
      action: 'get-report-evidence-url',
      path,
    });
    if (!url) throw new Error('The evidence photo request did not return a URL.');
    return url;
  },

  async insertComplaint(report: ComplaintReport): Promise<void> {
    await this.appData({ action: 'insert-report', report: complaintToRow(report) });
  },

  // ── AI summarize + duplicate detection + grouping ──
  // Calls the "check-duplicate" edge function. It ALWAYS inserts the complaint
  // server-side (each resident keeps their own row) with an AI summary + group_id.
  // The caller must NOT also call insertComplaint.
  async checkDuplicate(report: ComplaintReport): Promise<{
    isDuplicate: boolean;
    existingComplaint?: any;
    totalReporters?: number;
    summary?: string;
    groupId?: string;
    handledInsert: boolean; // edge function inserted it
  }> {
    const { data, error } = await supabase.functions.invoke('check-duplicate', {
      body: report,
      headers: accountSessionHeaders(),
    });
    if (error) await throwEdgeFunctionError(error);
    if (data?.error) throw new Error(data.error);
    return {
      isDuplicate: !!data.isDuplicate,
      existingComplaint: data.existingComplaint,
      totalReporters: data.totalReporters,
      summary: data.summary,
      groupId: data.groupId,
      handledInsert: true,
    };
  },

  async submitSummon(report: ComplaintReport): Promise<{
    dailyUsage?: { used: number; remaining: number; reset_at: string };
  }> {
    const { data, error } = await supabase.functions.invoke('submit-summon', {
      body: report,
      headers: accountSessionHeaders(),
    });
    if (error) await throwEdgeFunctionError(error);
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async updateComplaint(report: ComplaintReport): Promise<void> {
    await this.appData({ action: 'update-report', report: complaintToRow(report) });
  },

  // Cascade a status change to every complaint sharing a group_id.
  async setGroupStatus(
    groupId: string,
    status: ComplaintReport['status'],
    note: string,
    reason?: string,
  ): Promise<void> {
    await this.appData({
      action: 'set-group-status',
      groupId,
      status,
      note,
      reason: reason ?? null,
    });
  },

  // ── Announcements ──
  async fetchAnnouncements(): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToAnnouncement);
  },

  async insertAnnouncement(ann: Announcement): Promise<void> {
    await this.appData({ action: 'insert-announcement', announcement: announcementToRow(ann) });
  },

  async updateAnnouncement(ann: Announcement): Promise<void> {
    await this.appData({ action: 'update-announcement', announcement: announcementToRow(ann) });
  },

  async deleteAnnouncement(id: string): Promise<void> {
    await this.appData({ action: 'delete-announcement', id });
  },

  // ── Notifications ──
  async fetchNotifications(): Promise<CivilNotification[]> {
    const { notifications } = await this.appData<{ notifications: any[] }>({
      action: 'fetch-notifications',
    });
    return notifications.map(rowToNotification);
  },

  async insertNotification(n: CivilNotification): Promise<void> {
    await this.appData({ action: 'insert-notification', notification: notificationToRow(n) });
  },

  async markNotificationRead(id: string): Promise<void> {
    await this.appData({ action: 'mark-notification-read', id });
  },

  // Mark only a specific set of notifications as read (scoped to one audience).
  async markNotificationsRead(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.appData({ action: 'mark-notifications-read', ids });
  },

};
