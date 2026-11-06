import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useApp } from '../../src/context/AppContext';
import InputField from '../../src/components/InputField';
import PrimaryButton from '../../src/components/PrimaryButton';
import { Colors } from '../../src/constants/colors';

export default function LoginScreen() {
  const { tryLogin, login } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    let valid = true;
    setUsernameError('');
    setPasswordError('');
    if (!username.trim()) { setUsernameError('Username is required.'); valid = false; }
    if (!password) { setPasswordError('Password is required.'); valid = false; }
    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    const result = await tryLogin(username, password);
    setLoading(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Login Failed', text2: result.message });
      return;
    }

    const role = result.message as 'resident' | 'admin';
    const name = result.accountName || username.trim();
    await login(role, name, username.trim().toLowerCase(), result.accountId);

    if (role === 'admin') {
      router.replace('/(admin)/dashboard');
    } else {
      router.replace('/(resident)/civic-hub');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 20,
          justifyContent: 'center',
          gap: 16,
        }}
      >
          {/* Header Hero */}
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            className="rounded-2xl items-center overflow-hidden"
            style={{ paddingVertical: 32, paddingHorizontal: 28, alignItems: 'center' }}
          >
          {/* Background image fills the entire hero */}
          <Image
            source={require('../../assets/bangbangbglogo.png')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              opacity: 0.12,
            }}
            resizeMode="cover"
          />
          {/* Main logo */}
          <Image
            source={require('../../assets/bangbanglogo.png')}
            style={{ width: 100, height: 100, marginBottom: 10, alignSelf: 'center' }}
            resizeMode="contain"
          />
          <Text className="text-[22px] font-black text-white text-center">Barangay Bangbang</Text>
          <Text className="text-[13px] text-white/75 text-center mt-1.5">Civic Portal — Resident & Admin Login</Text>
        </LinearGradient>

        {/* Form Card */}
        <View
          className="bg-white dark:bg-surface-dark rounded-2xl p-[22px] border border-border dark:border-border-dark"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <Text className="text-xl font-extrabold text-ink dark:text-ink-dark mb-1">Sign In</Text>
          <Text className="text-[13px] text-muted dark:text-muted-dark mb-4">Enter your registered credentials to continue.</Text>

          <InputField
            label="Username"
            required
            placeholder="Enter your username"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            error={usernameError}
          />
          <InputField
            label="Password"
            required
            placeholder="Your password"
            isPassword
            value={password}
            onChangeText={setPassword}
            error={passwordError}
          />

          <PrimaryButton label="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 4 }} />

          <TouchableOpacity className="mt-4 items-center" onPress={() => router.push('/auth/register')}>
            <Text className="text-sm text-muted dark:text-muted-dark">
              Need an account? <Text className="text-blue font-bold">Request Access</Text>
            </Text>
          </TouchableOpacity>
        </View>

          {/* Footer */}
          <Text className="text-center text-[11px] text-muted dark:text-muted-dark leading-4 px-2">
            Barangay Bangbang Civil Portal · Powered by the Office of the Barangay Captain
          </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
