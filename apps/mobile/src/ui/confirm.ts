import { Alert, Platform } from 'react-native';

/** Yes/no confirmation that works on native and web (React Native's Alert has no web implementation). */
export function confirm(message: string, onYes: () => void): void {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onYes();
    return;
  }
  Alert.alert('', message, [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', style: 'destructive', onPress: onYes }]);
}
