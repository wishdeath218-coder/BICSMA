import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useApp } from '../../src/context/AppContext';
import { Colors } from '../../src/constants/colors';
import LogoutModal from '../../src/components/LogoutModal';
import ThemeToggle from '../../src/components/ThemeToggle';
import EmergencyCallPanel from '../../src/components/EmergencyCallPanel';
import { stickyHeader } from '../../src/utils/ui';
import { api } from '../../src/lib/api';

export default function CivicHubScreen() {
  const { loggedInUser, loggedInUsername, role, reports, announcements, logout } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [caseStats, setCaseStats] = useState<{
    resolvedCount: number;
    activeCount: number;
    totalCount: number;
  } | null>(null);
  const recentAnnouncements = announcements.slice(0, 3);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setCaseStats(null);
      api.fetchCommunityCaseStats()
        .then((stats) => {
          if (active) setCaseStats(stats);
        })
        .catch((error: unknown) => {
          console.error('[CivicHub] failed to load community case statistics:', error);
          if (active) {
            Toast.show({
              type: 'error',
              text1: 'Unable to Load Case Statistics',
              text2: error instanceof Error ? error.message : 'Please try again.',
            });
          }
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const resolutionsByMonth: Record<string, number> = {};
  reports.forEach((report) => {
    if (report.status !== 'Resolved') return;
    const resolution = [...report.timeline].reverse().find((item) => item.status === 'Resolved');
    if (!resolution) return;

    const resolvedAt = new Date(resolution.date.split(' • ')[0]);
    if (Number.isNaN(resolvedAt.getTime())) return;

    const key = `${resolvedAt.getFullYear()}-${resolvedAt.getMonth()}`;
    resolutionsByMonth[key] = (resolutionsByMonth[key] || 0) + 1;
  });

  const currentMonth = new Date();
  const monthlyData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 6 + index, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    return {
      key,
      month: date.toLocaleString('en-US', { month: 'short' }),
      value: resolutionsByMonth[key] || 0,
    };
  });

  const maxMonthVal = Math.max(...monthlyData.map((item) => item.value), 1);

  const handleLogout = async () => {
    setLogoutVisible(false);
    await logout();
    router.replace('/auth/login');
  };

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        className="px-5 pb-5"
        style={[stickyHeader, { paddingTop: insets.top + 16 }]}
      >
        <View className="mb-3 flex-row items-start justify-between" style={{ marginHorizontal: 12 }}>
          <View>
            <Text className="text-lg font-extrabold text-white">Mabuhay, {loggedInUser || 'Resident'}!</Text>
            <Text className="mt-0.5 text-xs text-white/70">Barangay Bangbang Civil Portal</Text>
          </View>

          <View className="flex-row items-center">
            <ThemeToggle color="rgba(255,255,255,0.85)" />
            <TouchableOpacity onPress={() => setLogoutVisible(true)} className="p-1.5">
              <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row m-2">
          <TouchableOpacity
            className="mr-2 flex-1 items-center justify-center rounded-[10px] bg-white/15 py-2.5"
            onPress={() => router.push('/(resident)/report-wizard')}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
            <Text className="mt-1 text-xs font-bold text-white">File Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mr-2 flex-1 items-center justify-center rounded-[10px] bg-white/15 py-2.5"
            onPress={() => router.push('/(resident)/my-reports')}
          >
            <Ionicons name="document-text-outline" size={20} color={Colors.white} />
            <Text className="mt-1 text-xs font-bold text-white">My Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 items-center justify-center rounded-[10px] bg-white/15 py-2.5"
            onPress={() => router.push('/(resident)/community-feed')}
          >
            <Ionicons name="megaphone-outline" size={20} color={Colors.white} />
            <Text className="mt-1 text-xs font-bold text-white">Bulletins</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <EmergencyCallPanel />
                  
        <View className="mb-5 flex-row">
          <View className="mr-2 flex-1 rounded-xl border border-[#bbf7d0] bg-green-light p-3 items-center">
            <Text className="text-[22px] font-black text-green">{caseStats?.resolvedCount ?? '—'}</Text>
            <Text className="mt-0.5 text-[11px] font-semibold text-green">Resolved</Text>
          </View>

          <View className="mr-2 flex-1 rounded-xl border border-[#fde68a] bg-amber-light p-3 items-center">
            <Text className="text-[22px] font-black text-amber">{caseStats?.activeCount ?? '—'}</Text>
            <Text className="mt-0.5 text-[11px] font-semibold text-amber">Active Cases</Text>
          </View>

          <View className="flex-1 rounded-xl border border-[#bfdbfe] bg-blue-light p-3 items-center">
            <Text className="text-[22px] font-black text-blue">{caseStats?.totalCount ?? '—'}</Text>
            <Text className="mt-0.5 text-[11px] font-semibold text-blue">Total Filed</Text>
          </View>
        </View>

        <View className="mb-5">
          <Text className="mb-3 text-[15px] font-extrabold text-ink dark:text-ink-dark">
            Monthly Resolution Trend
          </Text>

          {monthlyData.some((item) => item.value > 0) ? (
            <View className="rounded-2xl border border-border bg-white p-3 dark:border-border-dark dark:bg-surface-dark">
              <View className="h-[120px] flex-row items-end justify-between">
                {monthlyData.map((item) => (
                  <View key={item.key} className="flex-1 items-center justify-end px-1">
                    <Text className="mb-1 text-[9px] font-bold text-muted dark:text-muted-dark">{item.value}</Text>
                    <View className="w-full items-center justify-end overflow-hidden rounded-t-md bg-gray-light dark:bg-surface-dark-2">
                      <View
                        className="w-[80%] rounded-t-md bg-primary"
                        style={{ height: `${Math.max((item.value / maxMonthVal) * 100, item.value > 0 ? 12 : 4)}%` }}
                      />
                    </View>
                    <Text className="mt-1 text-[9px] font-semibold text-muted dark:text-muted-dark">{item.month}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View className="rounded-2xl border border-border bg-white p-4 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[13px] text-muted dark:text-muted-dark">
                No resolved reports in the last seven months.
              </Text>
            </View>
          )}
        </View>

        <View className="mb-5">
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="text-[15px] font-extrabold text-ink dark:text-ink-dark">Recent Bulletins</Text>
            <TouchableOpacity onPress={() => router.push('/(resident)/community-feed')}>
              <Text className="text-[13px] font-semibold text-blue">See All</Text>
            </TouchableOpacity>
          </View>

          {recentAnnouncements.map((announcement) => (
            <TouchableOpacity
              key={announcement.id}
              className="mb-2 flex-row items-center rounded-[10px] border border-border bg-white p-3 dark:border-border-dark dark:bg-surface-dark"
              onPress={() => router.push('/(resident)/community-feed')}
              activeOpacity={0.8}
            >
              <View
                className="mr-2 h-[38px] w-[38px] items-center justify-center rounded-[10px]"
                style={{
                  backgroundColor:
                    announcement.type === 'Advisory'
                      ? Colors.redLight
                      : announcement.type === 'Event'
                        ? Colors.blueLight
                        : Colors.greenLight,
                }}
              >
                <Ionicons
                  name={
                    announcement.type === 'Advisory'
                      ? 'warning-outline'
                      : announcement.type === 'Event'
                        ? 'calendar-outline'
                        : 'newspaper-outline'
                  }
                  size={18}
                  color={Colors.primary}
                />
              </View>

              <View className="flex-1">
                <View className="mb-0.5 flex-row items-center">
                  <Text className="text-[10px] font-bold uppercase text-muted dark:text-muted-dark">
                    {announcement.type}
                  </Text>
                  {announcement.urgent ? (
                    <View className="ml-2 rounded px-1.5 py-px bg-red-light">
                      <Text className="text-[9px] font-extrabold text-red">URGENT</Text>
                    </View>
                  ) : null}
                </View>

                <Text className="text-[13px] font-bold text-ink dark:text-ink-dark" numberOfLines={1}>
                  {announcement.title}
                </Text>
                <Text className="mt-px text-[11px] text-muted dark:text-muted-dark">{announcement.date}</Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <LogoutModal
        visible={logoutVisible}
        name={loggedInUser}
        username={loggedInUsername}
        role={role}
        onCancel={() => setLogoutVisible(false)}
        onConfirm={handleLogout}
      />
    </View>
  );
}
