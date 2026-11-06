import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComplaintReport } from '../types';
import { useTheme } from '../context/ThemeContext';
import StatusBadge from './StatusBadge';

interface Props {
  report: ComplaintReport;
  onPress?: () => void;
}

const categoryIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Noise Complaint': 'musical-notes-outline',
  'Waste Management': 'trash-outline',
  'Security Incident': 'shield-outline',
  'Public Infrastructure': 'construct-outline',
  'Other Concerns': 'alert-circle-outline',
};

export default function ReportCard({ report, onPress }: Props) {
  const { theme } = useTheme();
  const icon = categoryIcon[report.category] || 'document-outline';
  return (
    <TouchableOpacity
      className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-3.5 mb-2.5"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      }}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-[10px] bg-blue-light dark:bg-surface-dark-2 items-center justify-center">
          <Ionicons name={icon} size={20} color={theme.primary} />
        </View>
        <View className="flex-1">
          <View className="flex-row justify-between items-center mb-0.5">
            <Text className="text-[11px] font-bold text-muted dark:text-muted-dark">{report.id}</Text>
            <StatusBadge status={report.status} small />
          </View>
          <Text className="text-sm font-bold text-ink dark:text-ink-dark" numberOfLines={1}>
            {report.title}
          </Text>
          <Text className="text-xs text-muted dark:text-muted-dark mt-0.5" numberOfLines={1}>
            {report.category} · {report.date}
          </Text>
          {report.priority === 'Summon' && (
            <View className="mt-1.5 self-start bg-purple-light dark:bg-surface-dark-2 rounded-md px-[7px] py-0.5">
              <Text className="text-[10px] font-bold text-purple">Summon Filing</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );
}
