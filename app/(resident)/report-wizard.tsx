import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useApp } from '../../src/context/AppContext';
import { ComplaintReport, ResidentAccount, SummonedPerson } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import PrimaryButton from '../../src/components/PrimaryButton';
import StatusBadge from '../../src/components/StatusBadge';
import { DailyReportLimitError, DailyReportUsage } from '../../src/lib/reportLimit';
import { api } from '../../src/lib/api';

// ─── Types & Constants ────────────────────────────────────────────────────────
type Priority = 'Normal' | 'Summon';
type IncidentType =
  | 'noise'
  | 'waste'
  | 'security'
  | 'infrastructure'
  | 'other'
  | 'theft'
  | 'propertyDamage'
  | 'physicalDamage'
  | 'others';

const GENERAL_INCIDENT_TYPES: { key: IncidentType; label: string; icon: any }[] = [
  { key: 'noise', label: 'Noise Complaint', icon: 'musical-notes-outline' },
  { key: 'waste', label: 'Waste Management', icon: 'trash-outline' },
  { key: 'security', label: 'Security Incident', icon: 'shield-outline' },
  { key: 'infrastructure', label: 'Public Infrastructure', icon: 'construct-outline' },
  { key: 'other', label: 'Other Concerns', icon: 'alert-circle-outline' },
];

const SUMMON_INCIDENT_TYPES: { key: IncidentType; label: string; icon: any }[] = [
  { key: 'theft', label: 'Theft', icon: 'eye-off-outline' },
  { key: 'propertyDamage', label: 'Property Damage', icon: 'home-outline' },
  { key: 'physicalDamage', label: 'Physical Damage', icon: 'bandage-outline' },
  { key: 'others', label: 'Others', icon: 'alert-circle-outline' },
];

const PUROKS = [
  'Purok 1, Barangay Bangbang',
  'Purok 2, Barangay Bangbang',
  'Purok 3, Barangay Bangbang',
  'Purok 4, Barangay Bangbang',
  'Purok 5, Barangay Bangbang',
];

import { stickyHeader, nowStamp, TAB_BAR_HEIGHT } from '../../src/utils/ui';

function mapCategory(type: IncidentType): ComplaintReport['category'] {
  const map: Record<IncidentType, ComplaintReport['category']> = {
    noise: 'Noise Complaint',
    waste: 'Waste Management',
    security: 'Security Incident',
    infrastructure: 'Public Infrastructure',
    other: 'Other Concerns',
    theft: 'Theft',
    propertyDamage: 'Property Damage',
    physicalDamage: 'Physical Damage',
    others: 'Others',
  };
  return map[type];
}

// ─── Duplicate Result Screen ──────────────────────────────────────────────────
interface DuplicateResult {
  existingReport: ComplaintReport;
  totalReporters: number;
}

function DuplicateScreen({ result, onReset }: { result: DuplicateResult; onReset: () => void }) {
  const insets = useSafeAreaInsets();
  const report = result.existingReport;
  const totalReporters = result.totalReporters;

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, alignItems: 'center', paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-[100px] h-[100px] rounded-full bg-blue-light items-center justify-center mb-4">
          <Ionicons name="people-circle-outline" size={64} color={Colors.blue} />
        </View>

        <Text className="text-2xl font-black text-ink dark:text-ink-dark text-center mb-2">Already Reported</Text>
        <Text className="text-sm text-muted dark:text-muted-dark text-center leading-5 mb-5">
          Our system found an existing complaint that matches your report.
        </Text>

        {/* Count badge */}
        <View className="flex-row items-center gap-2.5 bg-blue-light rounded-2xl py-3 px-5 mb-5 border self-stretch justify-center" style={{ borderColor: '#bfdbfe' }}>
          <Text className="text-[32px] font-black text-blue">{totalReporters}</Text>
          <Text className="text-sm text-blue font-semibold flex-shrink">
            {totalReporters === 1 ? 'resident has' : 'residents have'} reported this issue
          </Text>
        </View>

        {/* Existing report card */}
        <View
          className="bg-white dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-4 self-stretch mb-4"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}
        >
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-[11px] font-bold text-muted dark:text-muted-dark">{report.id}</Text>
            <StatusBadge status={report.status} small />
          </View>
          <Text className="text-base font-extrabold text-ink dark:text-ink-dark mb-2.5">{report.title}</Text>
          <View className="flex-row items-center gap-1.5 mb-1">
            <Ionicons name="folder-outline" size={13} color={Colors.textMuted} />
            <Text className="text-xs text-muted dark:text-muted-dark">{report.category}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 mb-1">
            <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
            <Text className="text-xs text-muted dark:text-muted-dark">{report.location}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 mb-1">
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text className="text-xs text-muted dark:text-muted-dark">{report.date}</Text>
          </View>
          <View className="h-px bg-border dark:bg-border-dark my-3" />
          <Text className="text-[11px] font-bold text-muted dark:text-muted-dark uppercase tracking-wide mb-1.5">Description</Text>
          <Text className="text-[13px] text-ink dark:text-ink-dark leading-5" numberOfLines={4}>{report.description}</Text>
        </View>

        {/* What happens next */}
        <View className="bg-green-light rounded-xl border p-4 self-stretch mb-4" style={{ borderColor: '#bbf7d0' }}>
          <Text className="text-sm font-extrabold text-green mb-1.5">Your voice has been counted</Text>
          <Text className="text-[13px] text-green leading-[19px]">
            Your report has been merged with the existing complaint. The barangay admin has been notified of increased urgency — more reports means faster response.
          </Text>
        </View>

        <PrimaryButton label="View in My Reports" onPress={onReset} variant="primary" style={{ marginTop: 4 }} />
        <TouchableOpacity className="mt-3 py-2.5 items-center" onPress={onReset}>
          <Text className="text-sm text-muted dark:text-muted-dark font-semibold">File a Different Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export default function ReportWizardScreen() {
  const { submitReport, getDailyReportUsage, loggedInUser, accounts, usingDatabase } = useApp();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [priority, setPriority] = useState<Priority>('Normal');

  const [incidentType, setIncidentType] = useState<IncidentType | ''>('');
  const [description, setDescription] = useState('');
  const [summonedPersons, setSummonedPersons] = useState<SummonedPerson[]>([{ name: '', address: '' }]);
  const [summonReason, setSummonReason] = useState('');
  const [summonedPersonPickerIndex, setSummonedPersonPickerIndex] = useState<number | null>(null);
  const [summonedPersonSearch, setSummonedPersonSearch] = useState('');
  const [summonedAccountResults, setSummonedAccountResults] = useState<Array<Pick<ResidentAccount, 'id' | 'name' | 'address'>>>([]);
  const [searchingSummonedAccounts, setSearchingSummonedAccounts] = useState(false);
  const [summonedAccountSearchError, setSummonedAccountSearchError] = useState('');

  const [location, setLocation] = useState(PUROKS[0]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState('image/jpeg');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateResult | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyReportUsage | null>(null);

  useEffect(() => {
    let active = true;
    getDailyReportUsage().then((usage: DailyReportUsage) => {
      if (active) setDailyUsage(usage);
    }).catch((error: unknown) => {
      console.warn('[Daily report counter] failed to load:', error);
    });
    return () => { active = false; };
  }, [getDailyReportUsage]);

  useEffect(() => {
    const query = summonedPersonSearch.trim();
    if (summonedPersonPickerIndex === null || query.length < 2) {
      setSummonedAccountResults([]);
      setSearchingSummonedAccounts(false);
      setSummonedAccountSearchError('');
      return;
    }

    let active = true;
    setSummonedAccountResults([]);
    setSearchingSummonedAccounts(true);
    setSummonedAccountSearchError('');
    if (!usingDatabase) {
      const normalizedQuery = query.toLowerCase();
      setSummonedAccountResults(accounts
        .filter((account) =>
          account.role === 'resident'
          && account.status === 'Approved'
          && account.name.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, 20)
        .map(({ id, name, address }) => ({ id, name, address })));
      setSearchingSummonedAccounts(false);
      return () => { active = false; };
    }

    const timer = setTimeout(() => {
      api.searchApprovedResidents(query).then((accounts) => {
        if (active) setSummonedAccountResults(accounts);
      }).catch((error: unknown) => {
        if (active) {
          setSummonedAccountResults([]);
          setSummonedAccountSearchError('Unable to search resident accounts. Please try again.');
          console.warn('[Summoned resident search] failed:', error);
        }
      }).finally(() => {
        if (active) setSearchingSummonedAccounts(false);
      });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [accounts, summonedPersonPickerIndex, summonedPersonSearch, usingDatabase]);

  const TOTAL_STEPS = 3;

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!incidentType) e.incidentType = 'Please select an incident type.';
    if (description.trim().length < 20) e.description = 'Description must be at least 20 characters.';
    if (priority === 'Summon' && summonedPersons.some((person) => !person.name.trim())) {
      e.summonedPersons = 'Enter a name for each person or remove the empty entry.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const updateSummonedPerson = (index: number, field: 'name' | 'address', value: string) => {
    setSummonedPersons((people) =>
      people.map((person, personIndex) =>
        personIndex === index
          ? { ...person, [field]: value, ...(field === 'name' ? { accountId: undefined } : {}) }
          : person,
      ),
    );
    if (field === 'name' && value.trim()) {
      setErrors((current) => ({ ...current, summonedPersons: '' }));
    }
  };

  const selectSummonedResident = (account: Pick<ResidentAccount, 'id' | 'name' | 'address'>) => {
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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera roll access is needed to upload evidence photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (!asset.base64) {
        Toast.show({ type: 'error', text1: 'Photo Unavailable', text2: 'Please choose another photo.' });
        return;
      }
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        Toast.show({ type: 'error', text1: 'Unsupported Image', text2: 'Choose a JPEG, PNG, or WebP image.' });
        return;
      }
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64);
      setPhotoMimeType(mimeType);
    }
  };

  const handleSubmit = async () => {
    if (!incidentType) return;
    setSubmitting(true);

    const rand = Math.floor(1000 + Math.random() * 9000);
    const stamp = nowStamp();

    const titleMap: Record<IncidentType, string> = {
      noise: 'Noise Complaint',
      waste: 'Waste Management Issue',
      security: 'Security Incident',
      infrastructure: 'Public Infrastructure Damage',
      other: 'Other Concerns',
      theft: 'Theft',
      propertyDamage: 'Property Damage',
      physicalDamage: 'Physical Damage',
      others: 'Others',
    };

    const category = mapCategory(incidentType);
    const respondents = priority === 'Summon'
      ? summonedPersons.map((person) => ({
          name: person.name.trim(),
          address: person.address?.trim() || '',
          accountId: person.accountId,
        }))
      : [];
    const newReport: ComplaintReport = {
      id: `#REP-${rand}`,
      reportType: priority === 'Summon' ? 'Summon' : 'Complaint',
      title: priority === 'Summon' ? `Summon Request - ${category}` : titleMap[incidentType],
      category,
      description,
      location,
      date: stamp,
      status: 'Pending',
      priority,
      isAnonymous: priority !== 'Summon' && isAnonymous,
      reportedBy: priority !== 'Summon' && isAnonymous ? 'Anonymous' : (loggedInUser || 'Resident'),
      assignee: 'Unassigned',
      evidencePhoto: photoUri || undefined,
      summonedPersonName: respondents[0]?.name || undefined,
      summonedPersonAddress: respondents[0]?.address || undefined,
      summonedPersons: respondents.length ? respondents : undefined,
      summonReason: priority === 'Summon' ? (summonReason || description) : undefined,
      timeline: [
        {
          status: 'Pending',
          date: stamp,
          note:
            priority === 'Summon'
              ? 'Summon request registered for official Barangay review'
              : 'Report successfully submitted by resident',
        },
      ],
    };

    // Submit through the AI duplicate check (server-side embedding + pgvector).
    // If a similar active complaint exists, the resident is shown the merge screen.
    try {
      const result = await submitReport(
        newReport,
        photoBase64 ? { base64: photoBase64, mimeType: photoMimeType } : undefined,
      );
      setSubmitting(false);
      if (result.dailyUsage) setDailyUsage(result.dailyUsage);

      if (result.isDuplicate && result.existingReport) {
        setDuplicateResult({
          existingReport: result.existingReport,
          totalReporters: result.totalReporters ?? 1,
        });
        return; // DuplicateScreen takes over; don't reset yet
      }

      Toast.show({ type: 'success', text1: 'Report Submitted!', text2: `Reference: ${newReport.id}` });
      resetForm();
    } catch (e) {
      setSubmitting(false);
      if (e instanceof DailyReportLimitError) {
        setDailyUsage({ used: 3, remaining: 0, limit: 3, resetAt: e.resetAt });
        Toast.show({ type: 'error', text1: 'Daily limit reached', text2: e.message });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Submission Failed',
          text2: e instanceof Error ? e.message : 'Please try again.',
        });
      }
    }
  };

  const resetForm = () => {
    setStep(1);
    setPriority('Normal');
    setIncidentType('');
    setDescription('');
    setIsAnonymous(false);
    setSummonedPersons([{ name: '', address: '' }]);
    setSummonReason('');
    setLocation(PUROKS[0]);
    setPhotoUri(null);
    setPhotoBase64(null);
    setPhotoMimeType('image/jpeg');
    setErrors({});
    setDuplicateResult(null);
  };

  if (duplicateResult) {
    return <DuplicateScreen result={duplicateResult} onReset={resetForm} />;
  }

  const progressPct = (step / TOTAL_STEPS) * 100;
  const isSummon = priority === 'Summon';
  const accentColor = isSummon ? Colors.purple : Colors.primary;

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <View
        className="bg-white dark:bg-surface-dark px-5 pb-3.5 border-b border-border dark:border-border-dark"
        style={[stickyHeader, { paddingTop: insets.top + 12 }]}
      >
        <View className="flex-row justify-between items-center mb-2.5">
          <Text className="text-lg font-extrabold text-ink dark:text-ink-dark">{isSummon ? 'File Summon' : 'File a Report'}</Text>
          <Text className="text-xs text-muted dark:text-muted-dark font-semibold">Step {step} of {TOTAL_STEPS}</Text>
        </View>
        <View className="h-1.5 bg-gray-light dark:bg-surface-dark-2 rounded-[3px] overflow-hidden">
          <View className="h-full rounded-[3px]" style={{ width: `${progressPct}%`, backgroundColor: accentColor }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {dailyUsage?.remaining === 0 && (
          <View className="mb-4 rounded-lg border border-red bg-red-light px-3.5 py-3">
            <Text className="text-[13px] font-bold text-red">Daily report limit reached</Text>
            <Text className="mt-1 text-xs text-red">
              You have used {dailyUsage.used}/{dailyUsage.limit} reports today. Please try again tomorrow.
            </Text>
          </View>
        )}

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <View>
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-xl font-black text-ink dark:text-ink-dark">Report Details</Text>
              {priority !== 'Summon' && (
                <TouchableOpacity
                  className={`flex-row items-center gap-1.5 rounded-xl border px-3 py-2 ${
                    isAnonymous
                      ? 'border-primary bg-primary'
                      : 'border-border bg-white dark:border-border-dark dark:bg-surface-dark'
                  }`}
                  onPress={() => setIsAnonymous((prev) => !prev)}
                  accessibilityRole="switch"
                  accessibilityLabel="Anonymous reporting"
                  accessibilityState={{ checked: isAnonymous }}
                >
                  <Ionicons
                    name={isAnonymous ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={isAnonymous ? Colors.white : Colors.gray}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      isAnonymous ? 'text-white' : 'text-ink dark:text-ink-dark'
                    }`}
                  >
                    Anonymous
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {priority !== 'Summon' && isAnonymous && (
              <Text className="mb-2 text-xs leading-5 text-muted dark:text-muted-dark">
                Your name is hidden from admins, and you can still track this report in My Reports.
              </Text>
            )}

            {/* Filing type toggle */}
            <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark mb-2 mt-4">Filing Type</Text>
            <View className="flex-row gap-2.5 mb-1.5">
              <TouchableOpacity
                className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-[10px] border-[1.5px] ${
                  priority === 'Normal' ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'
                }`}
                onPress={() => { setPriority('Normal'); setIncidentType(''); }}
              >
                <Ionicons name="document-text-outline" size={16} color={priority === 'Normal' ? Colors.white : Colors.gray} />
                <Text className={`text-[13px] font-bold ${priority === 'Normal' ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>General Report</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-[10px] border-[1.5px] ${
                  isSummon ? 'bg-purple border-purple' : 'bg-gray-light dark:bg-surface-dark-2'
                }`}
                style={!isSummon ? { borderColor: Colors.purple } : undefined}
                onPress={() => { setPriority('Summon'); setIsAnonymous(false); setIncidentType(''); }}
              >
                <Ionicons name="hammer-outline" size={16} color={isSummon ? Colors.white : Colors.purple} />
                <Text className="text-[13px] font-bold" style={{ color: isSummon ? Colors.white : Colors.purple }}>Summon a Resident</Text>
              </TouchableOpacity>
            </View>

            {/* Summon-specific fields */}
            {isSummon && (
              <View className="bg-purple-light rounded-xl border p-3.5 mb-1 mt-2.5" style={{ borderColor: '#ddd6fe' }}>
                <Text className="text-[13px] font-extrabold text-purple mb-2.5">Summon Details</Text>

                {summonedPersons.map((person, index) => (
                  <View key={index} className="mb-3 rounded-lg border border-border bg-white p-3 dark:border-border-dark dark:bg-surface-dark">
                    <View className="mb-2 flex-row items-center justify-between">
                      <Text className="text-[13px] font-bold text-ink dark:text-ink-dark">Person {index + 1}</Text>
                      {summonedPersons.length > 1 && (
                        <TouchableOpacity
                          accessibilityLabel={`Remove person ${index + 1}`}
                          className="flex-row items-center gap-1 p-1"
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
                    <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark mb-2">
                      Full Name <Text className="text-red">*</Text>
                    </Text>
                    <TextInput
                      className={`bg-gray-light dark:bg-surface-dark-2 border rounded-[10px] px-3.5 py-3 text-sm text-ink dark:text-ink-dark ${errors.summonedPersons && !person.name.trim() ? 'border-red' : 'border-border dark:border-border-dark'}`}
                      placeholder="Full name of the person to summon"
                      value={person.name}
                      onChangeText={(value) => updateSummonedPerson(index, 'name', value)}
                      placeholderTextColor={Colors.textMuted}
                    />
                    <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark mb-2 mt-2.5">Address (optional)</Text>
                    <TextInput
                      className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-[10px] px-3.5 py-3 text-sm text-ink dark:text-ink-dark"
                      placeholder="House no., street, purok"
                      value={person.address}
                      onChangeText={(value) => updateSummonedPerson(index, 'address', value)}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                ))}
                {errors.summonedPersons ? <Text className="text-xs text-red mb-2">{errors.summonedPersons}</Text> : null}
                <TouchableOpacity
                  className="mb-3 flex-row items-center justify-center gap-1.5 rounded-lg border border-purple py-2.5"
                  onPress={() => setSummonedPersons((people) => [...people, { name: '', address: '' }])}
                >
                  <Ionicons name="person-add-outline" size={16} color={Colors.purple} />
                  <Text className="text-[13px] font-bold text-purple">Add Another Person</Text>
                </TouchableOpacity>

                <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark mb-2 mt-2.5">Reason for Summon (optional)</Text>
                <TextInput
                  className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-[10px] px-3.5 text-sm text-ink dark:text-ink-dark"
                  style={{ height: 72, textAlignVertical: 'top', paddingTop: 10 }}
                  placeholder="Specific summon reason..."
                  value={summonReason}
                  onChangeText={setSummonReason}
                  multiline
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            )}

            {/* Incident type grid */}
            <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark mb-2 mt-4">
              Incident Type <Text className="text-red">*</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              {(isSummon ? SUMMON_INCIDENT_TYPES : GENERAL_INCIDENT_TYPES).map((t) => {
                const active = incidentType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    className="w-[47%] flex-row items-center gap-2 p-3 rounded-[10px] border-[1.5px] bg-white dark:bg-surface-dark"
                    style={active ? { backgroundColor: accentColor, borderColor: accentColor } : { borderColor: Colors.border }}
                    onPress={() => { setIncidentType(t.key); setErrors((e) => ({ ...e, incidentType: '' })); }}
                  >
                    <Ionicons name={t.icon} size={20} color={active ? Colors.white : Colors.gray} />
                    <Text className={`text-xs font-semibold flex-1 ${active ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.incidentType ? <Text className="text-xs text-red mt-1">{errors.incidentType}</Text> : null}

            {/* Description */}
            <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark mb-2 mt-4">
              Detailed Description <Text className="text-red">*</Text>
            </Text>
            <TextInput
              className={`bg-gray-light dark:bg-surface-dark-2 border rounded-[10px] px-3.5 text-sm text-ink dark:text-ink-dark ${errors.description ? 'border-red' : 'border-border dark:border-border-dark'}`}
              style={[{ height: 110, textAlignVertical: 'top', paddingTop: 12 }, errors.description ? { backgroundColor: '#fff5f5' } : null]}
              placeholder="Describe the incident in detail (min. 20 characters)..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              placeholderTextColor={Colors.textMuted}
            />
            <Text className={`text-[11px] text-right mt-1 ${description.length < 20 ? 'text-red' : 'text-muted dark:text-muted-dark'}`}>
              {description.length} / 20 min chars
            </Text>
            {errors.description ? <Text className="text-xs text-red mt-1">{errors.description}</Text> : null}
          </View>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <View>
            <Text className="text-xl font-black text-ink dark:text-ink-dark mb-4">Location & Evidence</Text>

            <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark mb-2">Incident Location</Text>
            {PUROKS.map((z) => {
              const active = location === z;
              return (
                <TouchableOpacity
                  key={z}
                  className={`flex-row items-center gap-2.5 py-3 px-3.5 rounded-[10px] border bg-white dark:bg-surface-dark mb-2 ${
                    active ? 'bg-blue-light border-primary' : 'border-border dark:border-border-dark'
                  }`}
                  onPress={() => setLocation(z)}
                >
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? accentColor : Colors.textMuted} />
                  <Text className="text-sm text-ink dark:text-ink-dark" style={active ? { color: accentColor, fontWeight: '700' } : undefined}>{z}</Text>
                </TouchableOpacity>
              );
            })}

            <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark mb-2 mt-5">Evidence Photo (optional)</Text>
            <TouchableOpacity
              className="rounded-xl border-2 border-border dark:border-border-dark overflow-hidden"
              style={{ borderStyle: 'dashed' }}
              onPress={pickImage}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} className="w-full h-[200px]" resizeMode="cover" />
              ) : (
                <View className="h-40 items-center justify-center gap-2 bg-gray-light dark:bg-surface-dark-2">
                  <Ionicons name="camera-outline" size={32} color={Colors.textMuted} />
                  <Text className="text-[13px] text-muted dark:text-muted-dark">Tap to upload photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {photoUri && (
              <TouchableOpacity
                onPress={() => {
                  setPhotoUri(null);
                  setPhotoBase64(null);
                  setPhotoMimeType('image/jpeg');
                }}
                className="self-center mt-2"
              >
                <Text className="text-[13px] text-red font-semibold">Remove Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <View>
            <Text className="text-xl font-black text-ink dark:text-ink-dark mb-1.5">Review & Submit</Text>
            <Text className="text-[13px] text-muted dark:text-muted-dark mb-5 leading-[18px]">
              Please review your report before submitting. Tap Back to make changes.
            </Text>

            {/* Summary card */}
            <View className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark overflow-hidden mb-4">
              <ReviewRow label="Filing Type" value={isSummon ? 'Summon Request' : 'General Report'} accent={accentColor} />
              <ReviewRow
                label="Incident Type"
                value={(isSummon ? SUMMON_INCIDENT_TYPES : GENERAL_INCIDENT_TYPES).find((t) => t.key === incidentType)?.label || '—'}
              />
              <ReviewRow label="Location" value={location} />
              {isSummon && (
                <ReviewRow
                  label={summonedPersons.length > 1 ? 'Summoned People' : 'Summoned Person'}
                  value={summonedPersons.map((person) => person.name.trim()).filter(Boolean).join(', ') || '—'}
                  accent={Colors.purple}
                />
              )}
              {isSummon && summonedPersons.some((person) => person.address?.trim()) ? (
                <ReviewRow
                  label="Addresses"
                  value={summonedPersons.map((person) => person.address?.trim() || '').filter(Boolean).join('; ')}
                />
              ) : null}
              <ReviewRow label="Description" value={description} multiline />
              {photoUri && (
                <View className="flex-row justify-between items-start p-3.5 border-b border-border dark:border-border-dark gap-3">
                  <Text className="text-xs font-bold text-muted dark:text-muted-dark w-[110px] flex-shrink-0">Evidence Photo</Text>
                  <Image source={{ uri: photoUri }} className="w-20 h-[60px] rounded-lg" resizeMode="cover" />
                </View>
              )}
            </View>

            {!isSummon && (
              <View className="flex-row gap-2 items-start bg-purple-light rounded-[10px] border p-3 mb-2.5" style={{ borderColor: '#ddd6fe' }}>
                <Ionicons name="hardware-chip-outline" size={16} color={Colors.purple} />
                <Text className="flex-1 text-xs text-purple leading-[17px]">
                  When submitted, our AI will check if this issue has already been reported. If it has, your voice will be counted and no duplicate will be created.
                </Text>
              </View>
            )}

            {/* Submission note */}
            <View className="flex-row gap-2 items-start bg-blue-light rounded-[10px] p-3.5">
              <Ionicons name="information-circle-outline" size={16} color={Colors.blue} />
              <Text className="flex-1 text-[13px] text-blue leading-[18px]">
                Once submitted, your report will be reviewed by the Barangay Office. Track its progress in My Reports.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom navigation bar — lifted above the fixed tab bar on web */}
      <View
        className="flex-row items-center justify-between px-5 pt-3 bg-white dark:bg-surface-dark border-t border-border dark:border-border-dark"
        style={{ paddingBottom: insets.bottom + 8, marginBottom: Platform.OS === 'web' ? TAB_BAR_HEIGHT : 0 }}
      >
        {step > 1 ? (
          <TouchableOpacity className="flex-row items-center gap-1 p-1" onPress={handleBack}>
            <Ionicons name="arrow-back" size={18} color={accentColor} />
            <Text className="text-sm font-semibold" style={{ color: accentColor }}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-1" />
        )}

        {step < TOTAL_STEPS ? (
          <PrimaryButton
            label="Continue"
            onPress={handleNext}
            variant={isSummon ? 'purple' : 'primary'}
            fullWidth={false}
            style={{ paddingHorizontal: 32 }}
          />
        ) : (
          <PrimaryButton
            label={submitting ? 'Submitting…' : dailyUsage?.remaining === 0 ? 'Daily Limit Reached' : 'Submit Report'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={dailyUsage?.remaining === 0}
            variant={isSummon ? 'purple' : 'primary'}
            fullWidth={false}
            style={{ paddingHorizontal: 24 }}
          />
        )}
      </View>

      <Modal
        visible={summonedPersonPickerIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setSummonedPersonPickerIndex(null); setSummonedPersonSearch(''); }}
      >
        <View className="flex-1 justify-center items-center p-5" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-white dark:bg-surface-dark rounded-[20px] p-5 w-full" style={{ maxHeight: '80%' }}>
            <Text className="text-lg font-extrabold text-ink dark:text-ink-dark mb-1">Find Summoned Person</Text>
            <Text className="text-xs text-muted dark:text-muted-dark mb-3">
              Link an approved account to notify the resident and let them view the case. Or enter a name for someone without an account.
            </Text>
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
              {summonedAccountResults.map((account) => (
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
              {searchingSummonedAccounts ? (
                <Text className="py-4 text-center text-sm text-muted dark:text-muted-dark">Searching approved residents…</Text>
              ) : summonedAccountSearchError ? (
                <Text className="py-4 text-center text-sm text-red">{summonedAccountSearchError}</Text>
              ) : summonedPersonSearch.trim().length >= 2 && summonedAccountResults.length === 0 ? (
                <View className="items-center py-5 gap-1">
                  <Ionicons name="people-outline" size={26} color={Colors.textMuted} />
                  <Text className="text-sm text-muted dark:text-muted-dark">No matching approved resident account.</Text>
                </View>
              ) : summonedPersonSearch.trim().length < 2 ? (
                <Text className="py-4 text-center text-sm text-muted dark:text-muted-dark">Enter at least 2 characters to search.</Text>
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
    </View>
  );
}

// ─── Review Row ───────────────────────────────────────────────────────────────
function ReviewRow({
  label,
  value,
  multiline,
  accent,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  accent?: string;
}) {
  return (
    <View className="flex-row justify-between items-start p-3.5 border-b border-border dark:border-border-dark gap-3">
      <Text className="text-xs font-bold text-muted dark:text-muted-dark w-[110px] flex-shrink-0">{label}</Text>
      <Text
        className={`text-[13px] font-medium flex-1 ${multiline ? 'text-left' : 'text-right'}`}
        style={accent ? { color: accent } : { color: Colors.text }}
        numberOfLines={multiline ? undefined : 2}
      >
        {value}
      </Text>
    </View>
  );
}
