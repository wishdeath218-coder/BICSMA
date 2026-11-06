import '../global.css';
import { Slot } from 'expo-router';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import Toast, { BaseToast, type ToastConfig } from 'react-native-toast-message';
import { View } from 'react-native';
import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmergencyCallPanel from '../src/components/EmergencyCallPanel';

const toastConfig: ToastConfig = {
  success: ({ text1, text2, onPress }) => (
    <BaseToast text1={text1} text2={text2} onPress={onPress} style={{ borderLeftWidth: 0 }} />
  ),
  error: ({ text1, text2, onPress }) => (
    <BaseToast text1={text1} text2={text2} onPress={onPress} style={{ borderLeftWidth: 0 }} />
  ),
  info: ({ text1, text2, onPress }) => (
    <BaseToast text1={text1} text2={text2} onPress={onPress} style={{ borderLeftWidth: 0 }} />
  ),
};

function ThemedRoot() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [hasInternet, setHasInternet] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let receivedNetworkEvent = false;
    const updateStatus = (state: Network.NetworkState) => {
      const available = state.isInternetReachable ?? state.isConnected ?? false;
      setHasInternet(available);
    };
    const subscription = Network.addNetworkStateListener((state) => {
      receivedNetworkEvent = true;
      updateStatus(state);
    });

    Network.getNetworkStateAsync()
      .then((state) => {
        if (active && !receivedNetworkEvent) updateStatus(state);
      })
      .catch((error: unknown) => {
        console.warn('[Network] unable to determine internet connectivity:', error);
      });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    // Always fills the viewport — no grey frame, fully responsive at any width
    <View style={{ flex: 1, width: '100%', backgroundColor: theme.background }}>
      {hasInternet ? (
        <Slot />
      ) : (
        <View
          className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <EmergencyCallPanel centered />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppProvider>
        <ThemedRoot />
        <Toast config={toastConfig} />
      </AppProvider>
    </ThemeProvider>
  );
}
