import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'purple' | 'outline';
  style?: ViewStyle;
  fullWidth?: boolean;
}

const variantStyles: Record<string, { bg: string; text: string; border: string }> = {
  primary: { bg: Colors.primary, text: Colors.white, border: Colors.primary },
  secondary: { bg: Colors.blueLight, text: Colors.blue, border: Colors.blue },
  danger: { bg: Colors.redLight, text: Colors.red, border: Colors.red },
  purple: { bg: Colors.purple, text: Colors.white, border: Colors.purple },
  outline: { bg: 'transparent', text: Colors.primary, border: Colors.border },
};

export default function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
  fullWidth = true,
}: Props) {
  const vs = variantStyles[variant];
  return (
    <TouchableOpacity
      className={`h-12 rounded-[10px] border items-center justify-center px-5 ${
        fullWidth ? 'self-stretch' : ''
      } ${disabled || loading ? 'opacity-55' : ''}`}
      style={[{ backgroundColor: vs.bg, borderColor: vs.border }, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={vs.text} size="small" />
      ) : (
        <Text className="text-[15px] font-bold" style={{ color: vs.text }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
