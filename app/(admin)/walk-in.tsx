import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../src/context/AppContext';
import { ComplaintReport, ResidentAccount, SummonedPerson } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import PrimaryButton from '../../src/components/PrimaryButton';

type FilingType = 'Summon' | 'Normal';

import { stickyHeader, nowStamp } from '../../src/utils/ui';

const GENERAL_CATEGORIES: ComplaintReport['category'][] = [
  'Noise Complaint', 'Waste Management', 'Security Incident', 'Public Infrastructure', 'Other Concerns',
];
const SUMMON_CATEGORIES: ComplaintReport['category'][] = [
  'Theft', 'Property Damage', 'Physical Damage', 'Others',
];
const PUROKS = [
  'Purok 1, Barangay Bangbang',
  'Purok 2, Barangay Bangbang',
  'Purok 3, Barangay Bangbang',
  'Purok 4, Barangay Bangbang',
  'Purok 5, Barangay Bangbang',
];

export default function WalkInFilingScreen() {
  const { submitReport, accounts, notifyResident, notifyAdmin } = useApp();
  const insets = useSafeAreaInsets();

  const [filingType, setFilingType] = useState<FilingType>('Normal');

  // Linked resident account (null = walk-in only, no account behind it)
  const [linkedAccount, setLinkedAccount] = useState<ResidentAccount | null>(null);
  const [residentPickerVisible, setResidentPickerVisible] = useState(false);
  const [residentSearch, setResidentSearch] = useState('');
  const [summonedPersonPickerIndex, setSummonedPersonPickerIndex] = useState<number | null>(null);
  const [summonedPersonSearch, setSummonedPersonSearch] = useState('');

  const [complainantName, setComplainantName] = useState('');
  const [complainantContact, setComplainantContact] = useState('');
  const [complainantAddress, setComplainantAddress] = useState('');

  const [summonedPersons, setSummonedPersons] = useState<SummonedPerson[]>([{ name: '', address: '' }]);
  const [summonReason, setSummonReason] = useState('');

  const [caseTitle, setCaseTitle] = useState('');
  const [caseCategory, setCaseCategory] = useState<ComplaintReport['category']>('Other Concerns');
  const [caseDescription, setCaseDescription] = useState('');
  const [caseLocation, setCaseLocation] = useState(PUROKS[0]);

  const [deskOfficer, setDeskOfficer] = useState('Barangay Secretary');
  const [luponAssigned, setLuponAssigned] = useState('Unassigned');

  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState<ComplaintReport | null>(null);
  const [assigneePickerVisible, setAssigneePickerVisible] = useState(false);

  const isSummon = filingType === 'Summon';
  const categoryOptions = isSummon ? SUMMON_CATEGORIES : GENERAL_CATEGORIES;

  // Only approved residents can be linked to a walk-in complaint.
  const approvedAccounts = accounts.filter((account) => account.status === 'Approved');
  const approvedResidentAccounts = approvedAccounts.filter((account) => account.role === 'resident');
  const approvedAdminAccounts = approvedAccounts
    .filter((account) => account.role === 'admin')
    .sort((a, b) => a.name.localeCompare(b.name));
  const filteredAccounts = approvedResidentAccounts.filter((a) => {
    const q = residentSearch.trim().toLowerCase();
    if (!q) return true;
    return a.name.toLowerCase().includes(q) || (a.cpNumber ?? '').toLowerCase().includes(q);
  });
  const filteredSummonedAccounts = approvedResidentAccounts.filter((account) => {
    const q = summonedPersonSearch.trim().toLowerCase();
    if (!q) return true;
    return account.name.toLowerCase().includes(q) || (account.cpNumber ?? '').toLowerCase().includes(q);
  });

  // Pick an existing resident: auto-fills their details and links the report.
  const selectResident = (acct: ResidentAccount) => {
    setLinkedAccount(acct);
    setComplainantName(acct.name);
    setComplainantContact(acct.cpNumber || '');
    setComplainantAddress(acct.address || '');
    setResidentPickerVisible(false);
    setResidentSearch('');
  };

  // Clear the link — the complaint becomes a walk-in with no account behind it.
  const clearResident = () => {
    setLinkedAccount(null);
    setComplainantName('');
    setComplainantContact('');
    setComplainantAddress('');
  };

  const updateSummonedPerson = (index: number, field: 'name' | 'address', value: string) => {
    setSummonedPersons((people) =>
      people.map((person, personIndex) =>
        personIndex === index
          ? { ...person, [field]: value, ...(field === 'name' ? { accountId: undefined } : {}) }
          : person,
      ),
    );
  };

  const selectSummonedResident = (account: ResidentAccount) => {
    if (summonedPersonPickerIndex === null) return;
    setSummonedPersons((people) => people.map((person, index) =>
      index === summonedPersonPickerIndex
        ? { ...person, name: account.name, address: account.address || '', accountId: account.id }
        : person,
    ));
    setSummonedPersonPickerIndex(null);
    setSummonedPersonSearch('');
  };

  const useManualSummonedName = () => {
    if (summonedPersonPickerIndex === null || !summonedPersonSearch.trim()) return;
    updateSummonedPerson(summonedPersonPickerIndex, 'name', summonedPersonSearch.trim());
    setSummonedPersonPickerIndex(null);
    setSummonedPersonSearch('');
  };

  const handleSubmit = async () => {
    if (!complainantName.trim()) { Toast.show({ type: 'error', text1: 'Required', text2: 'Complainant name is required.' }); return; }
    if (!caseTitle.trim()) { Toast.show({ type: 'error', text1: 'Required', text2: 'Case title is required.' }); return; }
    if (caseDescription.trim().length < 10) { Toast.show({ type: 'error', text1: 'Required', text2: 'Please provide a case description.' }); return; }
    if (isSummon && summonedPersons.some((person) => !person.name.trim())) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Enter a name for each person or remove the empty entry.' });
      return;
    }

    setLoading(true);
    const rand = Math.floor(1000 + Math.random() * 9000);
    const stamp = nowStamp();
    const respondents = isSummon
      ? summonedPersons.map((person) => ({
          name: person.name.trim(),
          address: person.address?.trim() || '',
          accountId: person.accountId,
        }))
      : [];

    // If a resident account is linked, attribute the report to their exact
    // account name so it lands in their "My Reports" and notifications.
    const reporter = linkedAccount ? linkedAccount.name : complainantName;

    const newReport: ComplaintReport = {
      id: isSummon ? `#SUM-${rand}` : `#WLK-${rand}`,
      reportType: isSummon ? 'Summon' : 'Complaint',
      title: caseTitle,
      category: caseCategory,
      description: caseDescription,
      location: caseLocation,
      date: stamp,
      status: 'Pending',
      priority: filingType,
      reportedBy: reporter,
      assignee: luponAssigned,
      summonedPersonName: respondents[0]?.name,
      summonedPersonAddress: respondents[0]?.address,
      summonedPersons: respondents.length ? respondents : undefined,
      summonReason: isSummon ? summonReason : undefined,
      summonNoticeStage: isSummon ? '1st Notice' : undefined,
      timeline: [
        { status: 'Pending', date: stamp, note: `Walk-in ${isSummon ? 'summon' : 'complaint'} registered at desk by ${deskOfficer}` },
      ],
    };

    // Route through the AI duplicate check so walk-ins can merge into the same
    // group as resident-filed complaints about the same issue.
    let submissionResult: Awaited<ReturnType<typeof submitReport>>;
    try {
      submissionResult = await submitReport(newReport);
    } catch (e) {
      console.warn('[walk-in] submitReport failed', e);
      setLoading(false);
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: 'Please try again.' });
      return;
    }

    if (luponAssigned !== 'Unassigned') {
      const assignedReport = submissionResult.existingReport ?? newReport;
      try {
        await notifyAdmin(
          luponAssigned,
          `${isSummon ? 'Summon' : 'Complaint'} Assigned to You`,
          `The walk-in case "${caseTitle}" has been assigned to you. Reference: ${assignedReport.id}.`,
          assignedReport.id,
          assignedReport.groupId ?? assignedReport.id,
        );
      } catch (e) {
        console.warn('[walk-in] notifyAdmin failed', e);
        Toast.show({
          type: 'error',
          text1: 'Case Registered, Notification Failed',
          text2: `The case is saved, but ${luponAssigned} may not receive a notification.`,
        });
      }
    }

    // Notify the linked resident that a complaint was filed on their behalf.
    if (linkedAccount) {
      try {
        await notifyResident(
          linkedAccount.name,
          `Walk-In ${isSummon ? 'Summon' : 'Complaint'} Filed on Your Behalf`,
          `The barangay desk registered "${caseTitle}" under your account. Reference: ${newReport.id}.`,
          newReport.id,
        );
      } catch (e) {
        console.warn('[walk-in] notifyResident failed', e);
      }
    }

    if (isSummon) {
      const registeredReport = submissionResult.existingReport ?? newReport;
      const summonedAccountIds = [...new Set(respondents
        .map((person) => person.accountId)
        .filter((accountId): accountId is string => !!accountId))];
      const notificationFailures: string[] = [];

      for (const accountId of summonedAccountIds) {
        const person = approvedResidentAccounts.find((account) => account.id === accountId);
        if (!person) continue;

        try {
          await notifyResident(
            person.id,
            'You Have Been Summoned',
            `The barangay has registered a summon involving you for "${caseTitle}". Reference: ${registeredReport.id}. Tap to review the case details and hearing information.`,
            registeredReport.id,
          );
        } catch (e) {
          console.warn(`[walk-in] summon notification failed for ${person.id}`, e);
          notificationFailures.push(person.name);
        }
      }

      if (notificationFailures.length) {
        Toast.show({
          type: 'error',
          text1: 'Summon Registered, Notification Failed',
          text2: `The case is saved, but ${notificationFailures.join(', ')} may not receive a notification.`,
        });
      }
    }

    setLoading(false);
    setSuccessModal(newReport);

    clearResident();
    setSummonedPersons([{ name: '', address: '' }]); setSummonReason('');
    setCaseTitle(''); setCaseDescription(''); setCaseLocation(PUROKS[0]);
    setCaseCategory(isSummon ? 'Theft' : 'Other Concerns');
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-canvas dark:bg-canvas-dark">
        {/* Header */}
        <View
          className="bg-white dark:bg-surface-dark px-4 pb-3 border-b border-border dark:border-border-dark gap-2"
          style={[stickyHeader, { paddingTop: insets.top + 12 }]}
        >
          <Text className="text-xl font-black text-ink dark:text-ink-dark">Walk-In Desk Filing</Text>
          <Text className="text-xs text-muted dark:text-muted-dark">Register a complaint from a resident appearing in person</Text>

          {/* Type Toggle */}
          <View className="flex-row gap-2.5">
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-[10px] border-[1.5px] ${
                !isSummon ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'
              }`}
              onPress={() => {
                setFilingType('Normal');
                if (SUMMON_CATEGORIES.includes(caseCategory)) setCaseCategory('Other Concerns');
              }}
            >
              <Ionicons name="document-text-outline" size={16} color={!isSummon ? Colors.white : Colors.gray} />
              <Text className={`text-xs font-bold ${!isSummon ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>General Complaint</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-[10px] border-[1.5px] ${
                isSummon ? 'bg-purple border-purple' : 'bg-gray-light dark:bg-surface-dark-2'
              }`}
              style={!isSummon ? { borderColor: Colors.purple } : undefined}
              onPress={() => {
                setFilingType('Summon');
                if (!SUMMON_CATEGORIES.includes(caseCategory)) setCaseCategory('Theft');
              }}
            >
              <Ionicons name="hammer-outline" size={16} color={isSummon ? Colors.white : Colors.purple} />
              <Text className="text-xs font-bold" style={{ color: isSummon ? Colors.white : Colors.purple }}>Barangay Summon</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section title="Complainant Details">
            {/* Link to a registered resident account (optional) */}
            <Text className="text-xs font-semibold text-ink dark:text-ink-dark mb-1.5">Resident Account</Text>
            {linkedAccount ? (
              <View className="flex-row items-center gap-2 bg-blue-light border border-blue rounded-lg px-3 py-[11px] mb-3">
                <Ionicons name="person-circle" size={18} color={Colors.primary} />
                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-primary">{linkedAccount.name}</Text>
                  <Text className="text-[11px] text-muted">Linked — report goes to their account</Text>
                </View>
                <TouchableOpacity onPress={clearResident} className="p-1">
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                className="flex-row items-center gap-2 bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 py-[11px] mb-3"
                onPress={() => setResidentPickerVisible(true)}
              >
                <Ionicons name="search-outline" size={16} color={Colors.primary} />
                <Text className="flex-1 text-[13px] text-muted dark:text-muted-dark">Link a registered resident (optional)</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}

            <Field label="Full Name *" value={complainantName} onChange={setComplainantName} placeholder="e.g. Juan Dela Cruz" />
            <Field label="Contact Number" value={complainantContact} onChange={setComplainantContact} placeholder="09XX-XXX-XXXX" keyboardType="phone-pad" />
            <Field label="Address" value={complainantAddress} onChange={setComplainantAddress} placeholder="Purok / Street" />
            {linkedAccount && (
              <Text className="text-[11px] text-muted dark:text-muted-dark -mt-1">
                Details auto-filled from the linked account. Editing won’t unlink it.
              </Text>
            )}
          </Section>

          {isSummon && (
            <Section title="Respondent (Person to be Summoned)">
              {summonedPersons.map((person, index) => (
                <View key={index} className="mb-3 rounded-lg border border-border dark:border-border-dark p-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-bold text-ink dark:text-ink-dark mb-2">Person {index + 1}</Text>
                    {summonedPersons.length > 1 && (
                      <TouchableOpacity
                        accessibilityLabel={`Remove person ${index + 1}`}
                        className="flex-row items-center gap-1 p-1 mb-2"
                        onPress={() => setSummonedPersons((people) => people.filter((_, personIndex) => personIndex !== index))}
                      >
                        <Ionicons name="trash-outline" size={15} color={Colors.red} />
                        <Text className="text-xs font-semibold text-red">Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    className="mb-2 flex-row items-center gap-2 rounded-lg border border-border bg-gray-light px-3 py-2.5 dark:border-border-dark dark:bg-surface-dark-2"
                    onPress={() => {
                      setSummonedPersonPickerIndex(index);
                      setSummonedPersonSearch(person.name);
                    }}
                  >
                    <Ionicons name="search-outline" size={16} color={Colors.primary} />
                    <Text className="flex-1 text-[13px] text-muted dark:text-muted-dark">
                      Search resident accounts or enter a name manually
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
                  </TouchableOpacity>
                  {person.accountId ? (
                    <Text className="mb-2 text-[11px] font-semibold text-primary">
                      Linked account — this resident will be notified and can view the case.
                    </Text>
                  ) : null}
                  <Field
                    label="Full Name *"
                    value={person.name}
                    onChange={(value) => updateSummonedPerson(index, 'name', value)}
                    placeholder="Full name of respondent"
                  />
                  <Field
                    label="Address"
                    value={person.address || ''}
                    onChange={(value) => updateSummonedPerson(index, 'address', value)}
                    placeholder="Purok / Street"
                  />
                </View>
              ))}
              <TouchableOpacity
                className="mb-3 flex-row items-center justify-center gap-1.5 rounded-lg border border-purple py-2.5"
                onPress={() => setSummonedPersons((people) => [...people, { name: '', address: '' }])}
              >
                <Ionicons name="person-add-outline" size={16} color={Colors.purple} />
                <Text className="text-[13px] font-bold text-purple">Add Another Person</Text>
              </TouchableOpacity>
              <Field label="Summon Reason" value={summonReason} onChange={setSummonReason} placeholder="Reason for summons…" multiline />
            </Section>
          )}

          <Section title="Case Details">
            <Field label="Case Title *" value={caseTitle} onChange={setCaseTitle} placeholder="Brief title of the complaint" />

            <Text className="text-xs font-semibold text-ink dark:text-ink-dark mb-1.5">Incident Type</Text>
            {isSummon ? (
              <View className="flex-row flex-wrap gap-2.5 mb-3.5">
                {categoryOptions.map((category) => {
                  const active = caseCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      className={`w-[48%] items-center justify-center rounded-[10px] border-[1.5px] px-2 py-3 ${active ? 'border-purple bg-purple-light' : 'border-border bg-gray-light dark:border-border-dark dark:bg-surface-dark-2'}`}
                      onPress={() => setCaseCategory(category)}
                    >
                      <Text className={`text-xs font-semibold text-center ${active ? 'text-purple' : 'text-gray dark:text-ink-dark'}`}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                {categoryOptions.map((category) => {
                  const active = caseCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      className={`px-3 py-[7px] rounded-2xl border ${active ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'}`}
                      onPress={() => setCaseCategory(category)}
                    >
                      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text className="text-xs font-semibold text-ink dark:text-ink-dark mb-1.5">Incident Location</Text>
            {PUROKS.map((purok) => {
              const active = caseLocation === purok;
              return (
                <TouchableOpacity
                  key={purok}
                  className={`flex-row items-center gap-2.5 rounded-[10px] border bg-white px-3.5 py-3 mb-2 dark:bg-surface-dark ${
                    active ? 'bg-blue-light border-primary' : 'border-border dark:border-border-dark'
                  }`}
                  onPress={() => setCaseLocation(purok)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={active ? Colors.primary : Colors.textMuted}
                  />
                  <Text
                    className="text-sm text-ink dark:text-ink-dark"
                    style={active ? { color: Colors.primary, fontWeight: '700' } : undefined}
                  >
                    {purok}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <Field label="Narrative / Description *" value={caseDescription} onChange={setCaseDescription} placeholder="Detailed description of the incident…" multiline />
          </Section>

          <Section title="Administrative Details">
            <Field label="Desk Officer" value={deskOfficer} onChange={setDeskOfficer} placeholder="Name of receiving officer" />

            <Text className="text-xs font-semibold text-ink dark:text-ink-dark mb-1.5">Assigned Lupon / Unit</Text>
            <TouchableOpacity
              className="flex-row items-center gap-2 bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 py-[11px] mb-3"
              onPress={() => setAssigneePickerVisible(true)}
            >
              <Ionicons name="person-circle-outline" size={16} color={Colors.primary} />
              <Text className="flex-1 text-[13px] text-ink dark:text-ink-dark font-semibold">{luponAssigned}</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </Section>

          <PrimaryButton
            label={loading ? 'Registering…' : 'Register Walk-In Case'}
            onPress={handleSubmit}
            loading={loading}
            variant={isSummon ? 'purple' : 'primary'}
          />
        </ScrollView>

        {/* Resident Account Picker Modal */}
        <Modal visible={residentPickerVisible} transparent animationType="slide" onRequestClose={() => setResidentPickerVisible(false)}>
          <View className="flex-1 justify-center items-center p-5" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View className="bg-white dark:bg-surface-dark rounded-[20px] p-5 w-full" style={{ maxHeight: '80%' }}>
              <Text className="text-lg font-extrabold text-ink dark:text-ink-dark mb-1">Link Resident Account</Text>
              <Text className="text-xs text-muted dark:text-muted-dark mb-3">Only approved residents appear here.</Text>

              <View className="flex-row items-center gap-2 bg-gray-light dark:bg-surface-dark-2 rounded-[10px] border border-border dark:border-border-dark px-3 h-[42px] mb-3">
                <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
                <TextInput
                  className="flex-1 text-sm text-ink dark:text-ink-dark"
                  placeholder="Search name or contact…"
                  placeholderTextColor={Colors.textMuted}
                  value={residentSearch}
                  onChangeText={setResidentSearch}
                />
                {residentSearch ? (
                  <TouchableOpacity onPress={() => setResidentSearch('')}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                {filteredAccounts.length === 0 ? (
                  <View className="items-center py-8 gap-1">
                    <Ionicons name="people-outline" size={28} color={Colors.textMuted} />
                    <Text className="text-sm text-muted dark:text-muted-dark">No matching approved residents.</Text>
                  </View>
                ) : (
                  filteredAccounts.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      className="flex-row items-center gap-2.5 py-3 px-1 border-b border-border dark:border-border-dark"
                      onPress={() => selectResident(a)}
                    >
                      <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-ink dark:text-ink-dark">{a.name}</Text>
                        <Text className="text-[11px] text-muted dark:text-muted-dark">{a.cpNumber || 'No contact'} · {a.address || 'No address'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <TouchableOpacity className="mt-3 items-center py-2.5 bg-gray-light dark:bg-surface-dark-2 rounded-lg" onPress={() => { setResidentPickerVisible(false); setResidentSearch(''); }}>
                <Text className="text-sm font-bold text-gray dark:text-ink-dark">Cancel — file without an account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Summoned Resident Picker Modal */}
        <Modal
          visible={summonedPersonPickerIndex !== null}
          transparent
          animationType="slide"
          onRequestClose={() => { setSummonedPersonPickerIndex(null); setSummonedPersonSearch(''); }}
        >
          <View className="flex-1 justify-center items-center p-5" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View className="bg-white dark:bg-surface-dark rounded-[20px] p-5 w-full" style={{ maxHeight: '80%' }}>
              <Text className="text-lg font-extrabold text-ink dark:text-ink-dark mb-1">Find Summoned Person</Text>
              <Text className="text-xs text-muted dark:text-muted-dark mb-3">Link an approved account to notify the resident and let them view the case. Or enter a name for someone without an account.</Text>
              <View className="flex-row items-center gap-2 bg-gray-light dark:bg-surface-dark-2 rounded-[10px] border border-border dark:border-border-dark px-3 h-[42px] mb-3">
                <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
                <TextInput
                  className="flex-1 text-sm text-ink dark:text-ink-dark"
                  placeholder="Search resident or type a name…"
                  placeholderTextColor={Colors.textMuted}
                  value={summonedPersonSearch}
                  onChangeText={setSummonedPersonSearch}
                />
                {summonedPersonSearch ? (
                  <TouchableOpacity onPress={() => setSummonedPersonSearch('')}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                {filteredSummonedAccounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    className="flex-row items-center gap-2.5 py-3 px-1 border-b border-border dark:border-border-dark"
                    onPress={() => selectSummonedResident(account)}
                  >
                    <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-ink dark:text-ink-dark">{account.name}</Text>
                      <Text className="text-[11px] text-muted dark:text-muted-dark">{account.address || 'No address listed'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
                {filteredSummonedAccounts.length === 0 ? (
                  <View className="items-center py-5 gap-1">
                    <Ionicons name="people-outline" size={26} color={Colors.textMuted} />
                    <Text className="text-sm text-muted dark:text-muted-dark">No matching approved resident account.</Text>
                  </View>
                ) : null}
              </ScrollView>
              {summonedPersonSearch.trim() ? (
                <TouchableOpacity
                  className="mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-primary py-2.5"
                  onPress={useManualSummonedName}
                >
                  <Ionicons name="create-outline" size={17} color={Colors.white} />
                  <Text className="text-sm font-bold text-white">Use “{summonedPersonSearch.trim()}” as the name</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                className="mt-2.5 items-center py-2.5 bg-gray-light dark:bg-surface-dark-2 rounded-lg"
                onPress={() => { setSummonedPersonPickerIndex(null); setSummonedPersonSearch(''); }}
              >
                <Text className="text-sm font-bold text-gray dark:text-ink-dark">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Assignee Picker Modal */}
        <Modal visible={assigneePickerVisible} transparent animationType="slide" onRequestClose={() => setAssigneePickerVisible(false)}>
          <View className="flex-1 justify-center items-center p-5" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View className="bg-white dark:bg-surface-dark rounded-[20px] p-6 w-full" style={{ maxHeight: '80%' }}>
              <Text className="text-lg font-extrabold text-ink dark:text-ink-dark mb-1">Assign Lupon / Unit</Text>
              <Text className="text-xs text-muted dark:text-muted-dark mb-2">Choose an approved admin account.</Text>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  className={`flex-row items-center gap-2.5 py-3 px-1 border-b border-border dark:border-border-dark ${luponAssigned === 'Unassigned' ? 'bg-blue-light' : ''}`}
                  onPress={() => { setLuponAssigned('Unassigned'); setAssigneePickerVisible(false); }}
                >
                  <Ionicons name="person-circle-outline" size={18} color={luponAssigned === 'Unassigned' ? Colors.primary : Colors.textMuted} />
                  <Text className="flex-1 text-sm text-ink dark:text-ink-dark" style={luponAssigned === 'Unassigned' ? { color: Colors.primary, fontWeight: '700' } : undefined}>Unassigned</Text>
                  {luponAssigned === 'Unassigned' && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                </TouchableOpacity>
                {approvedAdminAccounts.map((account) => {
                  const active = luponAssigned === account.name;
                  return (
                    <TouchableOpacity
                      key={account.id}
                      className={`flex-row items-center gap-2.5 py-3 px-1 border-b border-border dark:border-border-dark ${active ? 'bg-blue-light' : ''}`}
                      onPress={() => { setLuponAssigned(account.name); setAssigneePickerVisible(false); }}
                    >
                      <Ionicons name="person-circle-outline" size={18} color={active ? Colors.primary : Colors.textMuted} />
                      <View className="flex-1">
                        <Text className="text-sm text-ink dark:text-ink-dark" style={active ? { color: Colors.primary, fontWeight: '700' } : undefined}>{account.name}</Text>
                        {account.barangayPosition ? (
                          <Text className="text-xs text-muted dark:text-muted-dark">{account.barangayPosition}</Text>
                        ) : null}
                      </View>
                      {active && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
                {approvedAdminAccounts.length === 0 ? (
                  <Text className="py-4 text-center text-sm text-muted dark:text-muted-dark">
                    No approved admin accounts are available to assign.
                  </Text>
                ) : null}
              </ScrollView>
              <TouchableOpacity className="mt-2.5 items-center py-2.5 bg-gray-light dark:bg-surface-dark-2 rounded-lg" onPress={() => setAssigneePickerVisible(false)}>
                <Text className="text-sm font-bold text-gray dark:text-ink-dark">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Success Modal */}
        <Modal visible={!!successModal} transparent animationType="fade" onRequestClose={() => setSuccessModal(null)}>
          <View className="flex-1 justify-center items-center p-5" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View className="bg-white dark:bg-surface-dark rounded-[20px] p-6 w-full items-center gap-1.5">
              <Text className="text-lg font-extrabold text-ink dark:text-ink-dark">Walk-In Case Registered</Text>
              <Text className="text-sm text-muted dark:text-muted-dark">Case Reference: <Text className="font-black text-primary">{successModal?.id}</Text></Text>
              <Text className="text-xs text-muted dark:text-muted-dark">{successModal?.date}</Text>
              <View className="w-full bg-gray-light dark:bg-surface-dark-2 rounded-[10px] p-3.5 mt-2 gap-2">
                <SlipRow label="Complainant" value={successModal?.reportedBy || ''} />
                {successModal?.summonedPersons?.length ? (
                  <SlipRow label="Respondent(s)" value={successModal.summonedPersons.map((person) => person.name).join(', ')} />
                ) : successModal?.summonedPersonName ? (
                  <SlipRow label="Respondent" value={successModal.summonedPersonName} />
                ) : null}
                <SlipRow label="Case" value={successModal?.title || ''} />
                <SlipRow label="Category" value={successModal?.category || ''} />
                <SlipRow label="Filed by" value={deskOfficer} />
              </View>
              <PrimaryButton label="Close Intake Slip" onPress={() => setSuccessModal(null)} style={{ marginTop: 8 }} />
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-3.5">
      <Text className="text-[13px] font-extrabold text-primary uppercase tracking-wide mb-2">{title}</Text>
      <View className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-3.5">{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
}) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-ink dark:text-ink-dark mb-1.5">{label}</Text>
      <TextInput
        className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 text-[13px] text-ink dark:text-ink-dark"
        style={multiline ? { height: 90, textAlignVertical: 'top', paddingTop: 10 } : { paddingVertical: 10 }}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

function SlipRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-2.5">
      <Text className="text-xs font-bold text-muted dark:text-muted-dark w-[90px]">{label}</Text>
      <Text className="flex-1 text-[13px] text-ink dark:text-ink-dark font-semibold text-right">{value}</Text>
    </View>
  );
}
