import React from 'react';
import { View, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export default function Card({ children, style, padding = 16 }: Props) {
  return (
    <View
      className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark"
      style={[
        {
          padding,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
