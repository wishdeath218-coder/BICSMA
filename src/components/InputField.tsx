import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, TextInputProps, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
  required?: boolean;
}

export default function InputField({ label, error, containerStyle, isPassword, required, ...rest }: Props) {
  const [show, setShow] = useState(false);
  const { theme } = useTheme();

  return (
    <View className="mb-3.5" style={containerStyle}>
      {label ? (
        <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark mb-1.5">
          {label}
          {required ? <Text style={{ color: Colors.red }}> *</Text> : null}
        </Text>
      ) : null}
      <View
        className={`flex-row items-center rounded-[10px] border bg-gray-light dark:bg-surface-dark-2 px-3.5 h-12 ${
          error ? 'border-red' : 'border-border dark:border-border-dark'
        }`}
      >
        <TextInput
          className="flex-1 text-sm text-ink dark:text-ink-dark"
          placeholderTextColor={theme.textMuted}
          secureTextEntry={isPassword && !show}
          autoCorrect={false}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setShow((s) => !s)} className="pl-2">
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text className="text-xs text-red mt-1">{error}</Text> : null}
    </View>
  );
}
