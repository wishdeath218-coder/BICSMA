import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  ComplaintReport,
  Announcement,
  CivilNotification,
  ResidentAccount,
  TimelineItem,
} from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { api, setAccountSessionToken } from '../lib/api';
import { normalizeUsername } from '../lib/auth';
import { nowStamp } from '../utils/ui';
import { DAILY_REPORT_LIMIT, DailyReportLimitError, DailyReportUsage } from '../lib/reportLimit';

// Result returned when submitting a report through the AI duplicate check.
export interface SubmitResult {
  isDuplicate: boolean;
  existingReport?: ComplaintReport;
  totalReporters?: number;
  dailyUsage?: DailyReportUsage;
}

// When true, all data reads/writes go through Supabase. Otherwise AsyncStorage.
const USE_DB = isSupabaseConfigured;

// ─── Keys (session + local fallback data) ────────────────────────────────────
const KEYS = {
  loggedIn: 'bb_logged_in',
  userName: 'bb_user_name',
  userRole: 'bb_user_role',
  username: 'bb_username',
  accountId: 'bb_account_id',
  accountSessionToken: 'bb_account_session_token',
  reports: 'bb_reports',
  announcements: 'bb_announcements',
  notifications: 'bb_notifications',
  accounts: 'bb_accounts',
};

const SAMPLE_IDS = {
  reports: new Set(['#RP-1024', '#RP-1023', '#RP-1022', '#RP-1021', '#RP-1018', '#RP-1025', '#RP-1026', '#REP-8790', '#REP-8742']),
  announcements: new Set(['ann-1', 'ann-2', 'ann-3', 'ann-4', 'ann-5', 'ann-6']),
  accounts: new Set(['user-1', 'user-2', 'user-3', 'user-4']),
};

async function hashPassword(value: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    value.trim(),
  );
  return digest;
}

async function verifyPassword(value: string, storedHash?: string): Promise<boolean> {
  if (!value || !storedHash) return false;
  return (await hashPassword(value)) === storedHash;
}

async function normalizeAccountForStorage(account: ResidentAccount): Promise<ResidentAccount> {
  const next: ResidentAccount = { ...account };
  delete next.password;

  if (account.passwordHash) {
    next.passwordHash = account.passwordHash;
    return next;
  }

  if (account.password) {
    next.passwordHash = await hashPassword(account.password);
  }

  return next;
}

async function migrateStoredAccounts(accounts: ResidentAccount[]): Promise<ResidentAccount[]> {
  const normalized = await Promise.all(accounts.map(async (storedAccount) => {
    const legacyAccount = storedAccount as ResidentAccount & { email?: string };
    const { email: legacyEmail, ...account } = legacyAccount;
    const legacyUsername = legacyEmail?.split('@')[0];
    const next = await normalizeAccountForStorage({
      ...account,
      username: account.username || normalizeUsername(legacyUsername || account.id.replace(/[^a-z0-9._-]/gi, '').slice(0, 30)),
    });
    next.role = account.role === 'admin' ? 'admin' : 'resident';
    return next;
  }));

  return normalized;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AppContextValue {
  isLoggedIn: boolean;
  loggedInUser: string;
  loggedInUsername: string;
  loggedInAccountId: string;
  role: 'resident' | 'admin';
  login: (role: 'resident' | 'admin', name: string, username?: string, accountId?: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    account: ResidentAccount,
    verificationDocument?: { base64?: string; mimeType?: string; uri?: string },
  ) => Promise<{ success: boolean; message: string }>;
  tryLogin: (username: string, password: string) => Promise<{ success: boolean; message: string; accountName?: string; accountId?: string }>;

  reports: ComplaintReport[];
  addReport: (report: ComplaintReport) => Promise<void>;
  submitReport: (
    report: ComplaintReport,
    evidencePhoto?: { base64: string; mimeType: string },
  ) => Promise<SubmitResult>;
  updateReportStatus: (id: string, status: ComplaintReport['status'], reason?: string, notificationDescription?: string) => Promise<void>;
  updateFullReport: (report: ComplaintReport) => Promise<void>;
  assignReports: (reportIds: string[], assignee: string) => Promise<void>;
  updateGroupStatus: (groupId: string, status: ComplaintReport['status'], reason?: string, notificationDescription?: string) => Promise<void>;

  announcements: Announcement[];
  addAnnouncement: (ann: Announcement) => Promise<void>;
  updateAnnouncement: (ann: Announcement) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  uploadAnnouncementImage: (imageUri: string, base64: string, mimeType?: string, announcementId?: string) => Promise<string | undefined>;

  notifications: CivilNotification[];        // audience-filtered for the current user
  allNotifications: CivilNotification[];     // unfiltered (rarely needed)
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refreshNotificationData: () => Promise<ComplaintReport[]>;
  notifyResident: (residentName: string, title: string, description: string, targetId?: string) => Promise<void>;
  notifyAdmin: (adminName: string, title: string, description: string, targetId?: string, targetGroupId?: string) => Promise<void>;
  unreadCount: number;

  accounts: ResidentAccount[];
  createResidentAccount: (
    account: Partial<ResidentAccount> & Pick<ResidentAccount, 'name' | 'username' | 'cpNumber' | 'address'> & {
      password?: string;
      registeredDate?: string;
    },
  ) => Promise<ResidentAccount>;
  updateResidentProfile: (updates: { username?: string; password?: string }) => Promise<ResidentAccount>;
  updateAccountStatus: (id: string, status: 'Approved' | 'Rejected', reason?: string) => Promise<void>;
  getVerificationDocumentUrl: (accountId: string) => Promise<string | null>;
  blockAccountForFalseReport: (reporterName: string, reason?: string) => Promise<boolean>;
  getDailyReportUsage: () => Promise<DailyReportUsage>;

  isReady: boolean;
  usingDatabase: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function save(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState('');
  const [loggedInUsername, setLoggedInUsername] = useState('');
  const [loggedInAccountId, setLoggedInAccountId] = useState('');
  const [role, setRole] = useState<'resident' | 'admin'>('resident');

  const [reports, setReports] = useState<ComplaintReport[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<CivilNotification[]>([]);
  const [accounts, setAccounts] = useState<ResidentAccount[]>([]);

  const persistAccounts = useCallback(async (next: ResidentAccount[]) => {
    if (!USE_DB) {
      const sanitized = await Promise.all(next.map((account) => normalizeAccountForStorage(account)));
      await save(KEYS.accounts, sanitized);
    }
  }, []);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Session is always local (device-specific)
      const [loggedIn, userName, userRole, username, storedAccountId, accountSessionToken] = await Promise.all([
        AsyncStorage.getItem(KEYS.loggedIn),
        AsyncStorage.getItem(KEYS.userName),
        AsyncStorage.getItem(KEYS.userRole),
        AsyncStorage.getItem(KEYS.username),
        AsyncStorage.getItem(KEYS.accountId),
        AsyncStorage.getItem(KEYS.accountSessionToken),
      ]);
      if (USE_DB) {
        // ── Supabase path ──
        try {
          setAccountSessionToken(accountSessionToken);
          setAccounts([]);

          if (accountSessionToken) {
            try {
              const { account, accounts: adminAccounts } = await api.usernameAuth<{
                account: ResidentAccount;
                accounts?: ResidentAccount[];
              }>({ action: 'session' });
              if (account.status !== 'Approved') {
                throw new Error('The saved account session is not approved.');
              }
              const [dbReports, dbAnn, dbNotifs] = await Promise.all([
                api.fetchComplaints(),
                api.fetchAnnouncements(),
                api.fetchNotifications(),
              ]);
              const sessionRole = account.role;
              const name = account.name;
              setReports(dbReports);
              setAnnouncements(dbAnn);
              setNotifications(dbNotifs);
              setAccounts(adminAccounts ?? []);
              setIsLoggedIn(true);
              setLoggedInUser(name);
              setLoggedInUsername(account.username);
              setLoggedInAccountId(account.id);
              setRole(sessionRole);
              await Promise.all([
                save(KEYS.loggedIn, 'true'),
                save(KEYS.userName, name),
                save(KEYS.userRole, sessionRole),
                save(KEYS.username, account.username),
                save(KEYS.accountId, account.id),
              ]);
            } catch (e) {
              console.warn('[Supabase] restore account session failed:', e);
              setAccountSessionToken(null);
              setIsLoggedIn(false);
              setLoggedInAccountId('');
              await Promise.all([
                AsyncStorage.removeItem(KEYS.accountSessionToken),
                AsyncStorage.removeItem(KEYS.loggedIn),
                AsyncStorage.removeItem(KEYS.userName),
                AsyncStorage.removeItem(KEYS.userRole),
                AsyncStorage.removeItem(KEYS.username),
                AsyncStorage.removeItem(KEYS.accountId),
              ]);
            }
          } else {
            setIsLoggedIn(false);
            setLoggedInAccountId('');
            setReports([]);
            setNotifications([]);
            setAnnouncements(await api.fetchAnnouncements());
          }
        } catch (e) {
          console.warn('[Supabase] load failed:', e);
          setIsLoggedIn(false);
          setLoggedInAccountId('');
          setReports([]);
          setAnnouncements([]);
          setNotifications([]);
          setAccounts([]);
        }
      } else {
        // ── Local AsyncStorage path ──
        setIsLoggedIn(loggedIn === 'true');
        setLoggedInUser(userName || '');
        setLoggedInUsername(username || '');
        setRole((userRole as 'resident' | 'admin') || 'resident');
        const [savedReports, savedAnn, savedNotifs, savedAccounts] = await Promise.all([
          load<ComplaintReport[]>(KEYS.reports, []),
          load<Announcement[]>(KEYS.announcements, []),
          load<CivilNotification[]>(KEYS.notifications, []),
          load<ResidentAccount[]>(KEYS.accounts, []),
        ]);
        const realReports = savedReports.filter((report) => !SAMPLE_IDS.reports.has(report.id));
        const realAnnouncements = savedAnn.filter((announcement) => !SAMPLE_IDS.announcements.has(announcement.id));
        const migratedAccounts = await migrateStoredAccounts(savedAccounts.filter((account) => !SAMPLE_IDS.accounts.has(account.id)));
        const accountId = storedAccountId || migratedAccounts.find(
          (account) => normalizeUsername(account.username) === normalizeUsername(username || ''),
        )?.id || '';
        setReports(realReports);
        setAnnouncements(realAnnouncements);
        setNotifications(savedNotifs);
        setAccounts(migratedAccounts);
        setLoggedInAccountId(accountId);
        await Promise.all([
          save(KEYS.reports, realReports),
          save(KEYS.announcements, realAnnouncements),
          save(KEYS.accountId, accountId),
          persistAccounts(migratedAccounts),
        ]);
      }

      setIsReady(true);
    })();
  }, []);

  // ── Persist helpers (local only — DB writes happen inline) ──────────────────
  const persistReports = (next: ComplaintReport[]) => { if (!USE_DB) save(KEYS.reports, next); };
  const persistAnnouncements = (next: Announcement[]) => { if (!USE_DB) save(KEYS.announcements, next); };
  const persistNotifications = (next: CivilNotification[]) => { if (!USE_DB) save(KEYS.notifications, next); };

  // Push a notification (local state + DB if enabled)
  const pushNotification = useCallback(
    async (notif: CivilNotification, currentNotifs: CivilNotification[], throwOnError = false) => {
      if (USE_DB) {
        try {
          await api.insertNotification(notif);
        } catch (e) {
          console.warn('[Supabase] notif insert failed', e);
          if (throwOnError) throw e;
        }
      }
      const updated = [notif, ...currentNotifs];
      setNotifications((current) => {
        const next = [notif, ...current.filter((item) => item.id !== notif.id)];
        persistNotifications(next);
        return next;
      });
      return updated;
    },
    [],
  );

  // Fire a notification aimed at one specific resident (by account ID or name).
  // Used e.g. when an admin files a walk-in complaint on a resident's behalf.
  const notifyResident = useCallback(
    async (residentIdOrName: string, title: string, description: string, targetId?: string) => {
      const notif: CivilNotification = {
        id: `notif-${Date.now()}`,
        title,
        description,
        date: nowStamp(),
        type: 'report',
        isRead: false,
        targetView: 'my-reports',
        targetId,
        audience: residentIdOrName,
      };
      await pushNotification(notif, notifications, true);
    },
    [notifications, pushNotification],
  );

  const notifyAdmin = useCallback(
    async (adminName: string, title: string, description: string, targetId?: string, targetGroupId?: string) => {
      const notif: CivilNotification = {
        id: `notif-${Date.now()}`,
        title,
        description,
        date: nowStamp(),
        type: 'report',
        isRead: false,
        targetView: 'complaint-review',
        targetId,
        targetGroupId,
        audience: adminName,
      };
      await pushNotification(notif, notifications);
    },
    [notifications, pushNotification],
  );

  const uploadAnnouncementImage = useCallback(
    async (imageUri: string, base64: string, mimeType = 'image/jpeg', announcementId?: string) => {
      if (!imageUri) return undefined;
      if (USE_DB && isSupabaseConfigured) {
        if (!announcementId) throw new Error('An announcement ID is required to upload its image.');
        if (!base64) throw new Error('The selected photo could not be read. Please choose it again.');
        const { url } = await api.appData<{ url: string }>({
          action: 'upload-announcement-image',
          announcementId,
          mimeType,
          base64,
        });
        if (!url) throw new Error('The image upload did not return a public URL.');
        return url;
      }
      return imageUri;
    },
    [],
  );

  const getDailyReportUsage = useCallback(async (): Promise<DailyReportUsage> => {
    const todayKey = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const used = reports.filter((report) => {
      const isToday = report.date?.startsWith(todayKey);
      const isCurrentReporter = !loggedInUser || report.reportedBy === loggedInUser || report.reportedBy === loggedInUsername;
      return isToday && isCurrentReporter;
    }).length;

    const remaining = Math.max(DAILY_REPORT_LIMIT - used, 0);
    return {
      used,
      remaining,
      limit: DAILY_REPORT_LIMIT,
      resetAt: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
    };
  }, [loggedInUser, loggedInUsername, reports]);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const tryLogin = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; message: string; accountName?: string; accountId?: string }> => {
      const normalizedUsername = normalizeUsername(username);

      if (USE_DB && isSupabaseConfigured) {
        try {
          const result = await api.usernameAuth<{
            session_token: string;
            account: ResidentAccount;
            accounts?: ResidentAccount[];
          }>({
            action: 'login',
            username: normalizedUsername,
            password,
          });
          if (!result.session_token || !result.account) {
            throw new Error('Login response did not include an account session.');
          }
          setAccountSessionToken(result.session_token);
          try {
            await AsyncStorage.setItem(KEYS.accountSessionToken, result.session_token);
          } catch (storageError) {
            setAccountSessionToken(null);
            throw storageError;
          }
          const [dbReports, dbAnn, dbNotifs] = await Promise.all([
            api.fetchComplaints(),
            api.fetchAnnouncements(),
            api.fetchNotifications(),
          ]);
          setReports(dbReports);
          setAnnouncements(dbAnn);
          setNotifications(dbNotifs);
          setAccounts(result.accounts ?? []);
          return {
            success: true,
            message: result.account.role,
            accountName: result.account.name,
            accountId: result.account.id,
          };
        } catch (e) {
          console.warn('[Supabase] auth login failed:', e);
          setAccountSessionToken(null);
          await AsyncStorage.removeItem(KEYS.accountSessionToken);
          return {
            success: false,
            message: e instanceof Error ? e.message : 'Unable to sign in. Please try again.',
          };
        }
      }

      const account = accounts.find((a) => normalizeUsername(a.username) === normalizedUsername);
      if (!account) return { success: false, message: 'No account found with that username.' };
      if (account.status === 'Pending')
        return { success: false, message: 'Your account is pending approval by the Barangay.' };
      if (account.status === 'Rejected')
        return {
          success: false,
          message: `Your account was rejected. Reason: ${account.rejectionReason || 'Contact barangay admin.'}`,
        };

      const storedPassword = account.passwordHash ?? account.password;
      const isMatch = storedPassword
        ? account.passwordHash
          ? await verifyPassword(password, account.passwordHash)
          : (await hashPassword(password)) === (await hashPassword(account.password || ''))
        : false;

      if (!isMatch) return { success: false, message: 'Incorrect password.' };

      if (account.password && !account.passwordHash) {
        const nextHash = await hashPassword(account.password);
        const updated = accounts.map((item) =>
          item.id === account.id ? { ...item, passwordHash: nextHash, password: undefined } : item,
        );
        setAccounts(updated);
        await persistAccounts(updated);
      }

      return { success: true, message: account.role, accountName: account.name, accountId: account.id };
    },
    [accounts, persistAccounts],
  );

  const login = useCallback(
    async (newRole: 'resident' | 'admin', name: string, username?: string, accountId?: string) => {
      setIsLoggedIn(true);
      setLoggedInUser(name);
      setRole(newRole);
      setLoggedInUsername(username || '');
      setLoggedInAccountId(accountId || '');
      await Promise.all([
        save(KEYS.loggedIn, 'true'),
        save(KEYS.userName, name),
        save(KEYS.userRole, newRole),
        save(KEYS.username, username || ''),
        save(KEYS.accountId, accountId || ''),
      ]);
    },
    [],
  );

  const logout = useCallback(async () => {
    if (USE_DB && isSupabaseConfigured) {
      try {
        await api.usernameAuth({ action: 'logout' });
      } catch (e) {
        console.warn('[Supabase] account sign-out failed:', e);
      }
    }

    setAccountSessionToken(null);
    setIsLoggedIn(false);
    setLoggedInUser('');
    setLoggedInUsername('');
    setLoggedInAccountId('');
    setRole('resident');
    await Promise.all([
      AsyncStorage.removeItem(KEYS.loggedIn),
      AsyncStorage.removeItem(KEYS.userName),
      AsyncStorage.removeItem(KEYS.userRole),
      AsyncStorage.removeItem(KEYS.username),
      AsyncStorage.removeItem(KEYS.accountId),
    ]);
  }, []);

  const register = useCallback(
    async (
      account: ResidentAccount,
      verificationDocument?: { base64?: string; mimeType?: string; uri?: string },
    ): Promise<{ success: boolean; message: string }> => {
      const normalizedUsername = normalizeUsername(account.username);
      const exists = accounts.find((a) => normalizeUsername(a.username) === normalizedUsername);
      if (exists) return { success: false, message: 'That username is already in use.' };

      const sanitizedAccount: ResidentAccount = {
        ...account,
        username: normalizedUsername,
        passwordHash: account.password ? await hashPassword(account.password) : undefined,
        password: undefined,
        verificationDocumentUri: account.verificationDocumentUri ?? verificationDocument?.uri,
        verificationDocumentPath: account.verificationDocumentPath ?? verificationDocument?.base64 ? `tmp/${account.id}.jpg` : undefined,
      };

      if (USE_DB && !account.password) {
        return { success: false, message: 'A password is required to register.' };
      }

      if (USE_DB && isSupabaseConfigured && account.password) {
        try {
          const result = await api.usernameAuth<{ account: ResidentAccount }>({
            action: 'signup',
            username: normalizedUsername,
            password: account.password,
            name: account.name,
            role: account.role,
            barangayPosition: account.barangayPosition ?? null,
            cpNumber: account.cpNumber,
            address: account.address,
            registeredDate: account.registeredDate,
            verificationDocument: verificationDocument
              ? {
                  base64: verificationDocument.base64,
                  mimeType: verificationDocument.mimeType,
                }
              : undefined,
          });

          const savedAccount: ResidentAccount = {
            ...result.account,
            password: undefined,
            passwordHash: undefined,
          };

          const updated = [...accounts, savedAccount];
          setAccounts(updated);
          await persistAccounts(updated);

          const notif: CivilNotification = {
            id: `notif-${Date.now()}`,
            title: 'New Account Requested',
            description: `"${account.name}" requested access. Verification required.`,
            date: nowStamp(),
            type: 'system',
            isRead: false,
            targetView: 'admin-resident-approvals',
            targetId: savedAccount.id,
            audience: 'admin',
          };
          await pushNotification(notif, notifications);

          return { success: true, message: 'Account registered. Please wait for barangay approval.' };
        } catch (e) {
          console.warn('[Supabase] auth sign-up failed:', e);
          return {
            success: false,
            message: e instanceof Error ? e.message : 'Unable to submit the account request.',
          };
        }
      }

      const updated = [...accounts, sanitizedAccount];
      setAccounts(updated);
      await persistAccounts(updated);

      const notif: CivilNotification = {
        id: `notif-${Date.now()}`,
        title: 'New Account Requested',
        description: `"${account.name}" requested access. Verification required.`,
        date: nowStamp(),
        type: 'system',
        isRead: false,
        targetView: 'admin-resident-approvals',
        targetId: account.id,
        audience: 'admin',
      };
      await pushNotification(notif, notifications);

      return { success: true, message: 'Account registered. Please wait for barangay approval.' };
    },
    [accounts, notifications, persistAccounts, pushNotification],
  );

  // ── Reports ────────────────────────────────────────────────────────────────
  const addReport = useCallback(
    async (report: ComplaintReport) => {
      const updated = [report, ...reports];
      setReports(updated);
      persistReports(updated);
      if (USE_DB) {
        try { await api.insertComplaint(report); } catch (e) { console.warn('[Supabase] complaint insert failed', e); }
      }

      const notif: CivilNotification = {
        id: `notif-${Date.now()}`,
        title: 'New Complaint Filed',
        description: `"${report.title}" was submitted under "${report.category}".`,
        date: nowStamp(),
        type: 'report',
        isRead: false,
        targetView: 'complaint-review',
        targetId: report.id,
        audience: 'admin',
      };
      await pushNotification(notif, notifications);
    },
    [reports, notifications, pushNotification],
  );

  // Submit a report through the AI duplicate check, which also inserts it
  // server-side. Do not use the admin-only app-data insert as a fallback.
  const submitReport = useCallback(
    async (
      report: ComplaintReport,
      evidencePhoto?: { base64: string; mimeType: string },
    ): Promise<SubmitResult> => {
      const usage = await getDailyReportUsage();
      if (usage.remaining <= 0) {
        throw new DailyReportLimitError('You have reached the limit of 3 reports for today. Please try again tomorrow.', usage.remaining, usage.resetAt ?? undefined);
      }

      if (USE_DB) {
        try {
          const submittedReport = evidencePhoto
            ? {
                ...report,
                evidencePhoto: await api.uploadReportEvidence(evidencePhoto.mimeType, evidencePhoto.base64),
              }
            : report;

          if (submittedReport.reportType === 'Summon' || submittedReport.priority === 'Summon') {
            const result = await api.submitSummon(submittedReport);

            try { setReports(await api.fetchComplaints()); } catch {
              setReports((prev) => [submittedReport, ...prev]);
            }
            const notif: CivilNotification = {
              id: `notif-${Date.now()}`,
              title: 'New Summon Filed',
              description: `"${submittedReport.title}" was submitted for official Barangay review.`,
              date: nowStamp(),
              type: 'report',
              isRead: false,
              targetView: 'complaint-review',
              targetId: submittedReport.id,
              audience: 'admin',
            };
            await pushNotification(notif, notifications);
            return {
              isDuplicate: false,
              dailyUsage: result.dailyUsage
                ? {
                    ...result.dailyUsage,
                    limit: DAILY_REPORT_LIMIT,
                    resetAt: result.dailyUsage.reset_at,
                  }
                : await getDailyReportUsage(),
            };
          }

          const result = await api.checkDuplicate(submittedReport);

          if (result.isDuplicate && result.existingComplaint) {
            const ex = result.existingComplaint;
            const groupId = result.groupId ?? ex.groupId ?? ex.id;

            // Refresh local reports so the bumped count shows up, then resolve
            // the real existing report from the fresh list (fully populated).
            let fresh: ComplaintReport[] = reports;
            try { fresh = await api.fetchComplaints(); setReports(fresh); } catch {}

            const existingReport: ComplaintReport =
              fresh.find((r) => r.id === ex.id) ??
              fresh.find((r) => (r.groupId ?? r.id) === groupId) ??
              // Fallback if the fetch failed — map what the edge function returned.
              {
                id: ex.id,
                groupId,
                summary: ex.summary,
                title: ex.title,
                category: ex.category,
                description: ex.description,
                location: ex.location,
                date: ex.date,
                status: ex.status,
                priority: ex.priority ?? 'Normal',
                reportedBy: ex.reported_by ?? ex.reportedBy ?? '',
                assignee: ex.assignee ?? 'Unassigned',
                timeline: [],
              };

            // Notify admin — a recurring issue now has more reporters
            const dupNotif: CivilNotification = {
              id: `notif-${Date.now()}`,
              title: `Recurring Complaint (${result.totalReporters ?? 2} reports)`,
              description: `Another resident reported "${ex.title}". This issue now has multiple reporters.`,
              date: nowStamp(),
              type: 'report',
              isRead: false,
              targetView: 'complaint-review',
              targetId: existingReport.id,
              targetGroupId: groupId,
              audience: 'admin',
            };
            await pushNotification(dupNotif, notifications);

            return {
              isDuplicate: true,
              existingReport,
              totalReporters: result.totalReporters,
              dailyUsage: await getDailyReportUsage(),
            };
          }

          // No duplicate — the edge function already inserted the complaint.
          // Refresh local state and fire the admin notification.
          try { setReports(await api.fetchComplaints()); } catch {
            setReports((prev) => [submittedReport, ...prev]);
          }
          const notif: CivilNotification = {
            id: `notif-${Date.now()}`,
            title: 'New Complaint Filed',
            description: `"${submittedReport.title}" was submitted under "${submittedReport.category}".`,
            date: nowStamp(),
            type: 'report',
            isRead: false,
            targetView: 'complaint-review',
            targetId: submittedReport.id,
            audience: 'admin',
          };
          await pushNotification(notif, notifications);
          return { isDuplicate: false, dailyUsage: await getDailyReportUsage() };
        } catch (e) {
          console.warn('[Report submission] submission failed:', e);
          throw e;
        }
      }

      // Local-only mode does not use the Edge Function.
      await addReport(report);
      return { isDuplicate: false, dailyUsage: await getDailyReportUsage() };
    },
    [addReport, getDailyReportUsage, notifications, pushNotification],
  );

  const updateReportStatus = useCallback(
    async (id: string, status: ComplaintReport['status'], reason?: string, notificationDescription?: string) => {
      const report = reports.find((r) => r.id === id);
      const timeLog: TimelineItem = {
        status,
        date: nowStamp(),
        note:
          status === 'Resolved'
            ? 'Administrator approved and resolved this complaint'
            : status === 'Rejected'
            ? `Administrator rejected report. Reason: ${reason}`
            : 'Administrator marked this report as under investigation',
      };
      const updatedReport = report
        ? { ...report, status, rejectionReason: reason || report.rejectionReason, timeline: [...report.timeline, timeLog] }
        : undefined;
      const updated = reports.map((r) => (r.id === id && updatedReport ? updatedReport : r));
      setReports(updated);
      persistReports(updated);
      if (USE_DB && updatedReport) {
        try { await api.updateComplaint(updatedReport); } catch (e) { console.warn('[Supabase] complaint update failed', e); }
      }

      const notif: CivilNotification = {
        id: `notif-${Date.now()}`,
        title: `Report Status: ${status}`,
        description: notificationDescription || `Your report "${report?.title || id}" has been updated to ${status}.`,
        date: nowStamp(),
        type: 'report',
        isRead: false,
        targetView: 'my-reports',
        targetId: id,
        audience: report?.reportedBy || 'residents',
      };
      await pushNotification(notif, notifications, Boolean(notificationDescription));
    },
    [reports, notifications, pushNotification],
  );

  const updateFullReport = useCallback(
    async (report: ComplaintReport) => {
      if (USE_DB) await api.updateComplaint(report);
      const updated = reports.map((r) => (r.id === report.id ? report : r));
      setReports(updated);
      persistReports(updated);
    },
    [reports],
  );

  // Assign an assignee to many complaints at once (e.g. a whole group).
  // Single batched state update — avoids the stale-closure overwrite you get
  // from awaiting updateFullReport in a loop.
  const assignReports = useCallback(
    async (reportIds: string[], assignee: string) => {
      const idSet = new Set(reportIds);
      const changed = reports.filter((r) => idSet.has(r.id)).map((r) => ({ ...r, assignee }));
      const updated = reports.map((r) => (idSet.has(r.id) ? { ...r, assignee } : r));
      setReports(updated);
      persistReports(updated);
      if (USE_DB) {
        try {
          await Promise.all(changed.map((r) => api.updateComplaint(r)));
        } catch (e) {
          console.warn('[Supabase] batch assign failed', e);
        }
      }
    },
    [reports],
  );

  // Cascade a status to every complaint in a group (Option B review action).
  const updateGroupStatus = useCallback(
    async (groupId: string, status: ComplaintReport['status'], reason?: string, notificationDescription?: string) => {
      const note =
        status === 'Resolved'
          ? 'Administrator resolved this grouped complaint'
          : status === 'Rejected'
          ? `Administrator rejected this grouped complaint. Reason: ${reason}`
          : 'Administrator marked this grouped complaint as under investigation';
      const stamp = nowStamp();
      const timeLog: TimelineItem = { status, date: stamp, note };

      // Optimistic local update: every report in the group
      const updated = reports.map((r) =>
        (r.groupId ?? r.id) === groupId
          ? { ...r, status, rejectionReason: reason || r.rejectionReason, timeline: [...r.timeline, timeLog] }
          : r,
      );
      setReports(updated);
      persistReports(updated);

      if (USE_DB) {
        try {
          await api.setGroupStatus(groupId, status, note, reason);
          // Re-sync from DB so cascaded timeline/status is authoritative
          try { setReports(await api.fetchComplaints()); } catch {}
        } catch (e) {
          console.warn('[Supabase] group status cascade failed', e);
        }
      }

      // Notify EACH resident in the group with their own personal notification
      const affected = reports.filter((r) => (r.groupId ?? r.id) === groupId);
      const recipients = Array.from(new Set(affected.map((r) => r.reportedBy).filter(Boolean)));
      let notifs = notifications;
      for (const recipient of recipients) {
        const recipientReport = affected.find((report) => report.reportedBy === recipient);
        const notif: CivilNotification = {
          id: `notif-${Date.now()}-${recipient}`,
          title: `Report Status: ${status}`,
          description: notificationDescription || `A complaint you reported has been updated to ${status}.`,
          date: stamp,
          type: 'report',
          isRead: false,
          targetView: 'my-reports',
          targetId: recipientReport?.id ?? groupId,
          audience: recipient,
        };
        notifs = await pushNotification(notif, notifs, Boolean(notificationDescription));
      }
    },
    [reports, notifications, pushNotification],
  );

  // ── Announcements ──────────────────────────────────────────────────────────
  const addAnnouncement = useCallback(
    async (ann: Announcement) => {
      if (USE_DB) await api.insertAnnouncement(ann);
      const updated = [ann, ...announcements];
      setAnnouncements(updated);
      persistAnnouncements(updated);

      const notif: CivilNotification = {
        id: `notif-${Date.now()}`,
        title: `New ${ann.type} Posted`,
        description: ann.summary,
        date: nowStamp(),
        type: 'announcement',
        isRead: false,
        targetView: 'community-feed',
        targetId: ann.id,
        audience: 'residents',
      };
      await pushNotification(notif, notifications);
    },
    [announcements, notifications, pushNotification],
  );

  const updateAnnouncement = useCallback(
    async (ann: Announcement) => {
      if (USE_DB) await api.updateAnnouncement(ann);
      const updated = announcements.map((item) => (item.id === ann.id ? ann : item));
      setAnnouncements(updated);
      persistAnnouncements(updated);
    },
    [announcements],
  );

  const deleteAnnouncement = useCallback(
    async (id: string) => {
      if (USE_DB) await api.deleteAnnouncement(id);
      const updated = announcements.filter((item) => item.id !== id);
      setAnnouncements(updated);
      persistAnnouncements(updated);
    },
    [announcements],
  );

  // ── Notifications ──────────────────────────────────────────────────────────
  const markNotificationRead = useCallback(
    async (id: string) => {
      const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      setNotifications(updated);
      persistNotifications(updated);
      if (USE_DB) {
        try { await api.markNotificationRead(id); } catch (e) { console.warn('[Supabase] notif read failed', e); }
      }
    },
    [notifications],
  );

  // Only the notifications meant for the current user (admin, all residents,
  // or this specific resident by account ID or name).
  const isVisibleToCurrentUser = (n: CivilNotification) => {
    const aud = n.audience ?? 'admin';
    if (role === 'admin') return aud === 'admin';
    // resident:
    return aud === 'residents' || aud === loggedInUser || (!!loggedInAccountId && aud === loggedInAccountId);
  };

  const visibleNotifications = notifications.filter(isVisibleToCurrentUser);

  const markAllRead = useCallback(async () => {
    // Only mark the current user's own notifications as read.
    const idsToMark = notifications.filter(isVisibleToCurrentUser).map((n) => n.id);
    const idSet = new Set(idsToMark);
    const updated = notifications.map((n) => (idSet.has(n.id) ? { ...n, isRead: true } : n));
    setNotifications(updated);
    persistNotifications(updated);
    if (USE_DB) {
      try { await api.markNotificationsRead(idsToMark); } catch (e) { console.warn('[Supabase] mark all read failed', e); }
    }
  }, [notifications, role, loggedInUser, loggedInAccountId]);

  const unreadCount = visibleNotifications.filter((n) => !n.isRead).length;

  const refreshNotificationData = useCallback(async () => {
    if (!USE_DB) return [];
    const [freshReports, freshNotifications] = await Promise.all([
      api.fetchComplaints(),
      api.fetchNotifications(),
    ]);
    setReports(freshReports);
    setNotifications(freshNotifications);
    return freshReports;
  }, []);

  // ── Accounts ───────────────────────────────────────────────────────────────
  const createResidentAccount = useCallback(
    async (
      accountDraft: Partial<ResidentAccount> & Pick<ResidentAccount, 'name' | 'username' | 'cpNumber' | 'address'> & {
        password?: string;
        registeredDate?: string;
      },
    ): Promise<ResidentAccount> => {
      const username = normalizeUsername(accountDraft.username);
      const exists = accounts.some((account) => normalizeUsername(account.username) === username);
      if (exists) throw new Error('That username is already in use.');

      if (USE_DB) {
        const createdAccount = await api.createResidentAccount({
          name: accountDraft.name.trim(),
          username,
          cpNumber: accountDraft.cpNumber,
          address: accountDraft.address,
          password: accountDraft.password ?? '',
          registeredDate: accountDraft.registeredDate ?? new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        });
        setAccounts((current) => [...current.filter((account) => account.id !== createdAccount.id), createdAccount]);
        return createdAccount;
      }

      const nextAccount: ResidentAccount = {
        id: accountDraft.id ?? `user-${Date.now()}`,
        name: accountDraft.name.trim(),
        username,
        role: accountDraft.role ?? 'resident',
        barangayPosition: accountDraft.barangayPosition,
        password: accountDraft.password,
        passwordHash: accountDraft.password ? await hashPassword(accountDraft.password) : undefined,
        cpNumber: accountDraft.cpNumber,
        address: accountDraft.address,
        registeredDate: accountDraft.registeredDate ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: accountDraft.status ?? 'Approved',
        rejectionReason: accountDraft.rejectionReason,
        verificationDocumentUri: accountDraft.verificationDocumentUri,
        verificationDocumentPath: accountDraft.verificationDocumentPath,
      };

      const updated = [...accounts, nextAccount];
      setAccounts(updated);
      await persistAccounts(updated);
      return nextAccount;
    },
    [accounts, persistAccounts],
  );

  const getVerificationDocumentUrl = useCallback(
    async (accountId: string): Promise<string | null> => {
      const target = accounts.find((account) => account.id === accountId);
      if (!target) return null;
      if (target.verificationDocumentUri) return target.verificationDocumentUri;
      if (target.verificationDocumentPath) {
        const { data } = supabase.storage.from('verification-documents').getPublicUrl(target.verificationDocumentPath);
        return data.publicUrl || null;
      }
      return null;
    },
    [accounts],
  );

  const blockAccountForFalseReport = useCallback(
    async (reporterName: string, reason?: string): Promise<boolean> => {
      const target = accounts.find((account) =>
        account.name === reporterName ||
        normalizeUsername(account.username) === normalizeUsername(reporterName) ||
        account.id === reporterName,
      );

      if (!target) return false;

      const updated = accounts.map((account): ResidentAccount => account.id === target.id
        ? {
            ...account,
            status: 'Blocked',
            rejectionReason: reason || 'Temporarily blocked for false report activity.',
            blockedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }
        : account,
      );
      setAccounts(updated);
      await persistAccounts(updated);

      if (USE_DB) {
        try {
          await api.reviewAccount(target.id, 'Rejected', reason || 'Blocked for false report activity.');
        } catch (e) {
          console.warn('[Supabase] false report block failed:', e);
        }
      }

      return true;
    },
    [accounts, persistAccounts],
  );

  const updateResidentProfile = useCallback(
    async (updates: { username?: string; password?: string }): Promise<ResidentAccount> => {
      if (!loggedInAccountId) throw new Error('You are not signed in.');

      const currentAccount = accounts.find((account) => account.id === loggedInAccountId);
      const nextPassword = updates.password ? updates.password : undefined;

      if (USE_DB && isSupabaseConfigured) {
        const nextUsername = updates.username ? normalizeUsername(updates.username) : loggedInUsername;
        const result = await api.usernameAuth<{ account: ResidentAccount }>({
          action: 'update-profile',
          username: nextUsername,
          password: nextPassword,
        });

        const updatedAccount = result.account;
        const list = [
          ...accounts.filter((account) => account.id !== loggedInAccountId),
          updatedAccount,
        ];
        setAccounts(list);
        setLoggedInUsername(updatedAccount.username);
        await persistAccounts(list);
        return updatedAccount;
      }

      if (!currentAccount) throw new Error('Your account could not be found.');
      const nextUsername = updates.username ? normalizeUsername(updates.username) : currentAccount.username;

      if (nextUsername !== currentAccount.username) {
        const usernameExists = accounts.some(
          (account) => account.id !== loggedInAccountId && normalizeUsername(account.username) === nextUsername,
        );
        if (usernameExists) throw new Error('That username is already in use.');
      }

      const updatedAccount: ResidentAccount = {
        ...currentAccount,
        username: nextUsername,
        ...(nextPassword ? { password: nextPassword, passwordHash: await hashPassword(nextPassword) } : {}),
      };

      const list = accounts.map((account) => account.id === loggedInAccountId ? updatedAccount : account);
      setAccounts(list);
      await persistAccounts(list);
      setLoggedInUsername(updatedAccount.username);
      return updatedAccount;
    },
    [accounts, loggedInAccountId, loggedInUsername, persistAccounts],
  );

  const updateAccountStatus = useCallback(
    async (id: string, status: 'Approved' | 'Rejected', reason?: string) => {
      const account = accounts.find((a) => a.id === id);
      let updatedAccount: ResidentAccount | undefined = account
        ? { ...account, status, rejectionReason: reason || account.rejectionReason }
        : undefined;

      if (USE_DB) {
        if (!updatedAccount) throw new Error('Account request was not found.');
        updatedAccount = await api.reviewAccount(id, status, reason);
      }

      const updated = accounts.map((a) => (a.id === id && updatedAccount ? updatedAccount : a));
      setAccounts(updated);
      await persistAccounts(updated);

      const notif: CivilNotification = {
        id: `notif-${Date.now()}`,
        title: `Your Account was ${status}`,
        description:
          status === 'Approved'
            ? 'Your barangay account has been approved. You can now sign in.'
            : `Your account request was rejected. Reason: ${reason || 'Contact the barangay office.'}`,
        date: nowStamp(),
        type: 'system',
        isRead: false,
        audience: account?.name || 'residents',
      };
      await pushNotification(notif, notifications);
    },
    [accounts, notifications, pushNotification],
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        loggedInUser,
        loggedInUsername,
        loggedInAccountId,
        role,
        login,
        logout,
        register,
        tryLogin,
        reports,
        addReport,
        submitReport,
        updateReportStatus,
        updateFullReport,
        assignReports,
        updateGroupStatus,
        announcements,
        addAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
        uploadAnnouncementImage,
        notifications: visibleNotifications,
        allNotifications: notifications,
        markNotificationRead,
        markAllRead,
        refreshNotificationData,
        notifyResident,
        notifyAdmin,
        unreadCount,
        accounts,
        createResidentAccount,
        updateResidentProfile,
        updateAccountStatus,
        getVerificationDocumentUrl,
        blockAccountForFalseReport,
        getDailyReportUsage,
        isReady,
        usingDatabase: USE_DB,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
