import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, ScrollView, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { Announcement } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import EmptyState from '../../src/components/EmptyState';
import { stickyHeader } from '../../src/utils/ui';

type Filter = 'All' | 'News' | 'Advisory' | 'Event';
const FILTERS: Filter[] = ['All', 'News', 'Advisory', 'Event'];

function typeMeta(type: Announcement['type']) {
  switch (type) {
    case 'Advisory': return { icon: 'warning-outline' as const, color: Colors.red, bg: Colors.redLight, border: '#fecaca' };
    case 'Event': return { icon: 'calendar-outline' as const, color: Colors.blue, bg: Colors.blueLight, border: '#bfdbfe' };
    case 'News': return { icon: 'newspaper-outline' as const, color: Colors.green, bg: Colors.greenLight, border: '#bbf7d0' };
  }
}

function AnnouncementCard({ ann, onPress }: { ann: Announcement; onPress: () => void }) {
  const meta = typeMeta(ann.type);
  return (
    <TouchableOpacity
      className="bg-white dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark mb-3.5 overflow-hidden"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {ann.image ? (
        <Image source={{ uri: ann.image }} className="w-full h-40" resizeMode="cover" />
      ) : (
        <View className="w-full h-[120px] items-center justify-center" style={{ backgroundColor: meta.bg }}>
          <Ionicons name={meta.icon} size={40} color={meta.color} />
        </View>
      )}
      <View className="p-3.5">
        <View className="flex-row items-center gap-2 mb-2 flex-wrap">
          <View className="px-2.5 py-[3px] rounded-xl border" style={{ backgroundColor: meta.bg, borderColor: meta.border }}>
            <Text className="text-[11px] font-bold" style={{ color: meta.color }}>{ann.type}</Text>
          </View>
          {ann.urgent && (
            <View className="bg-red-light rounded-md px-[7px] py-0.5">
              <Text className="text-[10px] font-extrabold text-red">URGENT</Text>
            </View>
          )}
          {ann.timeLeft && <Text className="text-[11px] text-amber font-semibold">{ann.timeLeft}</Text>}
        </View>
        <Text className="text-[15px] font-extrabold text-ink dark:text-ink-dark mb-1" numberOfLines={2}>{ann.title}</Text>
        <Text className="text-[13px] text-muted dark:text-muted-dark leading-[18px] mb-2" numberOfLines={2}>{ann.summary}</Text>
        <View className="flex-row justify-between items-center">
          <Text className="text-[11px] text-muted dark:text-muted-dark">{ann.date}</Text>
          {ann.engagementCount ? (
            <Text className="text-[11px] text-muted dark:text-muted-dark">{ann.engagementCount} interested</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CommunityFeedScreen() {
  const { announcements } = useApp();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<Filter>('All');
  const [selected, setSelected] = useState<Announcement | null>(null);

  const filtered = filter === 'All' ? announcements : announcements.filter((a) => a.type === filter);

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <View
        className="bg-white dark:bg-surface-dark px-5 pb-3 border-b border-border dark:border-border-dark"
        style={[stickyHeader, { paddingTop: insets.top + 12 }]}
      >
        <Text className="text-[22px] font-black text-ink dark:text-ink-dark">Community Feed</Text>
        <Text className="text-[13px] text-muted dark:text-muted-dark mb-3">Announcements, Advisories & Events</Text>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                className={`px-4 py-[7px] rounded-[20px] border ${
                  active ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'
                }`}
                onPress={() => setFilter(f)}
              >
                <Text className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="megaphone-outline" title="No bulletins found" subtitle="Try a different filter." />}
        renderItem={({ item }) => <AnnouncementCard ann={item} onPress={() => setSelected(item)} />}
      />

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View className="flex-1 bg-white dark:bg-surface-dark">
            <View
              className="flex-row justify-between items-center px-5 pb-3 border-b border-border dark:border-border-dark"
              style={{ paddingTop: insets.top + 8 }}
            >
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text className="text-base font-bold text-ink dark:text-ink-dark flex-1 text-center" numberOfLines={1}>{selected.type}</Text>
              <View className="w-6" />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {selected.image ? (
                <Image source={{ uri: selected.image }} className="w-full h-[220px]" resizeMode="cover" />
              ) : (
                <View className="w-full h-[180px] items-center justify-center" style={{ backgroundColor: typeMeta(selected.type).bg }}>
                  <Ionicons name={typeMeta(selected.type).icon} size={56} color={typeMeta(selected.type).color} />
                </View>
              )}

              <View className="p-5">
                <View className="flex-row gap-2 mb-3 flex-wrap">
                  <View
                    className="px-2.5 py-[3px] rounded-xl border"
                    style={{ backgroundColor: typeMeta(selected.type).bg, borderColor: typeMeta(selected.type).border }}
                  >
                    <Text className="text-[11px] font-bold" style={{ color: typeMeta(selected.type).color }}>{selected.type}</Text>
                  </View>
                  {selected.urgent && (
                    <View className="bg-red-light rounded-md px-[7px] py-0.5">
                      <Text className="text-[10px] font-extrabold text-red">URGENT</Text>
                    </View>
                  )}
                </View>

                <Text className="text-xl font-black text-ink dark:text-ink-dark leading-[26px] mb-1.5">{selected.title}</Text>
                <Text className="text-xs text-muted dark:text-muted-dark mb-3">{selected.date}</Text>

                {selected.timeLeft && (
                  <View className="flex-row items-center gap-1.5 bg-amber-light rounded-lg p-2.5 mb-3.5">
                    <Ionicons name="time-outline" size={14} color={Colors.amber} />
                    <Text className="text-[13px] text-amber font-semibold">{selected.timeLeft}</Text>
                  </View>
                )}

                <Text className="text-sm text-ink dark:text-ink-dark leading-[22px]">{selected.content}</Text>

                {selected.attachment && (
                  <View className="flex-row items-center gap-2 bg-blue-light rounded-lg p-2.5 mt-4">
                    <Ionicons name="document-attach-outline" size={16} color={Colors.blue} />
                    <Text className="text-[13px] text-blue font-semibold">{selected.attachment}</Text>
                  </View>
                )}

                {selected.engagementCount ? (
                  <Text className="mt-3.5 text-[13px] text-muted dark:text-muted-dark">{selected.engagementCount} residents are interested</Text>
                ) : null}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}
