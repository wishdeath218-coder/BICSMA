import { Platform } from 'react-native';

// ─── Layout constants ─────────────────────────────────────────────────────────
// Height of the bottom tab bar. Screens offset their content by this on web
// where the bar is position:fixed.
export const TAB_BAR_HEIGHT = 62;

// Sticky header style — on web this pins a screen header to the top of the
// scroll viewport. No-op on native (headers scroll normally there).
export const stickyHeader: any =
  Platform.OS === 'web' ? { position: 'sticky', top: 0, zIndex: 10 } : {};

// ─── Date/time ────────────────────────────────────────────────────────────────
// Canonical timestamp used across reports, notifications, and timelines.
// e.g. "Sep 22, 2026 • 3:04 PM"
export function nowStamp(): string {
  const now = new Date();
  return (
    now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' • ' +
    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}
