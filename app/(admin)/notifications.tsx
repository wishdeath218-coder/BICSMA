import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { CivilNotification } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import EmptyState from '../../src/components/EmptyState';
import { stickyHeader } from '../../src/utils/ui';

function notifIcon(type: CivilNotification['type']): { name: any; color: string; bg: string } {
  switch (type) {
    case 'report':       return { name: 'document-text-outline', color: Colors.blue,   bg: Colors.blueLight };
    case 'announcement': return { name: 'megaphone-outline',      color: Colors.green,  bg: Colors.greenLight };
    case 'system':       return { name: 'people-outline',         color: Colors.purple, bg: Colors.purpleLight };
  }
}

export default function AdminNotificationsScreen() {
  const { notifications, markNotificationRead, markAllRead, unreadCount } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handlePress = async (notif: CivilNotification) => {
    if (!notif.isRead) await markNotificationRead(notif.id);

    if (notif.type === 'report' && notif.targetId) {
      router.push({
        pathname: '/(admin)/complaint-review',
        params: {
          reportId: notif.targetId,
          ...(notif.targetGroupId ? { groupId: notif.targetGroupId } : {}),
        },
      });
      return;
    }

    if (notif.type === 'system') {
      router.push('/(admin)/approvals');
      return;
    }

    if (notif.type === 'announcement') {
      router.push('/(admin)/announcements');
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
            {unreadCount > 0 && (
              <Text className="text-[13px] text-muted dark:text-muted-dark mt-0.5">{unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}</Text>
            )}
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
            title="No notifications"
            subtitle="New complaints, account requests, and bulletins will appear here."
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
                {(item.type === 'report' || item.type === 'system') && (
                  <View className="flex-row items-center gap-0.5 mt-[5px]">
                    <Text className="text-[11px] text-blue font-semibold">
                      {item.type === 'report' ? 'Tap to review complaint' : 'Tap to view account request'}
                    </Text>
                    <Ionicons name="chevron-forward" size={11} color={Colors.blue} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
