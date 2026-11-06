import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export default function EmptyState({ icon = 'document-outline', title, subtitle }: Props) {
  const { theme } = useTheme();
  return (
    <View className="items-center py-12 px-6">
      <View className="w-[72px] h-[72px] rounded-full bg-gray-light dark:bg-surface-dark-2 items-center justify-center mb-4">
        <Ionicons name={icon} size={40} color={theme.textMuted} />
      </View>
      <Text className="text-base font-bold text-ink dark:text-ink-dark text-center">{title}</Text>
      {subtitle ? (
        <Text className="text-[13px] text-muted dark:text-muted-dark text-center mt-1.5 leading-[18px]">{subtitle}</Text>
      ) : null}
    </View>
  );
}
