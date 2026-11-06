import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  // Icon color — pass a fixed color when placed on a colored header (e.g. white).
  color?: string;
  size?: number;
}

// A compact sun/moon button that flips the app between light and dark mode.
export default function ThemeToggle({ color, size = 22 }: Props) {
  const { isDark, toggleTheme, theme } = useTheme();
  const iconColor = color ?? theme.primary;

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      className="p-1.5"
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={size} color={iconColor} />
    </TouchableOpacity>
  );
}
