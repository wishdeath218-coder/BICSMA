import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import Toast from 'react-native-toast-message';
import { CivilNotification, ComplaintReport, isSummonReport } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import EmptyState from '../../src/components/EmptyState';
import StatusBadge from '../../src/components/StatusBadge';
import TimelineView from '../../src/components/TimelineView';
import { stickyHeader } from '../../src/utils/ui';

function notifIcon(type: CivilNotification['type']): { name: any; color: string; bg: string } {
  switch (type) {
    case 'report': return { name: 'document-text-outline', color: Colors.blue, bg: Colors.blueLight };
    case 'announcement': return { name: 'megaphone-outline', color: Colors.green, bg: Colors.greenLight };
    case 'system': return { name: 'settings-outline', color: Colors.gray, bg: Colors.grayLight };
  }
}

export default function NotificationsScreen() {
  const { notifications, markNotificationRead, markAllRead, unreadCount, reports, refreshNotificationData } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedReport, setSelectedReport] = useState<ComplaintReport | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<CivilNotification | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshNotificationData().catch((error: unknown) => {
        console.error('[Notifications] failed to refresh notification data:', error);
        Toast.show({
          type: 'error',
          text1: 'Unable to Refresh Notifications',
          text2: error instanceof Error ? error.message : 'Please try again.',
        });
      });
    }, [refreshNotificationData]),
  );

  const handlePress = async (notif: CivilNotification) => {
    if (!notif.isRead) await markNotificationRead(notif.id);

    if (notif.type === 'report' && notif.targetId) {
      let report = reports.find((r) => r.id === notif.targetId);
      if (!report) {
        try {
          const freshReports = await refreshNotificationData();
          report = freshReports.find((r) => r.id === notif.targetId);
        } catch (error) {
          console.error('[Notifications] failed to load report details:', error);
          Toast.show({
            type: 'error',
            text1: 'Unable to Load Report',
            text2: error instanceof Error ? error.message : 'Please try again.',
          });
        }
      }
      if (report) {
        setSelectedReport(report);
        setSelectedNotification(notif);
        return;
      }
    }

    if (notif.type === 'announcement') {
      router.push('/(resident)/community-feed');
      return;
    }
  };

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <View
        className="bg-white dark:bg-surface-dark px-5 pb-3.5 border-b border-border dark:border-border-dark"
        style={[stickyHeader, { paddingTop: insets.top + 12 }]}
      >
        <View className="flex-row justify-between items-end">
          <View>
            <Text className="text-[22px] font-black text-ink dark:text-ink-dark">Notifications</Text>
            {unreadCount > 0 && <Text className="text-[13px] text-muted dark:text-muted-dark mt-0.5">{unreadCount} unread</Text>}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity className="px-3 py-1.5 bg-blue-light rounded-lg" onPress={markAllRead}>
              <Text className="text-[13px] font-bold text-blue">Mark All Read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="No notifications yet"
            subtitle="Updates on your reports and barangay bulletins will appear here."
          />
        }
        renderItem={({ item }) => {
          const meta = notifIcon(item.type);
          return (
            <TouchableOpacity
              className={`flex-row items-start gap-3 rounded-xl border p-3.5 mb-2.5 ${
                item.isRead ? 'bg-white dark:bg-surface-dark border-border dark:border-border-dark' : 'border-[#bfdbfe]'
              }`}
              style={[
                { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
                !item.isRead ? { backgroundColor: '#f0f6ff' } : null,
              ]}
              onPress={() => handlePress(item)}
              activeOpacity={0.8}
            >
              <View className="w-10 h-10 rounded-[10px] items-center justify-center" style={{ backgroundColor: meta.bg }}>
                <Ionicons name={meta.name} size={20} color={meta.color} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-ink dark:text-ink-dark flex-1 mr-2" numberOfLines={1}>{item.title}</Text>
                  {!item.isRead && <View className="w-2 h-2 rounded-full bg-blue" />}
                </View>
                <Text className="text-[13px] text-muted dark:text-muted-dark leading-[18px] mt-[3px]" numberOfLines={2}>{item.description}</Text>
                <Text className="text-[11px] text-muted dark:text-muted-dark mt-1">{item.date}</Text>
                {(item.type === 'report' || item.type === 'announcement') && (
                  <View className="flex-row items-center gap-0.5 mt-[5px]">
                    <Text className="text-[11px] text-blue font-semibold">
                      {item.type === 'report' ? 'Tap to view message and report details' : 'Tap to view bulletin'}
                    </Text>
                    <Ionicons name="chevron-forward" size={11} color={Colors.blue} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Report Detail Modal */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setSelectedReport(null);
          setSelectedNotification(null);
        }}
      >
        {selectedReport && (
          <ReportDetailSheet
            report={selectedReport}
            notification={selectedNotification}
            onClose={() => {
              setSelectedReport(null);
              setSelectedNotification(null);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

// ─── Report Detail Sheet ──────────────────────────────────────────────────────
function ReportDetailSheet({
  report,
  notification,
  onClose,
}: {
  report: ComplaintReport;
  notification: CivilNotification | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isSummon = isSummonReport(report);
  const summonedPersons = report.summonedPersons?.length
    ? report.summonedPersons
    : report.summonedPersonName
      ? [{ name: report.summonedPersonName, address: report.summonedPersonAddress }]
      : [];

  return (
    <View className="flex-1 bg-white dark:bg-surface-dark">
      {/* Header */}
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

      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {notification ? (
          <View className="mx-5 mt-4 rounded-xl border border-[#bfdbfe] bg-blue-light p-3.5">
            <View className="flex-row items-center gap-2 mb-1.5">
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.blue} />
              <Text className="text-xs font-extrabold text-blue">Message from the Barangay</Text>
            </View>
            <Text className="text-[13px] text-ink dark:text-ink-dark leading-[20px]">{notification.description}</Text>
          </View>
        ) : null}
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

        <View className="m-4 bg-gray-light dark:bg-surface-dark-2 rounded-xl border border-border dark:border-border-dark overflow-hidden">
          <InfoRow icon="folder-outline" label="Category" value={report.category} />
          <InfoRow icon="location-outline" label="Location" value={report.location} />
          <InfoRow icon="build-outline" label="Assigned To" value={report.assignee} />
        </View>

        <View className="px-4 mb-4">
          <Text className="text-xs font-extrabold text-primary uppercase tracking-wide mb-2">Description</Text>
          <Text className="text-sm text-ink dark:text-ink-dark leading-[22px]">{report.description}</Text>
        </View>

        {isSummon && (
          <View className="mx-4 mb-4 rounded-xl border border-[#ddd6fe] bg-purple-light p-3.5">
            <Text className="mb-2 text-xs font-extrabold uppercase tracking-wide text-purple">Summon Information</Text>
            {summonedPersons.map((person, index) => (
              <View key={`${person.name}-${index}`}>
                <InfoRow
                  icon="person-remove-outline"
                  label={summonedPersons.length > 1 ? `Person ${index + 1}` : 'Summoned'}
                  value={person.name}
                />
                {person.address ? <InfoRow icon="home-outline" label="Address" value={person.address} /> : null}
              </View>
            ))}
            {report.summonReason ? <InfoRow icon="alert-circle-outline" label="Reason" value={report.summonReason} /> : null}
          </View>
        )}

        {report.status === 'Rejected' && report.rejectionReason && (
          <View className="mx-4 mb-4 bg-red-light rounded-[10px] border p-3.5" style={{ borderColor: '#fecaca' }}>
            <Text className="text-xs font-bold text-red mb-1">Rejection Reason</Text>
            <Text className="text-[13px] text-red leading-[18px]">{report.rejectionReason}</Text>
          </View>
        )}

        <View className="px-4 mb-4">
          <Text className="text-xs font-extrabold text-primary uppercase tracking-wide mb-2">Case Timeline</Text>
          <TimelineView timeline={report.timeline} />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-2.5 py-[11px] px-3.5 border-b border-border dark:border-border-dark">
      <Ionicons name={icon} size={15} color={Colors.textMuted} style={{ marginTop: 1 }} />
      <Text className="text-xs font-bold text-muted dark:text-muted-dark w-[90px] flex-shrink-0">{label}</Text>
      <Text className="flex-1 text-[13px] text-ink dark:text-ink-dark" numberOfLines={2}>{value}</Text>
    </View>
  );
}
