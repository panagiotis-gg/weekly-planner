import { Alert, Platform } from 'react-native';
import i18n from '@/i18n';

/** Yes/no confirmation that works on native and web (React Native's Alert has no web implementation). */
export function confirm(message: string, onYes: () => void): void {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onYes();
    return;
  }
  Alert.alert('', message, [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: i18n.t('common.ok'), style: 'destructive', onPress: onYes },
  ]);
}
