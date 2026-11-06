import React from 'react';
import { View, Text } from 'react-native';
import { TimelineItem } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props {
  timeline: TimelineItem[];
}

export default function TimelineView({ timeline }: Props) {
  const { theme } = useTheme();
  const dotColor: Record<string, string> = {
    Pending: theme.amber,
    Investigating: theme.purple,
    Resolved: theme.green,
    Unresolved: theme.amber,
    Rejected: theme.gray,
  };
  return (
    <View className="pt-1">
      {timeline.map((item, idx) => {
        const color = dotColor[item.status] || theme.gray;
        return (
          <View key={idx} className="flex-row">
            {/* Left: dot + connector */}
            <View className="w-6 items-center">
              <View
                className="w-3 h-3 rounded-full mt-[3px] z-[1]"
                style={{ backgroundColor: color }}
              />
              {idx < timeline.length - 1 && (
                <View
                  className="w-0.5 flex-1 self-center min-h-[24px] mt-0.5 -mb-0.5"
                  style={{ backgroundColor: theme.border }}
                />
              )}
            </View>
            {/* Right: content */}
            <View className="flex-1 pl-2.5 pb-5">
              <Text
                className="text-xs font-extrabold uppercase tracking-wide"
                style={{ color }}
              >
                {item.status}
              </Text>
              <Text className="text-[13px] text-ink dark:text-ink-dark mt-0.5 leading-[18px]">{item.note}</Text>
              <Text className="text-[11px] text-muted dark:text-muted-dark mt-[3px]">{item.date}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
