import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { isSummonReport } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import EmptyState from '../../src/components/EmptyState';

type StageFilter = 'All' | '1st Notice' | '2nd Notice' | '3rd Notice' | 'Hearing Scheduled' | 'Settled' | 'Unsettled';
const STAGE_FILTERS: StageFilter[] = ['All', '1st Notice', '2nd Notice', '3rd Notice', 'Hearing Scheduled', 'Settled', 'Unsettled'];

const stageColor: Record<string, { bg: string; text: string }> = {
  '1st Notice': { bg: Colors.amberLight, text: Colors.amber },
  '2nd Notice': { bg: '#fef3c7', text: '#d97706' },
  '3rd Notice': { bg: Colors.redLight, text: Colors.red },
  'Hearing Scheduled': { bg: Colors.purpleLight, text: Colors.purple },
  Settled: { bg: Colors.greenLight, text: Colors.green },
  Unsettled: { bg: Colors.grayLight, text: Colors.gray },
};

import { stickyHeader } from '../../src/utils/ui';

export default function SummonsHubScreen() {
  const { reports } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stageFilter, setStageFilter] = useState<StageFilter>('All');

  const summonReports = reports.filter(isSummonReport);

  const filtered = useMemo(() => {
    if (stageFilter === 'All') return summonReports;
    return summonReports.filter((r) => r.summonNoticeStage === stageFilter);
  }, [summonReports, stageFilter]);

  const activeCount = summonReports.filter((r) => r.status !== 'Resolved' && r.status !== 'Rejected').length;
  const scheduledCount = summonReports.filter((r) => r.summonNoticeStage === 'Hearing Scheduled').length;
  const settledCount = summonReports.filter((r) => r.summonNoticeStage === 'Settled').length;

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <View
        className="bg-white dark:bg-surface-dark px-4 pb-3 border-b border-border dark:border-border-dark gap-2.5"
        style={[stickyHeader, { paddingTop: insets.top + 12 }]}
      >
        <View className="flex-row items-center gap-2.5">
          <View className="w-10 h-10 rounded-[10px] bg-purple items-center justify-center">
            <Ionicons name="hammer" size={20} color={Colors.white} />
          </View>
          <View>
            <Text className="text-xl font-black text-ink dark:text-ink-dark">Summons Hub</Text>
            <Text className="text-xs text-muted dark:text-muted-dark">Barangay Lupon Tagapamayapa</Text>
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row gap-2">
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-purple-light" style={{ borderColor: '#ddd6fe' }}>
            <Text className="text-xl font-black text-purple">{activeCount}</Text>
            <Text className="text-[10px] font-semibold text-purple">Active</Text>
          </View>
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-amber-light" style={{ borderColor: '#fde68a' }}>
            <Text className="text-xl font-black text-amber">{scheduledCount}</Text>
            <Text className="text-[10px] font-semibold text-amber">Scheduled</Text>
          </View>
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-green-light" style={{ borderColor: '#bbf7d0' }}>
            <Text className="text-xl font-black text-green">{settledCount}</Text>
            <Text className="text-[10px] font-semibold text-green">Settled</Text>
          </View>
        </View>

        {/* Stage Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STAGE_FILTERS.map((f) => {
            const active = stageFilter === f;
            return (
              <TouchableOpacity
                key={f}
                className={`px-3 py-1.5 rounded-2xl border ${active ? 'bg-purple border-purple' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'}`}
                onPress={() => setStageFilter(f)}
              >
                <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="hammer-outline" title="No summon cases found" subtitle="No cases match the selected stage filter." />
        }
        renderItem={({ item }) => {
          const stage = item.summonNoticeStage || '1st Notice';
          const sc = stageColor[stage] || stageColor['1st Notice'];
          return (
            <View
              className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-3.5 mb-2.5"
            >
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-[11px] font-bold text-muted dark:text-muted-dark">{item.id}</Text>
                <View className="px-2.5 py-[3px] rounded-[10px]" style={{ backgroundColor: sc.bg }}>
                  <Text className="text-[11px] font-bold" style={{ color: sc.text }}>{stage}</Text>
                </View>
              </View>

              <Text className="text-sm font-extrabold text-ink dark:text-ink-dark mb-2.5">{item.title}</Text>

              <View className="flex-row items-center gap-2.5 mb-2">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-muted dark:text-muted-dark uppercase mb-0.5">Complainant</Text>
                  <Text className="text-[13px] font-bold text-ink dark:text-ink-dark">{item.reportedBy}</Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} style={{ alignSelf: 'center' }} />
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-red uppercase mb-0.5">Respondent</Text>
                  <Text className="text-[13px] font-bold text-ink dark:text-ink-dark">
                    {item.summonedPersons?.map((person) => person.name).join(', ') || item.summonedPersonName || '—'}
                  </Text>
                </View>
              </View>

              {item.summonReason && (
                <Text className="text-xs text-muted dark:text-muted-dark leading-[17px] mb-2" numberOfLines={2}>Cause: {item.summonReason}</Text>
              )}

              {item.hearingDate && (
                <View className="flex-row items-center gap-1.5 bg-amber-light rounded-md px-2.5 py-[5px] mb-2.5 self-start">
                  <Ionicons name="calendar-outline" size={13} color={Colors.amber} />
                  <Text className="text-xs text-amber font-semibold">{item.hearingDate}</Text>
                </View>
              )}

              <TouchableOpacity
                className="flex-row items-center justify-center gap-1.5 bg-purple rounded-lg py-2.5"
                onPress={() => router.push({ pathname: '/(admin)/complaint-review', params: { reportId: item.id } })}
              >
                <Ionicons name="hammer-outline" size={14} color={Colors.white} />
                <Text className="text-[13px] font-bold text-white">Process Summon</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}
