import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirm dialog.
 * On native, uses Alert.alert. On web (where Alert is a no-op), uses window.confirm.
 *
 * @param title    Dialog title
 * @param message  Dialog body
 * @param onConfirm  Called when the user confirms
 * @param confirmText  Label for the confirm button (default "OK")
 * @param destructive  Marks the confirm button as destructive on native
 */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText: string = 'OK',
  destructive: boolean = false,
): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const ok = typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
    if (ok) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
