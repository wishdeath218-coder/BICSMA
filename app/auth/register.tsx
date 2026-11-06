import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../../src/context/AppContext';
import InputField from '../../src/components/InputField';
import PrimaryButton from '../../src/components/PrimaryButton';
import { AccountRole, ResidentAccount } from '../../src/types';

interface FormState {
  name: string;
  username: string;
  barangayPosition: string;
  cpNumber: string;
  zone: string;
  street: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  username?: string;
  barangayPosition?: string;
  cpNumber?: string;
  zone?: string;
  street?: string;
  password?: string;
  confirmPassword?: string;
  verificationDocument?: string;
}

const PUROK_OPTIONS = [
  'Purok 1, Barangay Bangbang',
  'Purok 2, Barangay Bangbang',
  'Purok 3, Barangay Bangbang',
  'Purok 4, Barangay Bangbang',
  'Purok 5, Barangay Bangbang',
];

export default function RegisterScreen() {
  const { register } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<FormState>({
    name: '',
    username: '',
    barangayPosition: '',
    cpNumber: '',
    zone: PUROK_OPTIONS[0],
    street: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [accountRole, setAccountRole] = useState<AccountRole>('resident');
  const [verificationDocument, setVerificationDocument] = useState<{
    uri: string;
    base64: string;
    mimeType: string;
  } | null>(null);

  const set = (key: keyof FormState) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const pickVerificationDocument = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Toast.show({
          type: 'error',
          text1: 'Permission Required',
          text2: 'Allow photo library access to upload your verification document.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.75,
        base64: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Toast.show({ type: 'error', text1: 'Photo Unavailable', text2: 'Please choose another photo.' });
        return;
      }
      const padding = asset.base64.endsWith('==') ? 2 : asset.base64.endsWith('=') ? 1 : 0;
      const byteLength = Math.floor((asset.base64.length * 3) / 4) - padding;
      if (byteLength > 5 * 1024 * 1024) {
        Toast.show({ type: 'error', text1: 'Photo Too Large', text2: 'Choose an image smaller than 5 MB.' });
        return;
      }
      const mimeType = asset.mimeType || 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        Toast.show({
          type: 'error',
          text1: 'Unsupported Photo Format',
          text2: 'Choose a JPEG, PNG, or WebP photo.',
        });
        return;
      }
      setVerificationDocument({
        uri: asset.uri,
        base64: asset.base64,
        mimeType,
      });
      setErrors((current) => ({ ...current, verificationDocument: undefined }));
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Unable to Select Photo',
        text2: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Full name is required.';
    if (!form.username.trim()) e.username = 'Username is required.';
    else if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.username.trim())) {
      e.username = 'Use 3–30 letters, numbers, dots, underscores, or hyphens.';
    }
    if (accountRole === 'admin' && !form.barangayPosition.trim()) {
      e.barangayPosition = 'Barangay position is required for admin applicants.';
    }
    if (!form.cpNumber.trim()) e.cpNumber = 'Contact number is required.';
    else if (!/^09\d{2}-?\d{3}-?\d{4}$/.test(form.cpNumber.replace(/\s/g, '')))
      e.cpNumber = 'Use format: 09XX-XXX-XXXX';
    if (!form.zone.trim()) e.zone = 'Please select a purok.';
    if (!verificationDocument) e.verificationDocument = 'Upload a photo of a valid ID or Certificate of Indigency.';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);

    const newAccount: ResidentAccount = {
      id: `user-${Date.now()}`,
      name: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      role: accountRole,
      barangayPosition: accountRole === 'admin' ? form.barangayPosition.trim() : undefined,
      password: form.password,
      cpNumber: form.cpNumber.trim(),
      address: form.street.trim() ? `${form.street.trim()}, ${form.zone}` : form.zone,
      registeredDate: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'Pending',
      verificationDocumentUri: verificationDocument?.uri,
    };

    let result;
    try {
      result = await register(newAccount, verificationDocument
        ? { base64: verificationDocument.base64, mimeType: verificationDocument.mimeType }
        : undefined);
    } catch (error) {
      result = {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to submit the account request.',
      };
    } finally {
      setLoading(false);
    }

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: result.message });
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Registration Submitted!',
      text2: `Your ${accountRole} account request is pending barangay approval.`,
    });
    setTimeout(() => router.replace('/auth/login'), 1800);
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1 bg-canvas dark:bg-canvas-dark"
        contentContainerStyle={{
          paddingHorizontal: 20,
          gap: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity className="self-start" onPress={() => router.back()}>
          <Text className="text-sm text-blue font-semibold">Back to Login</Text>
        </TouchableOpacity>

        {/* Header */}
        <View className="items-center py-3 gap-2">
          <Text className="text-[22px] font-extrabold text-ink dark:text-ink-dark text-center">Request Access</Text>
          <Text className="text-[13px] text-muted dark:text-muted-dark text-center leading-[18px]">
            Fill in your details to register. Your account will require approval from the current barangay admin before you can sign in.
          </Text>
        </View>

        {/* Account type */}
        <View className="rounded-2xl border border-border bg-white p-5 dark:border-border-dark dark:bg-surface-dark">
          <Text className="mb-1 text-[15px] font-extrabold text-ink dark:text-ink-dark">
            What type of account do you need?
          </Text>
          <Text className="mb-3 text-xs text-muted dark:text-muted-dark">
            Choose Resident or Barangay Admin.
          </Text>
          <View className="flex-row gap-2">
            {(['resident', 'admin'] as const).map((role) => {
              const selected = accountRole === role;
              return (
                <TouchableOpacity
                  key={role}
                  className={`flex-1 rounded-xl border p-3 ${
                    selected
                      ? 'border-primary bg-blue-light dark:bg-surface-dark-2'
                      : 'border-border bg-gray-light dark:border-border-dark dark:bg-surface-dark-2'
                  }`}
                  onPress={() => setAccountRole(role)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Text className={`text-sm font-bold ${selected ? 'text-primary' : 'text-gray dark:text-ink-dark'}`}>
                    {role === 'admin' ? 'Barangay Admin' : 'Resident'}
                  </Text>
                  <Text className="mt-1 text-[11px] text-muted dark:text-muted-dark">
                    {role === 'admin' ? 'Requires current admin approval' : 'For barangay residents'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Form */}
        <View className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-border dark:border-border-dark">
          <Text className="text-[11px] font-extrabold text-primary uppercase tracking-wider mb-2.5 mt-1">
            Personal Information
          </Text>

          <InputField
            label="Full Name"
            required
            placeholder="e.g. Juan Dela Cruz"
            autoCapitalize="words"
            value={form.name}
            onChangeText={set('name')}
            error={errors.name}
          />
          <InputField
            label="Username"
            required
            placeholder="e.g. juandelacruz"
            autoCapitalize="none"
            value={form.username}
            onChangeText={set('username')}
            error={errors.username}
          />
          {accountRole === 'admin' ? (
            <InputField
              label="Barangay Position"
              required
              placeholder="e.g. Barangay Secretary"
              autoCapitalize="words"
              value={form.barangayPosition}
              onChangeText={set('barangayPosition')}
              error={errors.barangayPosition}
            />
          ) : null}
          <InputField
            label="Contact Number"
            required
            placeholder="09XX-XXX-XXXX"
            keyboardType="phone-pad"
            value={form.cpNumber}
            onChangeText={set('cpNumber')}
            error={errors.cpNumber}
          />

          <Text className="text-[11px] font-extrabold text-primary uppercase tracking-wider mb-2.5 mt-1">
            Address / Purok
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-1">
            {PUROK_OPTIONS.map((z) => {
              const active = form.zone === z;
              return (
                <TouchableOpacity
                  key={z}
                  className={`px-3.5 py-2 rounded-lg border ${
                    active ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'
                  }`}
                  onPress={() => set('zone')(z)}
                >
                  <Text className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>
                    {z.split(',')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.zone ? <Text className="text-xs text-red mt-0.5">{errors.zone}</Text> : null}

          <InputField
            label="House No. / Street (optional)"
            placeholder="e.g. 12 Rizal St., Purok 3"
            autoCapitalize="words"
            value={form.street}
            onChangeText={set('street')}
            error={errors.street}
          />

          <View className="mt-2">
            <Text className="mb-1 text-sm font-bold text-ink dark:text-ink-dark">
              Verification Document <Text className="text-red">*</Text>
            </Text>
            <Text className="mb-2.5 text-xs leading-[18px] text-muted dark:text-muted-dark">
              Upload a clear photo of a valid ID or a Barangay Certificate of Indigency (max 5 MB).
            </Text>
            <TouchableOpacity
              className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-primary bg-blue-light px-4 py-3"
              onPress={pickVerificationDocument}
              accessibilityRole="button"
            >
              <Text className="text-sm font-bold text-primary">
                {verificationDocument ? 'Change Photo' : 'Upload Photo'}
              </Text>
            </TouchableOpacity>
            {verificationDocument ? (
              <View className="mt-3 flex-row items-center gap-3 rounded-xl border border-border p-2.5 dark:border-border-dark">
                <Image source={{ uri: verificationDocument.uri }} className="h-16 w-16 rounded-lg" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink dark:text-ink-dark">Photo selected</Text>
                  <Text className="mt-0.5 text-xs text-muted dark:text-muted-dark">Ready to submit for verification</Text>
                </View>
                <TouchableOpacity onPress={() => setVerificationDocument(null)} accessibilityLabel="Remove photo">
                  <Text className="px-2 py-1 text-sm font-semibold text-red">Remove</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {errors.verificationDocument ? (
              <Text className="mt-1 text-xs text-red">{errors.verificationDocument}</Text>
            ) : null}
          </View>

          <View className="h-3.5" />
          <Text className="text-[11px] font-extrabold text-primary uppercase tracking-wider mb-2.5 mt-1">
            Create Password
          </Text>

          <InputField
            label="Password"
            required
            placeholder="Min. 6 characters"
            isPassword
            value={form.password}
            onChangeText={set('password')}
            error={errors.password}
          />
          <InputField
            label="Confirm Password"
            required
            placeholder="Re-enter your password"
            isPassword
            value={form.confirmPassword}
            onChangeText={set('confirmPassword')}
            error={errors.confirmPassword}
          />

          <PrimaryButton
            label="Submit Registration"
            onPress={handleRegister}
            loading={loading}
            style={{ marginTop: 8 }}
          />
        </View>

        {/* Notice */}
        <View className="bg-amber-light rounded-[10px] border border-[#fde68a] p-3.5">
          <Text className="text-xs text-amber leading-[18px] font-medium">
            Your {accountRole === 'admin' ? 'admin' : 'resident'} account request will be reviewed by the current barangay admin. You will be notified once approved.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
