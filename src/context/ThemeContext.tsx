import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { lightColors, darkColors, ThemePalette } from '../constants/colors';

const STORAGE_KEY = 'bb_theme';

interface ThemeContextValue {
  isDark: boolean;
  theme: ThemePalette;   // active palette for inline styles (Colors.* replacement)
  toggleTheme: () => void;
  setDark: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // NativeWind's color scheme drives all `dark:` className variants app-wide.
  const { setColorScheme } = useColorScheme();
  const [isDark, setIsDark] = useState(false);

  // Load the saved preference once on mount.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const dark = saved === 'dark';
        setIsDark(dark);
        setColorScheme(dark ? 'dark' : 'light');
      } catch {
        setColorScheme('light');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (dark: boolean) => {
    setIsDark(dark);
    setColorScheme(dark ? 'dark' : 'light');
    AsyncStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light').catch(() => {});
  };

  const toggleTheme = () => apply(!isDark);
  const setDark = (dark: boolean) => apply(dark);

  const value: ThemeContextValue = {
    isDark,
    theme: isDark ? darkColors : lightColors,
    toggleTheme,
    setDark,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
