import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ScrollView, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { ComplaintReport } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import StatusBadge from '../../src/components/StatusBadge';
import EmptyState from '../../src/components/EmptyState';
import LogoutModal from '../../src/components/LogoutModal';
import ThemeToggle from '../../src/components/ThemeToggle';
import { useTheme } from '../../src/context/ThemeContext';
import { stickyHeader } from '../../src/utils/ui';

type StatusFilter = 'All' | 'Pending' | 'Investigating' | 'Resolved' | 'Unresolved' | 'Rejected';
const STATUS_FILTERS: StatusFilter[] = ['All', 'Pending', 'Investigating', 'Resolved', 'Unresolved', 'Rejected'];

// A group of complaints about the same issue (Option B).
interface ComplaintGroup {
  groupId: string;
  representative: ComplaintReport; // the primary complaint shown on the card
  members: ComplaintReport[];      // all complaints in the group
  count: number;                   // how many residents reported
}

export default function AdminDashboardScreen() {
  const { reports, assignReports, logout, loggedInUser, loggedInUsername, role } = useApp();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [assigneeModal, setAssigneeModal] = useState<ComplaintGroup | null>(null);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const normalReports = reports.filter((r) => r.priority !== 'Summon' && !r.summonedPersonName);

  // ── Group complaints by group_id ──
  const groups = useMemo<ComplaintGroup[]>(() => {
    const map = new Map<string, ComplaintReport[]>();
    for (const r of normalReports) {
      const gid = r.groupId ?? r.id;
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid)!.push(r);
    }
    const result: ComplaintGroup[] = [];
    for (const [groupId, members] of map) {
      // Representative = the earliest-created (the "original") — approximate by
      // the one whose id === groupId, else the first member.
      const rep = members.find((m) => m.id === groupId) ?? members[0];
      result.push({ groupId, representative: rep, members, count: members.length });
    }
    // Most-reported issues first
    return result.sort((a, b) => b.count - a.count);
  }, [normalReports]);

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      const r = g.representative;
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.summary ?? '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [groups, search, statusFilter]);

  const pending = normalReports.filter((r) => r.status === 'Pending').length;
  const investigating = normalReports.filter((r) => r.status === 'Investigating').length;
  const resolved = normalReports.filter((r) => r.status === 'Resolved').length;
  const assignees = useMemo(
    () => ['Unassigned', ...Array.from(new Set(reports.map((report) => report.assignee.trim()).filter((name) => name && name !== 'Unassigned'))).sort((a, b) => a.localeCompare(b))],
    [reports],
  );

  // Assign an assignee to every complaint in the group (single batched update)
  const handleAssign = async (group: ComplaintGroup, assignee: string) => {
    await assignReports(group.members.map((m) => m.id), assignee);
    setAssigneeModal(null);
  };

  const handleLogout = async () => {
    setLogoutVisible(false);
    await logout();
    router.replace('/auth/login');
  };

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <View
        className="bg-white dark:bg-surface-dark px-4 pb-3 border-b border-border dark:border-border-dark gap-2.5"
        style={[stickyHeader, { paddingTop: insets.top + 12 }]}
      >
        <View className="flex-row justify-between items-start">
          <View>
            <Text className="text-xl font-black text-ink dark:text-ink-dark">Admin Dashboard</Text>
            <Text className="text-xs text-muted dark:text-muted-dark mt-px">Barangay Bangbang — Complaint Management</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <ThemeToggle />
            <TouchableOpacity onPress={() => setLogoutVisible(true)} className="p-1.5">
              <Ionicons name="log-out-outline" size={22} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row gap-2">
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-amber-light" style={{ borderColor: '#fde68a' }}>
            <Text className="text-xl font-black text-amber">{pending}</Text>
            <Text className="text-[10px] font-semibold text-amber">Pending</Text>
          </View>
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-purple-light" style={{ borderColor: '#ddd6fe' }}>
            <Text className="text-xl font-black text-purple">{investigating}</Text>
            <Text className="text-[10px] font-semibold text-purple">Investigating</Text>
          </View>
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-green-light" style={{ borderColor: '#bbf7d0' }}>
            <Text className="text-xl font-black text-green">{resolved}</Text>
            <Text className="text-[10px] font-semibold text-green">Resolved</Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center gap-2 bg-gray-light dark:bg-surface-dark-2 rounded-[10px] border border-border dark:border-border-dark px-3 h-[42px]">
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput className="flex-1 text-sm text-ink dark:text-ink-dark" placeholder="Search complaints…" placeholderTextColor={Colors.textMuted} value={search} onChangeText={setSearch} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={Colors.textMuted} /></TouchableOpacity> : null}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f;
            return (
              <TouchableOpacity
                key={f}
                className={`px-3 py-1.5 rounded-2xl border ${active ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'}`}
                onPress={() => setStatusFilter(f)}
              >
                <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(g) => g.groupId}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="clipboard-outline" title="No complaints found" subtitle="Try adjusting the search or filter." />}
        renderItem={({ item: group }) => {
          const r = group.representative;
          const isGrouped = group.count > 1;
          return (
            <View
              className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-3.5 mb-2.5"
              style={[
                { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
              ]}
            >
              <View className="flex-row items-center gap-2.5">
                <View className="flex-1">
                  <View className="flex-row justify-between items-center mb-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-[11px] font-bold text-muted dark:text-muted-dark">{r.id}</Text>
                      {isGrouped && (
                        <View className="flex-row items-center gap-1 bg-blue-light rounded-full px-2 py-0.5">
                          <Ionicons name="people" size={11} color={Colors.blue} />
                          <Text className="text-[10px] font-extrabold text-blue">{group.count} reporting</Text>
                        </View>
                      )}
                    </View>
                    <StatusBadge status={r.status} small />
                  </View>
                  <Text className="text-sm font-bold text-ink dark:text-ink-dark mb-0.5" numberOfLines={1}>{r.title}</Text>
                  {/* Prefer the AI summary if present */}
                  {r.summary ? (
                    <Text className="text-[11px] text-muted dark:text-muted-dark italic mb-1" numberOfLines={2}>{r.summary}</Text>
                  ) : null}
                  <Text className="text-[11px] text-muted dark:text-muted-dark mb-1.5">{r.category} · {r.date}</Text>
                  <TouchableOpacity
                    className="flex-row items-center gap-1 bg-blue-light rounded-md px-2 py-1 self-start"
                    onPress={() => setAssigneeModal(group)}
                  >
                    <Ionicons name="person-outline" size={12} color={Colors.blue} />
                    <Text className="text-[11px] font-semibold text-blue max-w-[140px]" numberOfLines={1}>{r.assignee}</Text>
                    <Ionicons name="chevron-down" size={12} color={Colors.blue} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  className="flex-row items-center gap-1 bg-primary rounded-lg px-3 py-2"
                  onPress={() =>
                    router.push({
                      pathname: '/(admin)/complaint-review',
                      params: { reportId: r.id, groupId: group.groupId },
                    })
                  }
                >
                  <Text className="text-xs font-bold text-white">Review</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Assignee Picker Modal */}
      <Modal visible={!!assigneeModal} transparent animationType="slide" onRequestClose={() => setAssigneeModal(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-surface-dark rounded-t-[20px] p-5 pb-9">
            <Text className="text-lg font-extrabold text-ink dark:text-ink-dark mb-1">Assign To</Text>
            <Text className="text-[13px] text-muted dark:text-muted-dark mb-4" numberOfLines={1}>
              {assigneeModal?.representative.title}
              {assigneeModal && assigneeModal.count > 1 ? ` · ${assigneeModal.count} reporters` : ''}
            </Text>
            {assignees.map((a) => {
              const active = assigneeModal?.representative.assignee === a;
              return (
                <TouchableOpacity
                  key={a}
                  className={`flex-row items-center gap-2.5 py-3 border-b border-border dark:border-border-dark ${active ? 'bg-blue-light rounded-lg px-2' : ''}`}
                  onPress={() => assigneeModal && handleAssign(assigneeModal, a)}
                >
                  <Ionicons name="person-circle-outline" size={18} color={active ? Colors.primary : Colors.textMuted} />
                  <Text className="flex-1 text-sm text-ink dark:text-ink-dark" style={active ? { color: Colors.primary, fontWeight: '700' } : undefined}>{a}</Text>
                  {active && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity className="mt-3.5 items-center p-3 bg-gray-light dark:bg-surface-dark-2 rounded-[10px]" onPress={() => setAssigneeModal(null)}>
              <Text className="text-[15px] font-bold text-gray dark:text-ink-dark">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
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
