import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

export default function EmergencyCallPanel({ centered = false }: { centered?: boolean }) {
  const [holdSeconds, setHoldSeconds] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    },
    [],
  );

  const startEmergencyHold = () => {
    if (holdTimer.current) return;

    setHoldSeconds(2);
    countdownTimer.current = setInterval(() => {
      setHoldSeconds((seconds) => (seconds !== null && seconds > 1 ? seconds - 1 : seconds));
    }, 1000);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      countdownTimer.current = null;
      setHoldSeconds(0);
      Linking.openURL('tel:911').catch(() =>
        alert('Unable to open the phone dialer. Please call 911 directly.'),
      );
    }, 2000);
  };

  const cancelEmergencyHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    holdTimer.current = null;
    countdownTimer.current = null;
    setHoldSeconds(null);
  };

  return (
    <View className={centered ? 'w-full items-center justify-center px-4' : 'mb-5'}>
      <View className="items-center rounded-2xl px-4 py-5 dark:border-border-dark dark:bg-surface-dark">
        <Text className="mb-3 text-center text-3xl font-extrabold text-ink dark:text-ink-dark">
          Emergency help needed?
        </Text>
        <Text className="mt-1 text-center text-xs text-muted dark:text-muted-dark">
          Hold the button for 2 seconds to call
        </Text>

        <View
          className="mt-4 h-64 w-64 items-center justify-center rounded-full bg-[#ff9393]"
          style={{ borderWidth: 18, borderColor: '#fcd3d3' }}
        >
          <Pressable
            className="h-44 w-44 items-center justify-center rounded-full bg-red"
            style={({ pressed }) => [
              {
                elevation: 6,
                shadowColor: Colors.red,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            onPressIn={startEmergencyHold}
            onPressOut={cancelEmergencyHold}
            accessibilityRole="button"
            accessibilityLabel="Hold for two seconds to call 911"
            accessibilityHint="Releasing early cancels the call"
            accessibilityState={{ busy: holdSeconds !== null }}
          >
            <Ionicons name="call" size={38} color={Colors.white} />
            <Text className="mt-2 text-center text-sm font-black tracking-wide text-white">
              {holdSeconds === null
                ? 'HOLD TO CALL'
                : holdSeconds > 0
                  ? `CALLING IN ${holdSeconds}...`
                  : 'CALLING 911...'}
            </Text>
          </Pressable>
        </View>

        <Text className="mt-3 text-center text-xs font-semibold text-muted dark:text-muted-dark">
          911 Emergency Hotline
        </Text>
      </View>
    </View>
  );
}
