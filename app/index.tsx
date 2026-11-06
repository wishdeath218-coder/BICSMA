import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Image } from 'react-native';
import { useApp } from '../src/context/AppContext';
import { Colors } from '../src/constants/colors';

export default function Index() {
  const { isReady, isLoggedIn, role } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn) {
      router.replace('/auth/login');
    } else if (role === 'admin') {
      router.replace('/(admin)/dashboard');
    } else {
      router.replace('/(resident)/civic-hub');
    }
  }, [isReady, isLoggedIn, role]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
      <Image
        source={require('../assets/bangbanglogo.png')}
        resizeMode="contain"
        style={{ width: 168, height: 168 }}
        accessibilityLabel="Barangay Bangbang logo"
      />
    </View>
  );
}
