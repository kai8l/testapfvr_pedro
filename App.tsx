import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import Navigation from './src/navigation';
import { setupNotifications } from './src/lib/notify';

export default function App() {
  useEffect(() => { setupNotifications(); }, []);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
          <StatusBar style="dark" />
          <Navigation />
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
