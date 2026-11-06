import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface Props {
  visible: boolean;
  name: string;
  username?: string;
  role: 'resident' | 'admin';
  onCancel: () => void;
  onConfirm: () => void;
}

export default function LogoutModal({ visible, name, username, role, onCancel, onConfirm }: Props) {
  const initial = (name || 'U').charAt(0).toUpperCase();
  const roleLabel = role === 'admin' ? 'Barangay Admin' : 'Resident';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        className="flex-1 justify-center items-center p-6"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={onCancel}
      >
        {/* Stop propagation so tapping the card doesn't dismiss */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}} className="w-full">
          <View className="bg-white dark:bg-surface-dark rounded-[20px] p-6 w-full items-center">
            {/* Avatar */}
            <View className="w-[72px] h-[72px] rounded-[36px] bg-blue-light dark:bg-surface-dark-2 items-center justify-center mb-3">
              <Text className="text-[30px] font-black text-primary">{initial}</Text>
            </View>

            {/* Name + role */}
            <Text className="text-lg font-black text-ink dark:text-ink-dark text-center">{name || 'User'}</Text>
            {username ? <Text className="text-[13px] text-muted dark:text-muted-dark text-center mt-0.5">@{username}</Text> : null}
            <View className="mt-2 bg-blue-light dark:bg-surface-dark-2 rounded-full px-3 py-1">
              <Text className="text-[11px] font-bold text-blue">{roleLabel}</Text>
            </View>

            {/* Divider */}
            <View className="h-px bg-border dark:bg-border-dark w-full my-5" />

            {/* Prompt */}
            <View className="flex-row items-center gap-2 mb-5">
              <Ionicons name="log-out-outline" size={18} color={Colors.red} />
              <Text className="text-sm text-ink dark:text-ink-dark font-semibold">Sign out of your account?</Text>
            </View>

            {/* Buttons */}
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center bg-gray-light dark:bg-surface-dark-2"
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text className="text-[15px] font-bold text-gray dark:text-ink-dark">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center flex-row gap-2"
                style={{ backgroundColor: Colors.red }}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={18} color={Colors.white} />
                <Text className="text-[15px] font-bold text-white">Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
