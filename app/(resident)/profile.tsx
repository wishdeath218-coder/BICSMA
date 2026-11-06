import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import InputField from '../../src/components/InputField';
import PrimaryButton from '../../src/components/PrimaryButton';
import { Colors } from '../../src/constants/colors';
import { useApp } from '../../src/context/AppContext';

export default function ResidentProfileScreen() {
  const { loggedInUser, loggedInUsername, updateResidentProfile } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState(loggedInUsername || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 || password.trim().length > 0;
  }, [password, username]);

  const validate = () => {
    let isValid = true;
    setUsernameError('');
    setPasswordError('');

    if (!username.trim()) {
      setUsernameError('Username is required.');
      isValid = false;
    }

    if (password && password.trim().length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      isValid = false;
    }

    if (password && password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      isValid = false;
    }

    return isValid;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      const updates: { username?: string; password?: string } = {};
      if (username.trim() && username.trim() !== loggedInUsername) {
        updates.username = username.trim();
      }
      if (password.trim()) {
        updates.password = password.trim();
      }

      if (Object.keys(updates).length === 0) {
        Toast.show({ type: 'info', text1: 'No changes', text2: 'Update your username or password to save.' });
        setLoading(false);
        return;
      }

      await updateResidentProfile(updates);
      Toast.show({ type: 'success', text1: 'Profile Updated', text2: 'Your account details were saved.' });
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save profile changes.';
      Toast.show({ type: 'error', text1: 'Update Failed', text2: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.text }}>Profile</Text>
        </View>

        <View style={{ backgroundColor: Colors.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: Colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <Ionicons name="person-circle" size={34} color={Colors.primary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text }}>{loggedInUser || 'Resident'}</Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted }}>Resident account</Text>
          </View>

          <InputField
            label="Username"
            required
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            error={usernameError}
          />

          <InputField
            label="New Password"
            placeholder="Leave blank to keep current password"
            isPassword
            value={password}
            onChangeText={setPassword}
            error={passwordError}
          />

          <InputField
            label="Confirm Password"
            placeholder="Re-enter new password"
            isPassword
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={passwordError}
          />

          <PrimaryButton label="Save Changes" onPress={handleSave} loading={loading} disabled={!canSubmit} style={{ marginTop: 8 }} />
        </View>
      </ScrollView>
    </View>
  );
}
