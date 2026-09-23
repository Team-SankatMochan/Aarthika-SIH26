import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncData } from '../services/syncService';

export default function RootLayout() {
  useEffect(() => {
    // Initial sync on startup
    syncData().catch(e => console.warn('Initial sync failed:', e));
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </SafeAreaProvider>
  );
}
