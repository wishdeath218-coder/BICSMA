import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { confirmAction } from '../../src/utils/confirm';
import { stickyHeader } from '../../src/utils/ui';

// ─── Data ─────────────────────────────────────────────────────────────────────
const EMERGENCY_CONTACTS = [
  {
    id: 'pnp',
    label: 'Philippine National Police',
    short: 'PNP',
    icon: 'shield-outline',
    color: '#1d4ed8',
    numbers: [
      { carrier: 'Globe', number: '0917 100 4469', dialNumber: '09171004469' },
      { carrier: 'Smart', number: '0998 598 8107', dialNumber: '09985988107' },
    ],
    description: 'For crimes, disturbances, and law enforcement assistance.',
    logo: require('../../assets/pnplogo.png'),
  },
  {
    id: 'bfp',
    label: 'Bureau of Fire Protection',
    short: 'BFP',
    icon: 'flame-outline',
    color: '#dc2626',
    numbers: [
      { carrier: 'Smart', number: '0963 380 4439', dialNumber: '09633804439' },
      { carrier: 'Globe', number: '0927 120 7435', dialNumber: '09271207435' },
    ],
    description: 'For fire emergencies and rescue operations.',
    logo: require('../../assets/bfplogo.png'),
  },
  {
    id: 'mdrrmo',
    label: 'Municipal Disaster Risk Reduction & Management Office',
    short: 'MDRRMO',
    icon: 'medkit-outline',
    color: '#0369a1',
    numbers: [
      { carrier: 'DITO', number: '0994 302 3802', dialNumber: '09943023802' },
      { carrier: 'Globe', number: '0977 328 4721', dialNumber: '09773284721' },
    ],
    description: 'For natural disasters, flooding, and calamity response.',
    logo: require('../../assets/cdrrmologo.png'),
  },
  {
    id: 'hospital',
    label: 'Hospital',
    short: 'Hospital',
    icon: 'medical-outline',
    color: '#15803d',
    numbers: [{ carrier: 'Call', number: '0966 335 7116', dialNumber: '09663357116' }],
    description: 'For urgent medical care and hospital assistance.',
    logo: require('../../assets/emergencylogo.png'),
  },
];

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'emergency', label: 'Emergency', ids: ['pnp', 'bfp', 'mdrrmo', 'hospital'] },
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  const visibleContacts =
    activeCategory === 'all'
      ? EMERGENCY_CONTACTS
      : EMERGENCY_CONTACTS.filter((c) =>
          CATEGORIES.find((cat) => cat.key === activeCategory)?.ids?.includes(c.id),
        );

  const handleCall = (dialNumber: string, label: string) => {
    confirmAction(
      `Call ${label}?`,
      'This will open your phone dialer.',
      () => Linking.openURL(`tel:${dialNumber}`),
      'Call Now',
    );
  };

  const handleSOS = () => {
    confirmAction(
      'Call 911 — National Emergency',
      'This will immediately call the national emergency hotline.',
      () => Linking.openURL('tel:911'),
      'CALL 911',
      true,
    );
  };

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <View
        className="bg-white dark:bg-surface-dark px-4 pb-3 border-b border-border dark:border-border-dark gap-2"
        style={[stickyHeader, { paddingTop: insets.top + 12 }]}
      >
        <Text className="text-[22px] font-black text-ink dark:text-ink-dark">Emergency Hotlines</Text>
        <Text className="text-[13px] text-muted dark:text-muted-dark">Barangay Bangbang — Contact Directory</Text>

        {/* Category filter */}
        <View className="flex-row gap-2">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                className={`px-3.5 py-1.5 rounded-[20px] border ${
                  active ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'
                }`}
                onPress={() => setActiveCategory(cat.key)}
              >
                <Text className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* SOS Banner */}
        <TouchableOpacity
          className="flex-row items-center gap-3.5 rounded-2xl p-[18px] mb-1"
          style={{
            backgroundColor: '#dc2626',
            shadowColor: '#dc2626',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 6,
          }}
          onPress={handleSOS}
          activeOpacity={0.85}
        >
          <View className="w-[52px] h-[52px] rounded-[26px] items-center justify-center bg-white/20">
            <Ionicons name="alert-circle" size={32} color={Colors.white} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold uppercase tracking-wide text-white/80">
              National Emergency
            </Text>
            <Text className="text-[28px] font-black text-white leading-8">Call 911</Text>
            <Text className="text-[11px] text-white/75 mt-0.5">Police, fire, medical, and disaster response</Text>
          </View>
          <View className="items-center gap-1 rounded-[10px] p-2.5 bg-white/20">
            <Ionicons name="call" size={18} color={Colors.white} />
            <Text className="text-[10px] font-bold text-white">Tap to Call</Text>
          </View>
        </TouchableOpacity>

        {/* Notice */}
        <View className="flex-row items-start gap-2 bg-amber-light rounded-[10px] border border-[#fde68a] p-3 mb-1">
          <Ionicons name="information-circle-outline" size={16} color={Colors.amber} />
          <Text className="flex-1 text-xs text-amber font-medium leading-[17px]">
            Call 911 for emergencies, or choose an agency or local contact below to call its listed number.
          </Text>
        </View>

        {/* Contact Cards */}
        <View className="gap-2.5">
          {visibleContacts.map((contact) => {
            const isExpanded = expandedContactId === contact.id;
            return (
              <View
                key={contact.id}
                className={`gap-3 bg-white dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-3.5 ${
                  isExpanded ? '' : 'py-2.5'
                }`}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <TouchableOpacity
                  className="flex-row items-center gap-3"
                  onPress={() => setExpandedContactId(isExpanded ? null : contact.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`${contact.label}, ${isExpanded ? 'hide' : 'show'} phone numbers`}
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <View
                    className="w-[52px] h-[52px] rounded-xl items-center justify-center"
                    style={{ backgroundColor: 'transparent' }}
                  >
                    {contact.logo ? (
                      <Image source={contact.logo} style={{ width: 52, height: 52 }} resizeMode="contain" />
                    ) : (
                      <Ionicons name={contact.icon as any} size={26} color={contact.color} />
                    )}
                  </View>

                  <View className="flex-1 gap-0.5">
                    <Text className="text-[13px] font-extrabold text-ink dark:text-ink-dark">{contact.label}</Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark leading-[15px] mt-0.5">
                      {contact.description}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View className="flex-row gap-2">
                    {contact.numbers.map((number) => (
                      <TouchableOpacity
                        key={`${contact.id}-${number.carrier}`}
                        className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[10px] py-2.5 px-2"
                        style={{ backgroundColor: contact.color }}
                        onPress={() => handleCall(number.dialNumber, `${contact.short} ${number.carrier}`)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="call" size={15} color={Colors.white} />
                        <View>
                          <Text className="text-[10px] font-bold text-white">{number.carrier}</Text>
                          <Text className="text-[11px] font-bold text-white">{number.number}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}
