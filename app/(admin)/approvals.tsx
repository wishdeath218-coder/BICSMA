import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../src/context/AppContext';
import { ResidentAccount } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import EmptyState from '../../src/components/EmptyState';
import { api } from '../../src/lib/api';

type StatusFilter = 'All' | 'Pending' | 'Approved' | 'Rejected' | 'Blocked';
const STATUS_FILTERS: StatusFilter[] = ['All', 'Pending', 'Approved', 'Rejected', 'Blocked'];

import { stickyHeader } from '../../src/utils/ui';

export default function ResidentApprovalsScreen() {
  const { accounts, createResidentAccount, updateAccountStatus } = useApp();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  const [createAccountVisible, setCreateAccountVisible] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newResident, setNewResident] = useState({
    name: '',
    username: '',
    cpNumber: '',
    address: '',
    password: '',
    confirmPassword: '',
  });
  const [rejectModal, setRejectModal] = useState<ResidentAccount | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [detailModal, setDetailModal] = useState<ResidentAccount | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<{ accountId: string; uri: string } | null>(null);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const matchStatus = statusFilter === 'All' || a.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.username.toLowerCase().includes(q) || a.cpNumber.includes(q);
      return matchStatus && matchSearch;
    });
  }, [accounts, search, statusFilter]);

  const pendingCount = accounts.filter((a) => a.status === 'Pending').length;
  const approvedCount = accounts.filter((a) => a.status === 'Approved').length;
  const rejectedCount = accounts.filter((a) => a.status === 'Rejected').length;
  const blockedCount = accounts.filter((a) => a.status === 'Blocked').length;

  const resetNewResident = () => {
    setNewResident({ name: '', username: '', cpNumber: '', address: '', password: '', confirmPassword: '' });
  };

  const handleCreateResident = async () => {
    if (creatingAccount) return;
    if (newResident.password !== newResident.confirmPassword) {
      Toast.show({ type: 'error', text1: 'Password Mismatch', text2: 'The passwords do not match.' });
      return;
    }

    setCreatingAccount(true);
    try {
      const registeredDate = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const account = await createResidentAccount({
        name: newResident.name,
        username: newResident.username,
        cpNumber: newResident.cpNumber,
        address: newResident.address,
        password: newResident.password,
        registeredDate,
      });
      setCreateAccountVisible(false);
      resetNewResident();
      Toast.show({
        type: 'success',
        text1: 'Resident Account Created',
        text2: `${account.name} can sign in as @${account.username}. Sign out to use the resident account.`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Unable to Create Account',
        text2: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleApprove = async (account: ResidentAccount) => {
    if (approvingId) return;
    setApprovingId(account.id);
    try {
      await updateAccountStatus(account.id, 'Approved');
      Toast.show({ type: 'success', text1: 'Account Approved', text2: `${account.name} can now sign in.` });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Approval Failed',
        text2: error instanceof Error ? error.message : 'Unable to approve this account. Please try again.',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    if (!rejectionReason.trim()) { Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter a rejection reason.' }); return; }
    await updateAccountStatus(rejectModal.id, 'Rejected', rejectionReason);
    Toast.show({ type: 'success', text1: 'Account Rejected', text2: `${rejectModal.name}'s request has been declined.` });
    setRejectModal(null);
    setRejectionReason('');
  };

  const handleViewVerificationDocument = async (account: ResidentAccount) => {
    if (account.verificationDocumentUri) {
      setDocumentPreview({ accountId: account.id, uri: account.verificationDocumentUri });
      return;
    }
    try {
      const uri = await api.getVerificationDocumentUrl(account.id);
      setDocumentPreview({ accountId: account.id, uri });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Unable to Open Photo',
        text2: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const statusColor: Record<ResidentAccount['status'], { bg: string; text: string; border: string }> = {
    Pending: { bg: Colors.amberLight, text: Colors.amber, border: '#fde68a' },
    Approved: { bg: Colors.greenLight, text: Colors.green, border: '#bbf7d0' },
    Rejected: { bg: Colors.redLight, text: Colors.red, border: '#fecaca' },
    Blocked: { bg: '#e5e7eb', text: '#374151', border: '#d1d5db' },
  };

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <View
        className="bg-white dark:bg-surface-dark px-4 pb-3 border-b border-border dark:border-border-dark gap-2.5"
        style={[stickyHeader, { paddingTop: insets.top + 12 }]}
      >
        <Text className="text-xl font-black text-ink dark:text-ink-dark">Account Approvals</Text>
        <Text className="text-xs text-muted dark:text-muted-dark">Review resident and admin access requests</Text>
        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 rounded-[10px] bg-primary py-3"
          onPress={() => setCreateAccountVisible(true)}
        >
          <Ionicons name="person-add-outline" size={17} color={Colors.white} />
          <Text className="text-sm font-bold text-white">Create Resident Account</Text>
        </TouchableOpacity>

        {/* Stats */}
        <View className="flex-row gap-2">
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-amber-light" style={{ borderColor: '#fde68a' }}>
            <Text className="text-xl font-black text-amber">{pendingCount}</Text>
            <Text className="text-[10px] font-semibold text-amber">Pending</Text>
          </View>
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-green-light" style={{ borderColor: '#bbf7d0' }}>
            <Text className="text-xl font-black text-green">{approvedCount}</Text>
            <Text className="text-[10px] font-semibold text-green">Approved</Text>
          </View>
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-red-light" style={{ borderColor: '#fecaca' }}>
            <Text className="text-xl font-black text-red">{rejectedCount}</Text>
            <Text className="text-[10px] font-semibold text-red">Rejected</Text>
          </View>
          <View className="flex-1 rounded-[10px] border p-2.5 items-center bg-gray-light" style={{ borderColor: '#d1d5db' }}>
            <Text className="text-xl font-black text-gray">{blockedCount}</Text>
            <Text className="text-[10px] font-semibold text-gray">Blocked</Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center gap-2 bg-gray-light dark:bg-surface-dark-2 rounded-[10px] border border-border dark:border-border-dark px-3 h-[42px]">
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput className="flex-1 text-sm text-ink dark:text-ink-dark" placeholder="Search by name, username, contact…" placeholderTextColor={Colors.textMuted} value={search} onChangeText={setSearch} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={Colors.textMuted} /></TouchableOpacity> : null}
        </View>

        {/* Filter */}
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
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No accounts found" subtitle="Try a different filter." />}
        renderItem={({ item }) => {
          const sc = statusColor[item.status];
          return (
            <TouchableOpacity
              className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-3.5 mb-2.5"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
              onPress={() => setDetailModal(item)}
              activeOpacity={0.8}
            >
              <View className="flex-row items-start gap-2.5">
                <View className="w-11 h-11 rounded-[22px] bg-blue-light items-center justify-center">
                  <Text className="text-lg font-extrabold text-blue">{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-extrabold text-ink dark:text-ink-dark">{item.name}</Text>
                  <Text className="text-xs text-muted dark:text-muted-dark mt-px">@{item.username}</Text>
                  <Text className="mt-1 self-start rounded-md bg-blue-light px-2 py-0.5 text-[10px] font-bold uppercase text-blue">
                    {item.role === 'admin' ? 'Barangay Admin' : 'Resident'}
                  </Text>
                  {item.role === 'admin' && item.barangayPosition ? (
                    <Text className="mt-1 text-[11px] font-semibold text-ink dark:text-ink-dark">
                      {item.barangayPosition}
                    </Text>
                  ) : null}
                  <Text className="text-[11px] text-muted dark:text-muted-dark mt-0.5">{item.cpNumber} · {item.address}</Text>
                </View>
                <View className="px-2.5 py-[3px] rounded-[10px] border self-start" style={{ backgroundColor: sc.bg, borderColor: sc.border }}>
                  <Text className="text-[11px] font-bold" style={{ color: sc.text }}>{item.status}</Text>
                </View>
              </View>

              {item.status === 'Rejected' && item.rejectionReason && (
                <Text className="text-[11px] text-red mt-2 italic" numberOfLines={1}>Reason: {item.rejectionReason}</Text>
              )}

              {item.status === 'Pending' && (
                <View className="flex-row gap-2.5 mt-3">
                  <TouchableOpacity
                    className={`flex-1 flex-row items-center justify-center gap-1.5 py-[9px] rounded-lg bg-green-light border ${approvingId ? 'opacity-60' : ''}`}
                    style={{ borderColor: '#bbf7d0' }}
                    disabled={approvingId !== null}
                    onPress={(e) => { e.stopPropagation?.(); handleApprove(item); }}
                  >
                    <Ionicons name="checkmark-outline" size={14} color={Colors.green} />
                    <Text className="text-[13px] font-bold text-green">Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-[9px] rounded-lg bg-red-light border"
                    style={{ borderColor: '#fecaca' }}
                    onPress={(e) => { e.stopPropagation?.(); setRejectModal(item); }}
                  >
                    <Ionicons name="close-outline" size={14} color={Colors.red} />
                    <Text className="text-[13px] font-bold text-red">Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Create Resident Account Modal */}
      <Modal
        visible={createAccountVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setCreateAccountVisible(false); resetNewResident(); }}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-surface-dark rounded-t-[20px] p-5 pb-9" style={{ maxHeight: '90%' }}>
            <Text className="text-lg font-extrabold text-ink dark:text-ink-dark mb-1">Create Resident Account</Text>
            <Text className="text-[13px] text-muted dark:text-muted-dark mb-3">
              This account is approved immediately. Sign out and use its login to submit resident reports.
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TextInput
                className="mb-2.5 h-11 rounded-lg border border-border bg-gray-light px-3 text-sm text-ink dark:border-border-dark dark:bg-surface-dark-2 dark:text-ink-dark"
                placeholder="Resident full name"
                placeholderTextColor={Colors.textMuted}
                value={newResident.name}
                onChangeText={(name) => setNewResident((current) => ({ ...current, name }))}
                autoCapitalize="words"
              />
              <TextInput
                className="mb-2.5 h-11 rounded-lg border border-border bg-gray-light px-3 text-sm text-ink dark:border-border-dark dark:bg-surface-dark-2 dark:text-ink-dark"
                placeholder="Username (3–30 characters)"
                placeholderTextColor={Colors.textMuted}
                value={newResident.username}
                onChangeText={(username) => setNewResident((current) => ({ ...current, username }))}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                className="mb-2.5 h-11 rounded-lg border border-border bg-gray-light px-3 text-sm text-ink dark:border-border-dark dark:bg-surface-dark-2 dark:text-ink-dark"
                placeholder="Contact number (09XX-XXX-XXXX)"
                placeholderTextColor={Colors.textMuted}
                value={newResident.cpNumber}
                onChangeText={(cpNumber) => setNewResident((current) => ({ ...current, cpNumber }))}
                keyboardType="phone-pad"
              />
              <TextInput
                className="mb-2.5 h-11 rounded-lg border border-border bg-gray-light px-3 text-sm text-ink dark:border-border-dark dark:bg-surface-dark-2 dark:text-ink-dark"
                placeholder="Address / Purok"
                placeholderTextColor={Colors.textMuted}
                value={newResident.address}
                onChangeText={(address) => setNewResident((current) => ({ ...current, address }))}
                autoCapitalize="words"
              />
              <TextInput
                className="mb-2.5 h-11 rounded-lg border border-border bg-gray-light px-3 text-sm text-ink dark:border-border-dark dark:bg-surface-dark-2 dark:text-ink-dark"
                placeholder="Password (at least 8 characters)"
                placeholderTextColor={Colors.textMuted}
                value={newResident.password}
                onChangeText={(password) => setNewResident((current) => ({ ...current, password }))}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                className="mb-3 h-11 rounded-lg border border-border bg-gray-light px-3 text-sm text-ink dark:border-border-dark dark:bg-surface-dark-2 dark:text-ink-dark"
                placeholder="Confirm password"
                placeholderTextColor={Colors.textMuted}
                value={newResident.confirmPassword}
                onChangeText={(confirmPassword) => setNewResident((current) => ({ ...current, confirmPassword }))}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                className={`items-center rounded-[10px] bg-primary p-3 ${creatingAccount ? 'opacity-60' : ''}`}
                onPress={handleCreateResident}
                disabled={creatingAccount}
              >
                <Text className="text-sm font-bold text-white">{creatingAccount ? 'Creating…' : 'Create Approved Account'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="mt-2 items-center rounded-[10px] bg-gray-light p-3 dark:bg-surface-dark-2"
                onPress={() => { setCreateAccountVisible(false); resetNewResident(); }}
                disabled={creatingAccount}
              >
                <Text className="text-sm font-bold text-gray dark:text-ink-dark">Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal visible={!!rejectModal} transparent animationType="slide" onRequestClose={() => setRejectModal(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-surface-dark rounded-t-[20px] p-5 pb-9">
            <Text className="text-lg font-extrabold text-ink dark:text-ink-dark mb-1.5">Reject Account</Text>
            <Text className="text-[13px] text-muted dark:text-muted-dark mb-3.5">Provide a reason for rejecting {rejectModal?.name}'s request.</Text>
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
              <TouchableOpacity className="flex-1 h-[46px] rounded-[10px] items-center justify-center bg-gray-light dark:bg-surface-dark-2" onPress={() => { setRejectModal(null); setRejectionReason(''); }}>
                <Text className="text-sm font-bold text-gray dark:text-ink-dark">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 h-[46px] rounded-[10px] items-center justify-center bg-red" onPress={handleRejectConfirm}>
                <Text className="text-sm font-bold text-white">Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!detailModal} transparent animationType="fade" onRequestClose={() => setDetailModal(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-surface-dark rounded-[20px] m-6 p-6">
            <View className="relative items-center mb-3">
              <View className="w-16 h-16 rounded-[32px] bg-blue-light items-center justify-center">
                <Text className="text-[28px] font-black text-blue">{detailModal?.name.charAt(0).toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModal(null)} className="absolute right-0 top-0">
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text className="text-lg font-extrabold text-ink dark:text-ink-dark text-center mb-3.5">{detailModal?.name}</Text>
            <DetailRow label="Username" value={detailModal?.username || ''} />
            <DetailRow label="Role" value={detailModal?.role === 'admin' ? 'Barangay Admin' : 'Resident'} />
            {detailModal?.role === 'admin' ? (
              <DetailRow label="Position" value={detailModal.barangayPosition || ''} />
            ) : null}
            <DetailRow label="Contact" value={detailModal?.cpNumber || ''} />
            <DetailRow label="Address" value={detailModal?.address || ''} />
            <DetailRow label="Registered" value={detailModal?.registeredDate || ''} />
            {detailModal?.rejectionReason && <DetailRow label="Rejection" value={detailModal.rejectionReason} />}
            {detailModal?.verificationDocumentPath || detailModal?.verificationDocumentUri ? (
              <>
                <TouchableOpacity
                  className="mt-3 items-center rounded-[10px] bg-blue-light p-3"
                  onPress={() => handleViewVerificationDocument(detailModal)}
                >
                  <Text className="text-sm font-bold text-primary">View Verification Photo</Text>
                </TouchableOpacity>
                {documentPreview?.accountId === detailModal.id ? (
                  <Image
                    source={{ uri: documentPreview.uri }}
                    resizeMode="contain"
                    className="mt-3 h-40 w-full rounded-lg bg-gray-light"
                  />
                ) : null}
              </>
            ) : (
              <DetailRow label="Verification" value="No document uploaded" />
            )}
            <TouchableOpacity className="mt-4 items-center p-3 bg-gray-light dark:bg-surface-dark-2 rounded-[10px]" onPress={() => setDetailModal(null)}>
              <Text className="text-sm font-bold text-gray dark:text-ink-dark">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2.5 border-b border-border dark:border-border-dark gap-2.5">
      <Text className="text-xs font-bold text-muted dark:text-muted-dark w-20">{label}</Text>
      <Text className="flex-1 text-[13px] text-ink dark:text-ink-dark text-right">{value}</Text>
    </View>
  );
}
