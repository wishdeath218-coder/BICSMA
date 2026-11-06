import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Image, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useApp } from '../../src/context/AppContext';
import { ComplaintReport } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import { api } from '../../src/lib/api';
import StatusBadge from '../../src/components/StatusBadge';
import TimelineView from '../../src/components/TimelineView';
import PrimaryButton from '../../src/components/PrimaryButton';
import { printPatawag } from '../../src/utils/printReport';

const NOTICE_STAGES = ['1st Notice', '2nd Notice', '3rd Notice', 'Hearing Scheduled', 'Settled', 'Unsettled'] as const;

import { stickyHeader, nowStamp } from '../../src/utils/ui';

const HEARING_TIME_SLOTS = [
  { time: '09:00', label: '9:00 AM' },
  { time: '10:00', label: '10:00 AM' },
  { time: '11:00', label: '11:00 AM' },
  { time: '13:00', label: '1:00 PM' },
  { time: '14:00', label: '2:00 PM' },
  { time: '15:00', label: '3:00 PM' },
  { time: '16:00', label: '4:00 PM' },
];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateKey(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function calendarDays(month: Date): Date[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const calendarStart = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) =>
    new Date(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate() + index),
  );
}

type HearingBooking = { id: string; date: string; time: string };

export default function ComplaintReviewScreen() {
  const { reports, updateReportStatus, updateFullReport, updateGroupStatus, blockAccountForFalseReport, notifyResident, usingDatabase } = useApp();
  const { reportId, groupId } = useLocalSearchParams<{ reportId: string; groupId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const report = reports.find((r) => r.id === reportId) || reports[0];
  const isSummon = report?.priority === 'Summon' || !!report?.summonedPersonName;
  const summonedPersons = report?.summonedPersons?.length
    ? report.summonedPersons
    : report?.summonedPersonName
      ? [{ name: report.summonedPersonName, address: report.summonedPersonAddress }]
      : [];

  // The group this complaint belongs to (falls back to its own id / group).
  const effectiveGroupId = groupId || report?.groupId || report?.id;
  const groupReports = report
    ? reports.filter((r) => (r.groupId ?? r.id) === effectiveGroupId)
    : [];
  const groupReportCount = groupReports.length;
  const isGrouped = groupReportCount > 1;

  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [resolveMode, setResolveMode] = useState(false);
  const [resolutionComment, setResolutionComment] = useState('');
  const [resolving, setResolving] = useState(false);
  const [blockReporter, setBlockReporter] = useState(false);
  const [hearingSlotDate, setHearingSlotDate] = useState(report?.hearingSlotDate ?? '');
  const [hearingSlotTime, setHearingSlotTime] = useState(report?.hearingSlotTime ?? '');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [remoteHearingBookings, setRemoteHearingBookings] = useState<HearingBooking[]>([]);
  const [loadingHearingBookings, setLoadingHearingBookings] = useState(usingDatabase);
  const [hearingBookingsFailed, setHearingBookingsFailed] = useState(false);
  const [hearingVenue, setHearingVenue] = useState('Barangay Session Hall, Barangay Bangbang');
  const [luponOfficer, setLuponOfficer] = useState('Hon. Barangay Captain / Lupon Head');
  const [minuteText, setMinuteText] = useState('');
  const [patawagModal, setPatawagModal] = useState(false);
  const [evidencePhotoUri, setEvidencePhotoUri] = useState<string | null>(null);
  const [evidencePhotoError, setEvidencePhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!usingDatabase) return;

    let active = true;
    api.fetchHearingBookings()
      .then((bookings) => {
        if (active) setRemoteHearingBookings(bookings);
      })
      .catch((error: unknown) => {
        console.error('[ComplaintReview] failed to load hearing availability:', error);
        if (active) {
          setHearingBookingsFailed(true);
          Toast.show({
            type: 'error',
            text1: 'Unable to Refresh Hearing Availability',
            text2: 'Please retry before selecting a hearing time.',
          });
        }
      })
      .finally(() => {
        if (active) setLoadingHearingBookings(false);
      });

    return () => { active = false; };
  }, [usingDatabase]);

  const hearingBookings = usingDatabase
    ? remoteHearingBookings
    : reports.flatMap((item) =>
        item.hearingSlotDate && item.hearingSlotTime
          ? [{ id: item.id, date: item.hearingSlotDate, time: item.hearingSlotTime }]
          : [],
      );

  useEffect(() => {
    let active = true;
    setEvidencePhotoUri(null);
    setEvidencePhotoError(null);
    if (!report?.evidencePhoto) return;

    if (/^(https?:|data:)/i.test(report.evidencePhoto)) {
      setEvidencePhotoUri(report.evidencePhoto);
      return;
    }
    if (/^(file:|content:)/i.test(report.evidencePhoto)) {
      setEvidencePhotoError('This photo was saved only on the resident’s device. Ask them to resubmit the report with the current app.');
      return;
    }

    api.getReportEvidenceUrl(report.evidencePhoto)
      .then((url) => {
        if (active) setEvidencePhotoUri(url);
      })
      .catch((error: unknown) => {
        console.error('[ComplaintReview] failed to load evidence photo:', error);
        if (active) {
          setEvidencePhotoError(error instanceof Error ? error.message : 'Unable to load evidence photo.');
        }
      });

    return () => {
      active = false;
    };
  }, [report?.evidencePhoto]);

  if (!report) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-muted dark:text-muted-dark">Report not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-3">
          <Text className="text-blue font-bold">Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Apply a status change to the whole group (or just this report if solo).
  const applyStatus = async (
    status: ComplaintReport['status'],
    reason?: string,
    notificationDescription?: string,
  ) => {
    if (isGrouped) {
      await updateGroupStatus(effectiveGroupId!, status, reason, notificationDescription);
    } else {
      await updateReportStatus(report.id, status, reason, notificationDescription);
    }
  };

  const handleApprove = async () => {
    const comment = resolutionComment.trim();
    if (!comment) {
      Toast.show({ type: 'error', text1: 'Comment Required', text2: 'Enter a comment to send to the resident.' });
      return;
    }

    setResolving(true);
    try {
      await applyStatus(
        'Resolved',
        undefined,
        `Your report "${report.title}" has been resolved.\nAdmin comment: ${comment}`,
      );
      setResolveMode(false);
      Toast.show({
        type: 'success',
        text1: 'Resolved',
        text2: isGrouped ? `${groupReportCount} reports marked resolved and residents notified.` : 'Report resolved and resident notified.',
      });
      router.back();
    } catch (error) {
      console.error('[ComplaintReview] failed to resolve report and notify resident:', error);
      Toast.show({
        type: 'error',
        text1: 'Resolution Notification Failed',
        text2: `The report may already be resolved, but its notification could not be confirmed. ${error instanceof Error ? error.message : 'Please try again.'}`,
      });
    } finally {
      setResolving(false);
    }
  };

  const handleInvestigating = async () => {
    await applyStatus('Investigating');
    Toast.show({
      type: 'success',
      text1: 'Updated',
      text2: isGrouped
        ? `${groupReportCount} reports set to Under Investigation.`
        : 'Status set to Under Investigation.',
    });
    router.back();
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { Alert.alert('Required', 'Please enter a rejection reason.'); return; }
    await applyStatus('Rejected', rejectionReason);
    if (blockReporter && report.reportedBy !== 'Anonymous') {
      const blocked = await blockAccountForFalseReport(report.reportedBy, rejectionReason);
      if (blocked) {
        Toast.show({ type: 'success', text1: 'Rejected and Blocked', text2: 'The reporter was blocked for 1 week.' });
      } else {
        Toast.show({ type: 'info', text1: 'Rejected', text2: 'The report was rejected, but no resident account matched for a temporary block.' });
      }
    } else {
      Toast.show({ type: 'success', text1: 'Rejected', text2: 'Report rejected with reason logged.' });
    }
    setRejectMode(false);
    setBlockReporter(false);
    setRejectionReason('');
    router.back();
  };

  const handleUpdateStage = async (stage: typeof NOTICE_STAGES[number]) => {
    const stamp = nowStamp();
    const missedHearingNote = 'The summoned person did not appear at the scheduled barangay hearing. The matter is unsettled; the complainant may report it to the Philippine National Police (PNP) or the appropriate higher authority for assistance.';
    const isNewUnsettledStage = stage === 'Unsettled' && report.summonNoticeStage !== 'Unsettled';
    const status = stage === 'Settled'
      ? 'Resolved'
      : stage === 'Unsettled'
        ? 'Unresolved'
        : report.status;
    const updated: ComplaintReport = {
      ...report,
      status,
      summonNoticeStage: stage,
      summonNotes: stage === 'Unsettled' && isNewUnsettledStage
        ? [...(report.summonNotes || []), `[${stamp}] ${missedHearingNote}`]
        : report.summonNotes,
      timeline: [...report.timeline, {
        status,
        date: stamp,
        note: stage === 'Unsettled' ? missedHearingNote : `Summon stage updated to: ${stage}`,
      }],
    };
    try {
      await updateFullReport(updated);
    } catch (error) {
      console.error('[ComplaintReview] failed to save summon stage:', error);
      Toast.show({
        type: 'error',
        text1: 'Unable to Update Stage',
        text2: error instanceof Error ? error.message : 'Please try again.',
      });
      return;
    }
    if (isNewUnsettledStage && report.reportedBy && report.reportedBy !== 'Anonymous') {
      await notifyResident(
        report.reportedBy,
        'Summon Unsettled — Next Steps',
        missedHearingNote,
        report.id,
      );
    }
    Toast.show({ type: 'success', text1: 'Stage Updated', text2: `Notice stage: ${stage}` });
  };

  const handleScheduleHearing = async () => {
    if (!hearingSlotDate || !hearingSlotTime) {
      Toast.show({ type: 'error', text1: 'Date and Time Required', text2: 'Choose a hearing date and an available time.' });
      return;
    }
    const booked = hearingBookings.some((booking) =>
      booking.id !== report.id
      && booking.date === hearingSlotDate
      && booking.time === hearingSlotTime,
    );
    if (booked) {
      Toast.show({ type: 'error', text1: 'Time Already Booked', text2: 'Choose another available hearing time.' });
      return;
    }
    const slot = HEARING_TIME_SLOTS.find((item) => item.time === hearingSlotTime);
    if (!slot) {
      Toast.show({ type: 'error', text1: 'Invalid Hearing Time', text2: 'Choose one of the available time buttons.' });
      return;
    }
    const hearingDate = `${formatDateKey(hearingSlotDate)} • ${slot.label}`;
    const stamp = nowStamp();
    const updated: ComplaintReport = {
      ...report,
      status: 'Investigating',
      summonNoticeStage: 'Hearing Scheduled',
      hearingDate,
      hearingSlotDate,
      hearingSlotTime,
      hearingVenue,
      luponOfficer,
      timeline: [...report.timeline, { status: 'Investigating', date: stamp, note: `Hearing scheduled: ${hearingDate} at ${hearingVenue}. Presiding: ${luponOfficer}` }],
    };
    try {
      await updateFullReport(updated);
    } catch (error) {
      console.error('[ComplaintReview] failed to save hearing schedule:', error);
      Toast.show({
        type: 'error',
        text1: error instanceof Error && /duplicate key|unique constraint|already booked|just booked/i.test(error.message)
          ? 'Time Already Booked'
          : 'Unable to Save Hearing Schedule',
        text2: error instanceof Error && /duplicate key|unique constraint|already booked|just booked/i.test(error.message)
          ? 'Another summon just booked this time. Choose another available slot.'
          : error instanceof Error ? error.message : 'Please try again.',
      });
      return;
    }
    Toast.show({ type: 'success', text1: 'Hearing Scheduled', text2: hearingDate });
  };

  const handleAddMinute = async () => {
    if (!minuteText.trim()) return;
    const stamp = nowStamp();
    const updated: ComplaintReport = {
      ...report,
      summonNotes: [...(report.summonNotes || []), `[${stamp}] ${minuteText.trim()}`],
      timeline: [...report.timeline, { status: report.status, date: stamp, note: `Hearing minutes added: "${minuteText.trim()}"` }],
    };
    try {
      await updateFullReport(updated);
    } catch (error) {
      console.error('[ComplaintReview] failed to save hearing minutes:', error);
      Toast.show({
        type: 'error',
        text1: 'Unable to Save Minutes',
        text2: error instanceof Error ? error.message : 'Please try again.',
      });
      return;
    }
    setMinuteText('');
    Toast.show({ type: 'success', text1: 'Minute Logged', text2: 'Conciliation note added.' });
  };

  const handlePrintPatawag = () => {
    if (!report) return;
    printPatawag({
      caseId: report.id,
      dateFiled: report.date,
      complainant: report.reportedBy,
      respondent: summonedPersons.map((person, index) => `${index + 1}. ${person.name}`).join('\n') || '—',
      respondentAddress: summonedPersons
        .map((person, index) => person.address ? `${index + 1}. ${person.address}` : '')
        .filter(Boolean)
        .join('\n') || '—',
      cause: report.summonReason || report.description,
      noticeStage: report.summonNoticeStage || '1st Notice',
      hearingDate: report.hearingDate || 'TBD',
      venue: report.hearingVenue || 'Barangay Hall',
      presidingOfficer: report.luponOfficer || 'Barangay Captain',
    });
  };

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <View
        className="bg-white dark:bg-surface-dark px-4 pb-3 border-b border-border dark:border-border-dark"
        style={[stickyHeader, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity className="flex-row items-center gap-1 mb-2.5" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
          <Text className="text-sm text-primary font-semibold">Dashboard</Text>
        </TouchableOpacity>
        <View className="flex-row items-start gap-2.5">
          <View className="flex-1">
            <Text className="text-base font-extrabold text-ink dark:text-ink-dark leading-[22px]" numberOfLines={2}>
              {isSummon ? 'Summon Review' : 'Complaint Review'}: {report.id}
            </Text>
            <Text className="text-xs text-muted dark:text-muted-dark mt-0.5">{report.date}</Text>
          </View>
          <StatusBadge status={report.status} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* ── SUMMON WORKSPACE ── */}
        {isSummon && (
          <View className="bg-purple-light rounded-2xl border-[1.5px] p-3.5 mb-3.5" style={{ borderColor: '#c4b5fd' }}>
            <View className="flex-row items-center gap-2.5 mb-3.5">
              <View className="w-10 h-10 rounded-[10px] bg-purple items-center justify-center">
                <Ionicons name="hammer" size={22} color={Colors.white} />
              </View>
              <View className="flex-1">
                <Text className="text-[9px] font-extrabold text-purple uppercase tracking-wide">Barangay Lupon Tagapamayapa Case</Text>
                <Text className="text-[13px] font-extrabold text-ink dark:text-ink-dark">Official Summon Process & Hearing Control</Text>
              </View>
              <TouchableOpacity className="flex-row items-center gap-1 bg-purple rounded-lg px-2.5 py-1.5" onPress={() => setPatawagModal(true)}>
                <Ionicons name="document-text-outline" size={14} color={Colors.white} />
                <Text className="text-[11px] font-bold text-white">Patawag</Text>
              </TouchableOpacity>
            </View>

            {/* Stage Pipeline */}
            <Text className="text-[11px] font-extrabold text-purple uppercase tracking-wide mb-2">1. Current Summon Notice Stage</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {NOTICE_STAGES.map((stg) => {
                const isActive = report.summonNoticeStage === stg || (!report.summonNoticeStage && stg === '1st Notice');
                return (
                  <TouchableOpacity
                    key={stg}
                    className={`px-3.5 py-2 rounded-lg border ${isActive ? 'bg-purple border-purple' : 'bg-white dark:bg-surface-dark border-border dark:border-border-dark'}`}
                    onPress={() => handleUpdateStage(stg)}
                  >
                    <Text className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>{stg}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Hearing Scheduler */}
            <Text className="text-[11px] font-extrabold text-purple uppercase tracking-wide mb-2 mt-3.5">2. Schedule Conciliation Hearing</Text>
            <View className="bg-white dark:bg-surface-dark rounded-[10px] border p-3.5" style={{ borderColor: '#ddd6fe' }}>
              <Text className="text-xs font-semibold text-ink dark:text-ink-dark mb-1.5">Hearing Date & Time</Text>
              <TouchableOpacity
                className="flex-row items-center justify-between bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 py-2.5"
                onPress={() => {
                  if (hearingSlotDate) {
                    const [year, month] = hearingSlotDate.split('-').map(Number);
                    setCalendarMonth(new Date(year, month - 1, 1));
                  } else {
                    setCalendarMonth(new Date());
                  }
                  setCalendarVisible(true);
                }}
              >
                <Text className={`text-[13px] ${hearingSlotDate ? 'text-ink dark:text-ink-dark' : 'text-muted dark:text-muted-dark'}`}>
                  {hearingSlotDate ? formatDateKey(hearingSlotDate) : 'Select hearing date'}
                </Text>
                <Ionicons name="calendar-outline" size={17} color={Colors.purple} />
              </TouchableOpacity>
              <Text className="text-xs font-semibold text-ink dark:text-ink-dark mb-1.5 mt-2.5">Available Hearing Times</Text>
              <View className="flex-row flex-wrap gap-2">
                {HEARING_TIME_SLOTS.map((slot) => {
                  const isBooked = hearingBookings.some((booking) =>
                    booking.id !== report.id
                    && booking.date === hearingSlotDate
                    && booking.time === slot.time,
                  );
                  const isSelected = hearingSlotTime === slot.time;
                  return (
                    <TouchableOpacity
                      key={slot.time}
                      disabled={!hearingSlotDate || loadingHearingBookings || hearingBookingsFailed || isBooked}
                      onPress={() => setHearingSlotTime(slot.time)}
                      className={`min-w-[30%] items-center rounded-lg border px-3 py-2 ${isSelected ? 'bg-purple border-purple' : 'bg-white dark:bg-surface-dark border-border dark:border-border-dark'}`}
                      style={isBooked || loadingHearingBookings || hearingBookingsFailed || !hearingSlotDate ? { opacity: 0.45 } : undefined}
                    >
                      <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-ink dark:text-ink-dark'}`}>
                        {slot.label}
                      </Text>
                      {isBooked && <Text className="text-[9px] font-semibold text-red">Booked</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {loadingHearingBookings && (
                <Text className="text-[11px] text-muted dark:text-muted-dark mt-1.5">Checking booked times…</Text>
              )}
              {hearingBookingsFailed && (
                <Text className="text-[11px] text-red mt-1.5">Unable to check availability. Close and reopen this case to retry.</Text>
              )}
              <Text className="text-[10px] text-muted dark:text-muted-dark mt-1">Hearings are scheduled hourly from 9:00 AM to 4:00 PM, except 12:00 noon.</Text>
              <Text className="text-xs font-semibold text-ink dark:text-ink-dark mb-1.5 mt-2.5">Venue</Text>
              <TextInput className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 py-2.5 text-[13px] text-ink dark:text-ink-dark" value={hearingVenue} onChangeText={setHearingVenue} placeholderTextColor={Colors.textMuted} />
              <Text className="text-xs font-semibold text-ink dark:text-ink-dark mb-1.5 mt-2.5">Presiding Lupon Officer</Text>
              <TextInput className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 py-2.5 text-[13px] text-ink dark:text-ink-dark" value={luponOfficer} onChangeText={setLuponOfficer} placeholderTextColor={Colors.textMuted} />
              <PrimaryButton label="Save Hearing Schedule" onPress={handleScheduleHearing} variant="primary" style={{ marginTop: 12, height: 44 }} />
            </View>

            {report.hearingDate && (
              <View className="flex-row items-center gap-2 bg-amber-light rounded-lg p-2.5 mt-2">
                <Ionicons name="calendar-outline" size={14} color={Colors.amber} />
                <Text className="text-[13px] text-amber font-semibold">Scheduled: {report.hearingDate}</Text>
              </View>
            )}

            {/* Conciliation Minutes */}
            <Text className="text-[11px] font-extrabold text-purple uppercase tracking-wide mb-2 mt-3.5">3. Lupon Conciliation Minutes</Text>
            {report.summonNotes && report.summonNotes.length > 0 && (
              <View className="gap-1.5 mb-2">
                {report.summonNotes.map((note, i) => (
                  <View key={i} className="bg-white dark:bg-surface-dark rounded-lg border p-2.5" style={{ borderColor: '#ddd6fe' }}>
                    <Text className="text-xs text-ink dark:text-ink-dark leading-[17px]">{note}</Text>
                  </View>
                ))}
              </View>
            )}
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-white dark:bg-surface-dark border rounded-lg px-3 py-2 text-[13px] text-ink dark:text-ink-dark"
                style={{ borderColor: '#ddd6fe' }}
                placeholder="Write conciliation minutes or agreement terms…"
                value={minuteText}
                onChangeText={setMinuteText}
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity className="bg-purple rounded-lg px-3.5 justify-center" onPress={handleAddMinute}>
                <Text className="text-[13px] font-bold text-white">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── GROUPED REPORTERS BANNER ── */}
        {isGrouped && (
          <View className="bg-blue-light rounded-xl border p-4 mb-3.5" style={{ borderColor: '#bfdbfe' }}>
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="people" size={18} color={Colors.blue} />
              <Text className="text-sm font-extrabold text-blue">{groupReportCount} reports filed for this issue</Text>
            </View>
            <Text className="text-[12px] text-blue mb-2">
              Reviewing this complaint updates the status for all {groupReportCount} reports at once.
            </Text>
            {/* List each reporter */}
            <View className="gap-1">
              {reports
                .filter((r) => (r.groupId ?? r.id) === effectiveGroupId)
                .map((r) => (
                  <View key={r.id} className="flex-row items-center gap-2">
                    <Ionicons name="person-circle-outline" size={14} color={Colors.blue} />
                    <Text className="text-[12px] text-ink flex-1" numberOfLines={1}>
                      {r.reportedBy} <Text className="text-muted">· {r.id} · {r.date}</Text>
                    </Text>
                    <StatusBadge status={r.status} small />
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* ── MAIN REPORT INFO ── */}
        <View className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-4 mb-3.5">
          <Text className="text-base font-extrabold text-ink dark:text-ink-dark mb-1">{report.title}</Text>
          <Text className="text-xs text-muted dark:text-muted-dark mb-3">Reported by: <Text className="font-extrabold text-ink dark:text-ink-dark">{report.reportedBy}</Text></Text>

          {/* AI summary */}
          {report.summary ? (
            <View className="bg-purple-light rounded-lg p-3 mb-3 border" style={{ borderColor: '#ddd6fe' }}>
              <Text className="text-[10px] font-extrabold text-purple uppercase tracking-wide mb-1">AI Summary</Text>
              <Text className="text-[13px] text-ink leading-[19px]">{report.summary}</Text>
            </View>
          ) : null}

          <View className="gap-2">
            <InfoItem icon="folder-outline" label="Category" value={report.category} />
            <InfoItem icon="location-outline" label="Location" value={report.location} />
            <InfoItem icon="build-outline" label="Assigned To" value={report.assignee} />
            {isSummon && summonedPersons.map((person, index) => (
              <React.Fragment key={`${person.name}-${index}`}>
                <InfoItem
                  icon="person-remove-outline"
                  label={summonedPersons.length > 1 ? `Summoned ${index + 1}` : 'Summoned'}
                  value={person.name}
                  accent={Colors.purple}
                />
                {person.address ? (
                  <InfoItem icon="home-outline" label="Address" value={person.address} accent={Colors.purple} />
                ) : null}
              </React.Fragment>
            ))}
          </View>

          <View className="h-px bg-border dark:bg-border-dark my-3" />
          <Text className="text-xs font-extrabold text-primary uppercase tracking-wide mb-1.5">Description</Text>
          <Text className="text-sm text-ink dark:text-ink-dark leading-[21px]">{report.description}</Text>

          {report.status === 'Rejected' && report.rejectionReason && (
            <View className="mt-3 bg-red-light rounded-lg p-3 border" style={{ borderColor: '#fecaca' }}>
              <Text className="text-[11px] font-extrabold text-red mb-1">Rejection Reason</Text>
              <Text className="text-[13px] text-red">{report.rejectionReason}</Text>
            </View>
          )}
        </View>

        {/* Evidence Photo */}
        {report.evidencePhoto && (
          <View className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-4 mb-3.5">
            <Text className="text-xs font-extrabold text-primary uppercase tracking-wide mb-1.5">Evidence Photo</Text>
            {evidencePhotoUri ? (
              <Image source={{ uri: evidencePhotoUri }} className="w-full h-[200px] rounded-lg mt-2" resizeMode="cover" />
            ) : evidencePhotoError ? (
              <Text className="mt-2 text-[13px] text-red">{evidencePhotoError}</Text>
            ) : (
              <Text className="mt-2 text-[13px] text-muted dark:text-muted-dark">Loading evidence photo…</Text>
            )}
          </View>
        )}

        {/* Case Timeline */}
        <View className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-4 mb-3.5">
          <Text className="text-xs font-extrabold text-primary uppercase tracking-wide mb-1.5">Case Timeline</Text>
          <TimelineView timeline={report.timeline} />
        </View>

        {/* ── ACTION BUTTONS ── */}
        {report.status !== 'Resolved' && report.status !== 'Rejected' && (
          <View className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-4 mb-3.5">
            <Text className="text-[13px] font-extrabold text-ink dark:text-ink-dark mb-3">Actions</Text>
            <View className="flex-row gap-2.5">
              <TouchableOpacity className="flex-1 flex-row items-center justify-center gap-1.5 py-[11px] rounded-[10px] border-[1.5px] bg-green-light" style={{ borderColor: '#bbf7d0' }} onPress={() => setResolveMode(true)}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.green} />
                <Text className="text-xs font-bold text-green">Resolve</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 flex-row items-center justify-center gap-1.5 py-[11px] rounded-[10px] border-[1.5px] bg-purple-light" style={{ borderColor: '#ddd6fe' }} onPress={handleInvestigating}>
                <Ionicons name="search-outline" size={16} color={Colors.purple} />
                <Text className="text-xs font-bold text-purple">Investigate</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 flex-row items-center justify-center gap-1.5 py-[11px] rounded-[10px] border-[1.5px] bg-red-light" style={{ borderColor: '#fecaca' }} onPress={() => setRejectMode(true)}>
                <Ionicons name="close-circle-outline" size={16} color={Colors.red} />
                <Text className="text-xs font-bold text-red">Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <View className="flex-1 justify-center items-center p-5" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="w-full max-w-[360px] rounded-2xl bg-white dark:bg-surface-dark p-4">
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity
                className="h-9 w-9 items-center justify-center rounded-full bg-gray-light dark:bg-surface-dark-2"
                onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <Ionicons name="chevron-back" size={18} color={Colors.purple} />
              </TouchableOpacity>
              <Text className="text-base font-extrabold text-ink dark:text-ink-dark">
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity
                className="h-9 w-9 items-center justify-center rounded-full bg-gray-light dark:bg-surface-dark-2"
                onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <Ionicons name="chevron-forward" size={18} color={Colors.purple} />
              </TouchableOpacity>
            </View>
            <View className="mb-1 flex-row">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <Text key={day} className="w-[14.28%] py-2 text-center text-[10px] font-bold text-muted dark:text-muted-dark">{day}</Text>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {calendarDays(calendarMonth).map((day) => {
                const key = dateKey(day);
                const isPast = key < dateKey(new Date());
                const isSelected = key === hearingSlotDate;
                const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                return (
                  <TouchableOpacity
                    key={key}
                    disabled={isPast}
                    onPress={() => {
                      setHearingSlotDate(key);
                      setCalendarVisible(false);
                    }}
                    className={`w-[14.28%] items-center justify-center py-2 ${isSelected ? 'rounded-full bg-purple' : ''}`}
                    style={isPast ? { opacity: 0.3 } : undefined}
                  >
                    <Text className={`text-xs ${isSelected ? 'font-bold text-white' : isCurrentMonth ? 'text-ink dark:text-ink-dark' : 'text-muted dark:text-muted-dark'}`}>
                      {day.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              className="mt-4 items-center rounded-lg bg-gray-light dark:bg-surface-dark-2 py-2.5"
              onPress={() => setCalendarVisible(false)}
            >
              <Text className="text-sm font-bold text-gray dark:text-ink-dark">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Resolve Modal */}
      <Modal visible={resolveMode} transparent animationType="slide" onRequestClose={() => setResolveMode(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-surface-dark rounded-t-[20px] p-5 pb-9">
            <Text className="text-lg font-extrabold text-ink dark:text-ink-dark mb-1.5">Resolve Report</Text>
            <Text className="text-[13px] text-muted dark:text-muted-dark mb-3.5">
              Write a comment to include in the resolution notification to {isGrouped ? 'the reporting residents' : report.reportedBy}.
            </Text>
            <TextInput
              className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 text-[13px] text-ink dark:text-ink-dark"
              style={{ height: 110, textAlignVertical: 'top', paddingTop: 10 }}
              placeholder="Enter a resolution comment…"
              value={resolutionComment}
              onChangeText={setResolutionComment}
              multiline
              placeholderTextColor={Colors.textMuted}
              editable={!resolving}
              accessibilityLabel="Resolution comment for resident notification"
            />
            <View className="flex-row gap-2.5 mt-3">
              <TouchableOpacity
                className="flex-1 h-[46px] rounded-[10px] items-center justify-center bg-gray-light dark:bg-surface-dark-2"
                onPress={() => setResolveMode(false)}
                disabled={resolving}
              >
                <Text className="text-sm font-bold text-gray dark:text-ink-dark">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 h-[46px] rounded-[10px] items-center justify-center ${resolving ? 'bg-green-light' : 'bg-green'}`}
                onPress={handleApprove}
                disabled={resolving}
              >
                <Text className={`text-sm font-bold ${resolving ? 'text-green' : 'text-white'}`}>
                  {resolving ? 'Resolving…' : 'Resolve & Notify'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={rejectMode} transparent animationType="slide" onRequestClose={() => setRejectMode(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-surface-dark rounded-t-[20px] p-5 pb-9">
            <Text className="text-lg font-extrabold text-ink dark:text-ink-dark mb-1.5">Reject Report</Text>
            <Text className="text-[13px] text-muted dark:text-muted-dark mb-3.5">Provide a reason for rejecting this complaint. This will be visible to the resident.</Text>
            {report.reportedBy !== 'Anonymous' && (
              <TouchableOpacity className="flex-row items-center gap-2.5 mb-3" onPress={() => setBlockReporter((prev) => !prev)}>
                <View className={`h-5 w-5 rounded border items-center justify-center ${blockReporter ? 'bg-red border-red' : 'bg-gray-light border-border dark:border-border-dark'}`}>
                  {blockReporter ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : null}
                </View>
                <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark">Block reporter for 1 week (false/prank report)</Text>
              </TouchableOpacity>
            )}
            <TextInput
              className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 text-[13px] text-ink dark:text-ink-dark"
              style={{ height: 90, textAlignVertical: 'top', paddingTop: 10 }}
              placeholder="Enter rejection reason…"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              placeholderTextColor={Colors.textMuted}
            />
            <View className="flex-row gap-2.5 mt-2">
              <TouchableOpacity className="flex-1 h-[46px] rounded-[10px] items-center justify-center bg-gray-light dark:bg-surface-dark-2" onPress={() => setRejectMode(false)}>
                <Text className="text-sm font-bold text-gray dark:text-ink-dark">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 h-[46px] rounded-[10px] items-center justify-center bg-red" onPress={handleReject}>
                <Text className="text-sm font-bold text-white">Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Patawag Modal */}
      <Modal visible={patawagModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPatawagModal(false)}>
        <View className="flex-1 bg-white dark:bg-surface-dark">
          <View
            className="flex-row justify-between items-center px-5 pb-3 border-b border-border dark:border-border-dark"
            style={{ paddingTop: insets.top + 8 }}
          >
            <Text className="text-[17px] font-extrabold text-ink dark:text-ink-dark">Official Patawag Notice</Text>
            <TouchableOpacity onPress={() => setPatawagModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View className="border-2 rounded-xl p-5" style={{ borderColor: Colors.primary }}>
              <Text className="text-sm font-extrabold text-primary text-center">Republic of the Philippines</Text>
              <Text className="text-xs text-primary text-center mt-0.5">Barangay Bangbang • Katarungang Pambarangay</Text>
              <Text className="text-[11px] text-muted dark:text-muted-dark text-center mt-1 mb-3">KP Form No. 9 — Summon (Patawag)</Text>
              <View className="h-px bg-border dark:bg-border-dark my-3" />
              <PatawagRow label="Case Reference" value={report.id} />
              <PatawagRow label="Date Filed" value={report.date} />
              <PatawagRow label="Complainant" value={report.reportedBy} />
              <PatawagRow
                label="Respondent"
                value={summonedPersons.map((person, index) => `${index + 1}. ${person.name}`).join('\n') || '—'}
              />
              <PatawagRow
                label="Address"
                value={summonedPersons.map((person, index) => person.address ? `${index + 1}. ${person.address}` : '').filter(Boolean).join('\n') || '—'}
              />
              <PatawagRow label="Cause of Action" value={report.summonReason || report.description} />
              <PatawagRow label="Notice Stage" value={report.summonNoticeStage || '1st Notice'} />
              <PatawagRow label="Hearing Date" value={report.hearingDate || 'TBD'} />
              <PatawagRow label="Venue" value={report.hearingVenue || 'Barangay Hall'} />
              <PatawagRow label="Presiding Officer" value={report.luponOfficer || 'Barangay Captain'} />
              <View className="h-px bg-border dark:bg-border-dark my-3" />
              <Text className="text-xs text-muted dark:text-muted-dark leading-[18px] italic">
                You are hereby summoned to appear before the Lupong Tagapamayapa of Barangay Bangbang at the time, date, and venue stated above for conciliation proceedings. Failure to appear may result in further legal action under the Katarungang Pambarangay Law (PD 1508 / RA 7160).
              </Text>
            </View>

            <TouchableOpacity
              className="flex-row items-center justify-center gap-2 mt-5 py-3 rounded-xl bg-primary"
              onPress={handlePrintPatawag}
            >
              <Ionicons name="print-outline" size={18} color={Colors.white} />
              <Text className="text-sm font-bold text-white">Print / Save as PDF</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <Text className="text-[11px] text-muted dark:text-muted-dark text-center mt-2">Printing is available on the web app.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function InfoItem({ icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name={icon} size={14} color={accent || Colors.textMuted} />
      <Text className="text-xs font-bold text-muted dark:text-muted-dark w-20 flex-shrink-0">{label}:</Text>
      <Text className="flex-1 text-[13px] text-ink dark:text-ink-dark" style={accent ? { color: accent } : undefined} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function PatawagRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row mb-2.5 gap-2.5">
      <Text className="text-xs font-bold text-muted dark:text-muted-dark w-[110px] flex-shrink-0">{label}</Text>
      <Text className="flex-1 text-[13px] text-ink dark:text-ink-dark">{value}</Text>
    </View>
  );
}
