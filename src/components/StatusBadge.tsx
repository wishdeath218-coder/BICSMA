import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type Status = 'Pending' | 'Investigating' | 'Resolved' | 'Unresolved' | 'Rejected';
type Priority = 'Normal' | 'Summon';

interface Props {
  status?: Status;
  priority?: Priority;
  small?: boolean;
}

export default function StatusBadge({ status, priority, small = false }: Props) {
  const { theme } = useTheme();
  const padCls = small ? 'px-[7px] py-0.5' : 'px-2.5 py-1';
  const textCls = small ? 'text-[10px]' : 'text-xs';

  const statusMap: Record<Status, { bg: string; text: string; border: string; label: string }> = {
    Pending: { bg: theme.pending.bg, text: theme.pending.text, border: theme.pending.border, label: 'Pending' },
    Investigating: { bg: theme.investigating.bg, text: theme.investigating.text, border: theme.investigating.border, label: 'Investigating' },
    Resolved: { bg: theme.resolved.bg, text: theme.resolved.text, border: theme.resolved.border, label: 'Resolved' },
    Unresolved: { bg: theme.pending.bg, text: theme.pending.text, border: theme.pending.border, label: 'Unresolved' },
    Rejected: { bg: theme.rejected.bg, text: theme.rejected.text, border: theme.rejected.border, label: 'Rejected' },
  };

  if (priority === 'Summon') {
    return (
      <View
        className={`rounded-[20px] border self-start ${padCls}`}
        style={{ backgroundColor: theme.purpleLight, borderColor: theme.purple }}
      >
        <Text className={`font-bold ${textCls}`} style={{ color: theme.purple }}>
          Summon
        </Text>
      </View>
    );
  }

  if (!status) return null;
  const s = statusMap[status];
  return (
    <View
      className={`rounded-[20px] border self-start ${padCls}`}
      style={{ backgroundColor: s.bg, borderColor: s.border }}
    >
      <Text className={`font-bold ${textCls}`} style={{ color: s.text }}>
        {s.label}
      </Text>
    </View>
  );
}
