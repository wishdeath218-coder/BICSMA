import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { useApp } from '../../src/context/AppContext';
import { useTheme } from '../../src/context/ThemeContext';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { TAB_BAR_HEIGHT } from '../../src/utils/ui';

// ─── Constants ────────────────────────────────────────────────────────────────
const IS_WEB = Platform.OS === 'web';

// ─── Tab icon with optional badge ────────────────────────────────────────────
function TabIcon({ name, focused, badge }: { name: any; focused: boolean; badge?: number }) {
  const { theme } = useTheme();
  return (
    <View>
      <Ionicons name={name} size={24} color={focused ? theme.primary : theme.textMuted} />
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function ResidentLayout() {
  const { unreadCount } = useApp();
  const { theme } = useTheme();

  const tabBarStyle: any = IS_WEB
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        backgroundColor: theme.surface,
        borderTopColor: theme.border,
        borderTopWidth: 1,
        height: TAB_BAR_HEIGHT,
        paddingBottom: 8,
        zIndex: 100,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      }
    : {
        backgroundColor: theme.surface,
        borderTopColor: theme.border,
        height: TAB_BAR_HEIGHT,
        paddingBottom: 8,
      };

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarStyle,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="civic-hub"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="community-feed"
          options={{
            title: 'Community',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'megaphone' : 'megaphone-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="report-wizard"
          options={{
            title: 'File Report',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'add-circle' : 'add-circle-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="my-reports"
          options={{
            title: 'My Reports',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'document-text' : 'document-text-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="emergency"
          options={{
            title: 'Emergency',
            tabBarActiveTintColor: '#dc2626',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'call' : 'call-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ focused }) => (
              <TabIcon
                name={focused ? 'notifications' : 'notifications-outline'}
                focused={focused}
                badge={unreadCount}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.red,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
