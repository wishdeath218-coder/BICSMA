import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
export default function AdminLayout() {
  const { accounts, unreadCount } = useApp();
  const { theme } = useTheme();
  const pendingCount = accounts.filter((a) => a.status === 'Pending').length;

  // Keep the web tab bar in layout flow so it does not cover screen content.
  const tabBarStyle: any = IS_WEB
    ? {
        width: '100%',
        backgroundColor: theme.surface,
        borderTopColor: theme.border,
        borderTopWidth: 1,
        height: TAB_BAR_HEIGHT,
        paddingBottom: 8,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      }
    : {
        backgroundColor: theme.surface,
        borderTopColor: theme.border,
        height: TAB_BAR_HEIGHT,
        paddingBottom: 8,
      };

  // Hidden tabs must keep the same bar hidden without wiping fixed positioning
  const hiddenTabBarStyle: any = { display: 'none' };

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
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="summons"
          options={{
            title: 'Summons',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'hammer' : 'hammer-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="walk-in"
          options={{
            title: 'Walk-In',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'person-add' : 'person-add-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="announcements"
          options={{
            title: 'Bulletins',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'megaphone' : 'megaphone-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Analytics',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="approvals"
          options={{
            title: 'Approvals',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} badge={pendingCount} />
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
        {/* Hidden — navigated to via router.push with reportId param */}
        <Tabs.Screen
          name="complaint-review"
          options={{
            title: 'Review',
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
            tabBarStyle: hiddenTabBarStyle,
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
    backgroundColor: '#ba1a1a',
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
