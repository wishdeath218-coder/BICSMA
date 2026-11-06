import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { ComplaintReport, isSummonReport } from '../../src/types';
import { api } from '../../src/lib/api';
import { isSupabaseConfigured } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import Toast from 'react-native-toast-message';
import StatusBadge from '../../src/components/StatusBadge';
import TimelineView from '../../src/components/TimelineView';
import ReportCard from '../../src/components/ReportCard';
import EmptyState from '../../src/components/EmptyState';

type StatusFilter = 'All' | 'Pending' | 'Investigating' | 'Resolved' | 'Unresolved' | 'Rejected';
const STATUS_FILTERS: StatusFilter[] = ['All', 'Pending', 'Investigating', 'Resolved', 'Unresolved', 'Rejected'];

import { stickyHeader } from '../../src/utils/ui';

export default function MyReportsScreen() {
  const { reports, loggedInUser, loggedInAccountId, refreshNotificationData } = useApp();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [selected, setSelected] = useState<ComplaintReport | null>(null);
  const [anonymousReportIds, setAnonymousReportIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) return;
      refreshNotificationData().catch((error: unknown) => {
        console.error('[MyReports] failed to refresh reports:', error);
        Toast.show({
          type: 'error',
          text1: 'Unable to Refresh Reports',
          text2: error instanceof Error ? error.message : 'Please try again.',
        });
      });
    }, [refreshNotificationData]),
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    api.usernameAuth<{ reportIds: string[] }>({ action: 'my-anonymous-report-ids' })
      .then(({ reportIds }) => {
        if (active) setAnonymousReportIds(reportIds);
      })
      .catch((error) => {
        console.error('[MyReports] failed to load private report ownership:', error);
      });

    return () => {
      active = false;
    };
  }, [reports]);

  const myReports = useMemo(
    () => {
      const anonymousIds = new Set(anonymousReportIds);
      return reports.filter((r) => (
        r.reportedBy === loggedInUser
        || r.isSummonedParty === true
        || (r.summonedPersons?.some((person) => person.accountId === loggedInAccountId) ?? false)
        || (r.isAnonymous === true && anonymousIds.has(r.id))
      ));
    },
    [reports, loggedInUser, loggedInAccountId, anonymousReportIds],
  );

  const filtered = useMemo(() => {
    return myReports.filter((r) => {
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [myReports, search, statusFilter]);

  const totalCount = myReports.length;
  const activeCount = myReports.filter((r) => r.status === 'Pending' || r.status === 'Investigating' || r.status === 'Unresolved').length;
  const resolvedCount = myReports.filter((r) => r.status === 'Resolved').length;

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <View
        className="bg-white dark:bg-surface-dark px-4 pb-3 border-b border-border dark:border-border-dark gap-2.5"
        style={[stickyHeader, { paddingTop: insets.top + 12 }]}
      >
        <Text className="text-[22px] font-black text-ink dark:text-ink-dark">My Reports</Text>
        <Text className="text-[13px] text-muted dark:text-muted-dark">Track and manage your filed complaints</Text>

        {/* Stats strip */}
        <View className="flex-row gap-2.5">
          <View className="flex-1 bg-gray-light dark:bg-surface-dark-2 rounded-[10px] py-2 items-center">
            <Text className="text-lg font-black text-ink dark:text-ink-dark">{totalCount}</Text>
            <Text className="text-[10px] font-semibold text-muted dark:text-muted-dark">Total</Text>
          </View>
          <View className="flex-1 bg-amber-light rounded-[10px] py-2 items-center">
            <Text className="text-lg font-black text-amber">{activeCount}</Text>
            <Text className="text-[10px] font-semibold text-amber">Active</Text>
          </View>
          <View className="flex-1 bg-green-light rounded-[10px] py-2 items-center">
            <Text className="text-lg font-black text-green">{resolvedCount}</Text>
            <Text className="text-[10px] font-semibold text-green">Resolved</Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center gap-2 bg-gray-light dark:bg-surface-dark-2 rounded-[10px] border border-border dark:border-border-dark px-3 h-[42px]">
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            className="flex-1 text-sm text-ink dark:text-ink-dark"
            placeholder="Search by ID, title or category…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f;
            return (
              <TouchableOpacity
                key={f}
                className={`px-3.5 py-1.5 rounded-2xl border ${
                  active ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'
                }`}
                onPress={() => setStatusFilter(f)}
              >
                <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title="No reports found"
            subtitle={
              search
                ? 'Try a different search term.'
                : statusFilter !== 'All'
                ? `You have no ${statusFilter.toLowerCase()} reports.`
                : 'You have not filed any reports yet.'
            }
          />
        }
        renderItem={({ item }) => <ReportCard report={item} onPress={() => setSelected(item)} />}
      />

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && <ReportDetailSheet report={selected} onClose={() => setSelected(null)} />}
      </Modal>
    </View>
  );
}

function ReportDetailSheet({ report, onClose }: { report: ComplaintReport; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const isSummon = isSummonReport(report);
  const [evidencePhotoUri, setEvidencePhotoUri] = useState<string | null>(null);
  const summonedPersons = report.summonedPersons?.length
    ? report.summonedPersons
    : report.summonedPersonName
      ? [{ name: report.summonedPersonName, address: report.summonedPersonAddress }]
      : [];

  useEffect(() => {
    let active = true;
    setEvidencePhotoUri(null);
    if (!report.evidencePhoto) return;

    if (/^(https?:|data:|file:|content:)/i.test(report.evidencePhoto)) {
      setEvidencePhotoUri(report.evidencePhoto);
      return;
    }

    api.getReportEvidenceUrl(report.evidencePhoto)
      .then((url) => {
        if (active) setEvidencePhotoUri(url);
      })
      .catch((error: unknown) => {
        console.error('[MyReports] failed to load evidence photo:', error);
        if (active) {
          Toast.show({
            type: 'error',
            text1: 'Unable to Open Evidence Photo',
            text2: error instanceof Error ? error.message : 'Please try again.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, [report.evidencePhoto]);

  return (
    <View className="flex-1 bg-white dark:bg-surface-dark">
      {/* Sheet Header */}
      <View
        className="flex-row justify-between items-center px-5 pb-3 border-b border-border dark:border-border-dark"
        style={{ paddingTop: insets.top + 8 }}
      >
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text className="text-base font-bold text-ink dark:text-ink-dark flex-1 mx-3" numberOfLines={1}>Report Details</Text>
        <StatusBadge status={report.status} small />
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 24 }}>
        {/* ID + title */}
        <View className="p-5 pb-0">
          <Text className="text-xs font-bold text-muted dark:text-muted-dark mb-1">{report.id}</Text>
          <Text className="text-xl font-black text-ink dark:text-ink-dark leading-[26px]">{report.title}</Text>
          <Text className="text-xs text-muted dark:text-muted-dark mt-1">{report.date}</Text>
          {isSummon && (
            <View className="mt-2 self-start bg-purple-light rounded-lg px-2.5 py-1">
              <Text className="text-xs font-bold text-purple">Summon Filing</Text>
            </View>
          )}
        </View>

        {/* Info rows */}
        <View className="m-4 bg-gray-light dark:bg-surface-dark-2 rounded-xl border border-border dark:border-border-dark overflow-hidden">
          <InfoRow icon="folder-outline" label="Category" value={report.category} />
          <InfoRow icon="location-outline" label="Location" value={report.location} />
          <InfoRow icon="person-outline" label="Reported By" value={report.reportedBy} />
          <InfoRow icon="build-outline" label="Assigned To" value={report.assignee} />
        </View>

        {/* Description */}
        <View className="px-4 mb-4">
          <Text className="text-xs font-extrabold text-primary uppercase tracking-wide mb-2">Description</Text>
          <Text className="text-sm text-ink dark:text-ink-dark leading-[22px]">{report.description}</Text>
        </View>

        {/* Summon details */}
        {isSummon && (
          <View className="mx-4 mb-4 bg-purple-light rounded-xl p-3.5 border" style={{ borderColor: '#ddd6fe' }}>
            <Text className="text-xs font-extrabold text-purple uppercase tracking-wide mb-2">Summon Information</Text>
            {summonedPersons.map((person, index) => (
              <React.Fragment key={`${person.name}-${index}`}>
                <InfoRow
                  icon="person-remove-outline"
                  label={summonedPersons.length > 1 ? `Person ${index + 1}` : 'Summoned'}
                  value={person.name}
                  accent={Colors.purple}
                />
                {person.address ? <InfoRow icon="home-outline" label="Address" value={person.address} accent={Colors.purple} /> : null}
              </React.Fragment>
            ))}
            {report.summonReason && <InfoRow icon="alert-circle-outline" label="Reason" value={report.summonReason} accent={Colors.purple} />}
            {report.summonNoticeStage && <InfoRow icon="layers-outline" label="Notice Stage" value={report.summonNoticeStage} accent={Colors.purple} />}
            {report.hearingDate && <InfoRow icon="calendar-outline" label="Hearing Date" value={report.hearingDate} accent={Colors.purple} />}
            {report.hearingVenue && <InfoRow icon="business-outline" label="Venue" value={report.hearingVenue} accent={Colors.purple} />}
          </View>
        )}

        {/* Rejection reason */}
        {report.status === 'Rejected' && report.rejectionReason && (
          <View className="mx-4 mb-4 bg-red-light rounded-[10px] border p-3.5" style={{ borderColor: '#fecaca' }}>
            <Text className="text-xs font-bold text-red mb-1">Rejection Reason</Text>
            <Text className="text-[13px] text-red leading-[18px]">{report.rejectionReason}</Text>
          </View>
        )}

        {/* Evidence photo */}
        {report.evidencePhoto && (
          <View className="px-4 mb-4">
            <Text className="text-xs font-extrabold text-primary uppercase tracking-wide mb-2">Evidence Photo</Text>
            {evidencePhotoUri ? (
              <Image source={{ uri: evidencePhotoUri }} className="w-full h-[200px] rounded-[10px]" resizeMode="cover" />
            ) : (
              <Text className="text-[13px] text-muted dark:text-muted-dark">Loading evidence photo…</Text>
            )}
          </View>
        )}

        {/* Timeline */}
        <View className="px-4 mb-4">
          <Text className="text-xs font-extrabold text-primary uppercase tracking-wide mb-2">Case Timeline</Text>
          <TimelineView timeline={report.timeline} />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <View className="flex-row items-start gap-2.5 py-[11px] px-3.5 border-b border-border dark:border-border-dark">
      <Ionicons name={icon} size={15} color={accent || Colors.textMuted} style={{ marginTop: 1 }} />
      <Text className="text-xs font-bold text-muted dark:text-muted-dark w-[90px] flex-shrink-0">{label}</Text>
      <Text className="flex-1 text-[13px] text-ink dark:text-ink-dark" numberOfLines={2}>{value}</Text>
    </View>
  );
}
